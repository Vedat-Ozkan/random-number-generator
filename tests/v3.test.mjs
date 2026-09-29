// Phase A tests: parsers, rng additions, tools registry, share params, search, store migration.
// Run: node tests/v3.test.mjs
import assert from 'node:assert/strict';
import { parseWeighted, parseItems, splitImport, parseDice, formatDice } from '../js/parse.js';
import { weightedIndex, drawWeighted, drawLottery, splitTeams, shuffle, draw } from '../js/rng.js';
import {
  TOOLS, CONFIG_TOOLS, CONFIG_DEFAULTS, SCHEMAS, cleanConfig, extractConfig, applyConfig, configKey,
  toParams, fromParams, summary, BUILTIN_LISTS,
} from '../js/tools.js';
import { buildIndex, search } from '../js/search.js';
import { normalize, DEFAULTS } from '../js/store.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };

test('weighted parser', () => {
  assert.deepEqual(parseWeighted('Pizza *3'), { text: 'Pizza', weight: 3 });
  assert.deepEqual(parseWeighted('Pizza x3'), { text: 'Pizza', weight: 3 });
  assert.deepEqual(parseWeighted('Pizza X3'), { text: 'Pizza', weight: 3 });
  assert.deepEqual(parseWeighted('Pizza *100'), { text: 'Pizza', weight: 100 });
  for (const lit of ['Pizza*3', 'Pizza * 3', 'Pizza x 3', '*3', 'Pizza x0', 'Pizza x101']) {
    assert.deepEqual(parseWeighted(lit), { text: lit, weight: 1 }, lit);
  }
  assert.deepEqual(parseWeighted('Size \\x3'), { text: 'Size x3', weight: 1 });
  assert.equal(parseItems(' a \n\n b ').length, 2);
});

test('splitImport', () => {
  assert.deepEqual(splitImport('a, b;c\td'), ['a', 'b', 'c', 'd']);
  assert.deepEqual(splitImport('a,b\nc'), ['a,b', 'c']);
  assert.deepEqual(splitImport(' a,, ,b, '), ['a', 'b']);
  assert.deepEqual(splitImport('a\r\n\r\nb'), ['a', 'b']);
});

test('dice notation', () => {
  const ok = [
    ['2d6+3', 2, 6, 3], ['d20', 1, 20, 0], ['3D8-2', 3, 8, -2], [' 2 d 6 + 3 ', 2, 6, 3],
    ['2d6−1', 2, 6, -1], ['12d100-99', 12, 100, -99],
  ];
  for (const [s, count, sides, modifier] of ok) {
    const p = parseDice(s);
    assert.deepEqual(p, { count, sides, modifier }, s);
    assert.deepEqual(parseDice(formatDice(p)), p, 'round trip ' + s);
  }
  for (const bad of ['', 'd', '0d6', '13d6', '2d1', '2d101', '2d6+100', '2d6+1d4', 'abc']) assert.equal(parseDice(bad), null, bad);
  assert.equal(formatDice({ count: 2, sides: 6, modifier: 3 }), '2d6+3');
  assert.equal(formatDice({ count: 1, sides: 20, modifier: 0 }), 'd20');
});

test('drawWeighted distribution and pools', () => {
  let hi = 0;
  for (let i = 0; i < 40000; i++) hi += drawWeighted({ weights: [1, 3], count: 1, noRepeat: false }).values[0];
  assert.ok(Math.abs(hi / 40000 - 0.75) < 0.02, 'index 1 share ' + hi / 40000);
  let drawn = [];
  const seen = [];
  for (let i = 0; i < 5; i++) {
    const r = drawWeighted({ weights: [1, 5, 2, 9, 1], count: 1, noRepeat: true, drawn });
    drawn = r.drawn;
    seen.push(...r.values);
  }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4]);
  const r6 = drawWeighted({ weights: [1, 5, 2, 9, 1], count: 1, noRepeat: true, drawn, resetNote: 'reset!' });
  assert.deepEqual(r6.notes, ['reset!']);
  assert.equal(r6.drawn.length, 1);
  const capd = drawWeighted({ weights: [1, 2, 3], count: 5, noRepeat: false });
  assert.equal(capd.values.length, 3);
  assert.equal(new Set(capd.values).size, 3);
  assert.ok(capd.notes.length === 1);
  assert.throws(() => weightedIndex([1, 1], new Set([0, 1])));
  assert.equal(draw({ min: 1, max: 1, count: 1, noRepeat: true, drawn: [1], resetNote: 'x' }).notes[0], 'x');
});

test('lottery draws', () => {
  const cases = [
    { n: 49, k: 6, bonusK: 0, bonusN: 10, bonusSame: false },
    { n: 69, k: 5, bonusK: 1, bonusN: 26, bonusSame: false },
    { n: 49, k: 6, bonusK: 1, bonusN: 10, bonusSame: true },
  ];
  for (const c of cases) {
    for (let i = 0; i < 2000; i++) {
      const { main, bonus } = drawLottery(c);
      assert.equal(main.length, c.k);
      assert.equal(new Set(main).size, c.k);
      assert.deepEqual(main, [...main].sort((a, b) => a - b));
      assert.ok(main.every((v) => v >= 1 && v <= c.n));
      assert.equal(bonus.length, c.bonusK);
      const bmax = c.bonusSame ? c.n : c.bonusN;
      assert.ok(bonus.every((v) => v >= 1 && v <= bmax));
      if (c.bonusSame) assert.ok(bonus.every((v) => !main.includes(v)));
    }
  }
});

test('team split', () => {
  const names = Array.from({ length: 10 }, (_, i) => 'n' + i);
  const sizes = (t) => t.map((x) => x.length).sort((a, b) => b - a);
  assert.deepEqual(sizes(splitTeams(names, 'teams', 3)), [4, 3, 3]);
  const bySize = splitTeams(names, 'size', 4);
  assert.equal(bySize.length, 3);
  assert.ok(Math.max(...sizes(bySize)) <= 4);
  const five = splitTeams(names.slice(0, 5), 'teams', 50);
  assert.deepEqual(five.map((t) => t.length), [1, 1, 1, 1, 1]);
  assert.deepEqual(splitTeams(names, 'teams', 3).flat().sort(), [...names].sort());
  for (let i = 0; i < 500; i++) {
    const total = 2 + (i % 30);
    const list = Array.from({ length: total }, (_, j) => 'p' + j);
    const mode = i % 2 ? 'teams' : 'size';
    const n = 2 + (i % 7);
    const s = sizes(splitTeams(list, mode, n));
    assert.ok(s[0] - s[s.length - 1] <= 1);
    if (mode === 'size') assert.ok(s[0] <= n);
  }
});

test('shuffle uniformity', () => {
  const counts = {};
  for (let i = 0; i < 60000; i++) {
    const k = shuffle([0, 1, 2]).join('');
    counts[k] = (counts[k] || 0) + 1;
  }
  assert.equal(Object.keys(counts).length, 6);
  for (const v of Object.values(counts)) assert.ok(Math.abs(v - 10000) < 500, JSON.stringify(counts));
});

test('registry', () => {
  assert.deepEqual(CONFIG_TOOLS, ['number', 'dice', 'lots', 'teams', 'shuffle', 'wheel', 'lottery', 'cards']);
  assert.equal(TOOLS.length, 10);
  assert.equal(Object.keys(BUILTIN_LISTS).length, 7);
  assert.equal(BUILTIN_LISTS['preset-magic-8-ball'].items.length, 20);
  assert.equal(BUILTIN_LISTS['preset-letters'].items.length, 26);
});

test('cleanConfig strict and lenient', () => {
  assert.equal(cleanConfig('number', { from: 1.5 }), null);
  assert.equal(cleanConfig('dice', { count: 0 }), null);
  assert.equal(cleanConfig('dice', { sides: 1 }), null);
  assert.equal(cleanConfig('teams', { mode: 'x' }), null);
  for (const bad of [null, 5, 'x', [], undefined]) assert.equal(cleanConfig('dice', bad), null);
  assert.deepEqual(cleanConfig('number', { from: 1.5 }, { lenient: true }), CONFIG_DEFAULTS.number);
  assert.deepEqual(cleanConfig('dice', { count: 0 }, { lenient: true }), CONFIG_DEFAULTS.dice);
  assert.deepEqual(cleanConfig('teams', { mode: 'x' }, { lenient: true }), CONFIG_DEFAULTS.teams);
  assert.deepEqual(Object.keys(cleanConfig('dice', { modifier: 2, extra: 1 })), ['count', 'sides', 'modifier']);
  // fixes
  assert.deepEqual([cleanConfig('number', { from: 9, to: 2 }).from, cleanConfig('number', { from: 9, to: 2 }).to], [2, 9]);
  assert.equal(cleanConfig('number', { from: 1, to: 200000, noRepeat: true }).noRepeat, false);
  assert.equal(cleanConfig('lots', { n: 5, k: 20 }).k, 4);
  assert.equal(cleanConfig('lottery', { n: 10, k: 8, bonusK: 3, bonusSame: true }).bonusK, 2);
  assert.equal(cleanConfig('lottery', { n: 49, k: 6, bonusK: 3, bonusN: 2, bonusSame: false }).bonusK, 2);
  assert.equal(cleanConfig('lottery', { n: 5, k: 10 }).k, 5);
  assert.equal(cleanConfig('shuffle', { text: 'a\r\nb' }).text, 'a\nb');
  assert.equal(cleanConfig('shuffle', { text: 'x'.repeat(20000) }).text.length, 10000);
});

test('applyConfig and extractConfig', () => {
  const sec = { from: 1, to: 10, count: 1, sort: false, allowDupes: false, noRepeat: false, drawn: [3, 4] };
  assert.equal(applyConfig('number', sec, { ...CONFIG_DEFAULTS.number }), false);
  assert.deepEqual(sec.drawn, [3, 4]);
  assert.equal(applyConfig('number', sec, { ...CONFIG_DEFAULTS.number, count: 3 }), true);
  assert.deepEqual(sec.drawn, [3, 4]);
  assert.equal(applyConfig('number', sec, { ...CONFIG_DEFAULTS.number, to: 20 }), true);
  assert.deepEqual(sec.drawn, []);
  const dice = { count: 2, sides: 6, modifier: 0, values: [3, 4] };
  assert.equal(applyConfig('dice', dice, { count: 2, sides: 6, modifier: 5 }), true);
  assert.deepEqual(dice.values, [3, 4]);
  applyConfig('dice', dice, { count: 3, sides: 20, modifier: 5 });
  assert.deepEqual(dice.values, [1, 1, 1]);
  const cards = { ...CONFIG_DEFAULTS.cards, drawn: [1, 2] };
  applyConfig('cards', cards, { ...CONFIG_DEFAULTS.cards, count: 3 });
  assert.deepEqual(cards.drawn, [1, 2]);
  applyConfig('cards', cards, { ...CONFIG_DEFAULTS.cards, jokers: true });
  assert.deepEqual(cards.drawn, []);
  const t = { ...CONFIG_DEFAULTS.teams, text: 'my pasted text' };
  assert.equal(applyConfig('teams', t, { ...CONFIG_DEFAULTS.teams, source: 'list', listId: 'abc', text: '' }), true);
  assert.equal(t.text, 'my pasted text');
  assert.equal(t.source, 'list');
  assert.equal(t.listId, 'abc');
  assert.equal(extractConfig('teams', t).text, '');
  const p = { ...CONFIG_DEFAULTS.teams, text: 'x', listId: 'zzz' };
  assert.equal(extractConfig('teams', p).listId, '');
  assert.equal(configKey('dice', { count: 2, sides: 6, modifier: 0 }), configKey('dice', { modifier: 0, sides: 6, count: 2 }));
});

test('summaries', () => {
  assert.equal(summary('number', { ...CONFIG_DEFAULTS.number, to: 12, count: 3, noRepeat: true }), '1–12 · 3 numbers · no repeat');
  assert.equal(summary('dice', { count: 2, sides: 6, modifier: 3 }), '2d6+3');
  assert.equal(summary('lots', { n: 6, k: 2 }), '6 lots · 2 winners');
  assert.equal(summary('lottery', { ...CONFIG_DEFAULTS.lottery, n: 69, k: 5, bonusK: 1, bonusN: 26, lines: 3 }), '5/69 + 1/26 · 3 lines');
  assert.equal(summary('cards', { count: 1, jokers: false, noRepeat: true }), '1 card · deck');
  assert.equal(summary('teams', { ...CONFIG_DEFAULTS.teams, source: 'list', listId: 'q' }, []), '2 teams · list missing');
});

test('share params round trip and validation', () => {
  for (const tool of CONFIG_TOOLS) {
    const cfg = { ...CONFIG_DEFAULTS[tool] };
    const { query } = toParams(tool, cfg, []);
    assert.deepEqual(fromParams(tool, new URLSearchParams(query)), cfg, tool);
  }
  const custom = cleanConfig('number', { from: -5, to: 500, count: 7, sort: true, allowDupes: false, noRepeat: true });
  assert.deepEqual(fromParams('number', new URLSearchParams(toParams('number', custom, []).query)), custom);
  assert.match(toParams('number', CONFIG_DEFAULTS.number, []).query, /^v=1&from=1&to=10&count=1&sort=0&allowDupes=0&noRepeat=0$/);
  const q = (s) => new URLSearchParams(s);
  for (const bad of ['v=2', 'from=abc', 'from=1e3', 'sort=yes', 'to=2000000000']) assert.equal(fromParams('number', q(bad)), null, bad);
  assert.equal(fromParams('dice', q('count=101')), null);
  assert.equal(fromParams('cards', q('count=11')), null);
  assert.deepEqual(fromParams('number', q('sortx=1')), CONFIG_DEFAULTS.number);
  assert.equal(fromParams('shuffle', new URLSearchParams({ text: 'x'.repeat(10001) })), null);
  const ignored = fromParams('shuffle', q('source=list&listId=x&text=a%0Ab'));
  assert.equal(ignored.source, 'paste');
  assert.equal(ignored.listId, '');
  assert.equal(ignored.text, 'a\nb');
  const lines = Array.from({ length: 150 }, (_, i) => 'item' + i).join('\n');
  const tr = toParams('wheel', { ...CONFIG_DEFAULTS.wheel, text: lines }, []);
  assert.equal(tr.truncated, true);
  assert.equal(fromParams('wheel', new URLSearchParams(tr.query)).text.split('\n').length, 100);
  const fromList = toParams('teams', { ...CONFIG_DEFAULTS.teams, source: 'list', listId: 'L', text: '' }, [{ id: 'L', items: ['a', 'b'] }]);
  assert.equal(fromParams('teams', new URLSearchParams(fromList.query)).text, 'a\nb');
  assert.ok(!/listId|source/.test(fromList.query));
  assert.ok(SCHEMAS.number.length === 6);
});

test('search ranking', () => {
  const state = normalize(null);
  state.presets = [{ id: 'p1', tool: 'dice', name: 'Fireball', config: { count: 8, sides: 6, modifier: 0 }, t: 0 }];
  const idx = buildIndex(state);
  const labels = (q) => search(idx, q).map((e) => e.label);
  assert.equal(labels('co')[0], 'Coin');
  assert.equal(labels('d20')[0], 'd20');
  assert.ok(labels('d20').includes('Dice'));
  assert.equal(labels('teams')[0], 'Teams');
  assert.ok(labels('8 ball').includes('Magic 8-ball'));
  assert.ok(labels('yes no').includes('Coin'));
  assert.ok(labels('yes no').includes('Yes or No'));
  assert.equal(labels('fire')[0], 'Fireball');
  assert.equal(labels('dice')[0], 'Dice');
  assert.ok(labels('dice').includes('Fireball'));
  const ice = labels('ice');
  assert.ok(ice.includes('Dice'));
  assert.deepEqual(labels(''), []);
  assert.deepEqual(labels('zzz'), []);
  assert.ok(search(idx, 'e').length <= 20);
  const fb = search(idx, 'fire')[0];
  assert.equal(fb.href, '#/dice/p/p1');
  assert.equal(fb.sub, 'Dice · 8d6');
});

test('store migration v1 -> v2', () => {
  const v1 = {
    version: 1,
    settings: { theme: 'dark', sound: false, vibration: true, animations: true },
    number: { from: 5, to: 50, noRepeat: true, drawn: [7, 8], count: 2, sort: true, allowDupes: false },
    lists: [
      { id: 'a', name: 'A', items: ['x', 'y', 'z'], noRepeat: true, drawn: [1], pickCount: 2 },
      { id: 'b', name: 'B', items: ['q'], noRepeat: false, drawn: [], pickCount: 1 },
    ],
    dice: { count: 3, values: [2, 5, 6] },
    coin: { heads: 4, tails: 6, last: 'tails' },
    lots: { n: 8, k: 2 },
    history: { number: [{ t: 1, text: '7' }] },
  };
  const s = normalize(v1);
  assert.equal(s.version, 2);
  assert.equal(s.lists.length, 2);
  assert.deepEqual(s.lists[0].drawn, [1]);
  assert.deepEqual(s.history.number, [{ t: 1, text: '7' }]);
  assert.deepEqual(s.dice, { count: 3, sides: 6, modifier: 0, values: [2, 5, 6] });
  assert.deepEqual(s.presets, []);
  assert.equal(s.coin.heads, 4);
  assert.equal(s.coin.run, 1);
  assert.equal(s.coin.best, 1);
  assert.equal(s.coin.bestFace, "tails");
  assert.deepEqual(s.number.drawn, [7, 8]);
  for (const k of ['teams', 'shuffle', 'wheel', 'lottery']) assert.deepEqual(s[k], DEFAULTS[k]);
  assert.deepEqual(s.cards, DEFAULTS.cards);
  assert.equal(normalize({ number: { from: 2, to: 3 } }).version, 2);
  assert.deepEqual(normalize(null), DEFAULTS);
  assert.deepEqual(normalize({ version: 3 }), DEFAULTS);
});

test('store presets are validated', () => {
  const good = (id, tool = 'dice') => ({ id, tool, name: ' Name ', config: { count: 2, sides: 20, modifier: 1 }, t: 5 });
  const s = normalize({
    version: 2,
    presets: [
      good('ok-1'), good('ok-1'), good('bad id!'), good('x', 'coin'), { ...good('e1'), name: '   ' },
      { ...good('c1'), config: { count: 99, sides: 'x' } }, { ...good('n1'), name: 'n'.repeat(90) }, null, 5,
      ...Array.from({ length: 25 }, (_, i) => good('d' + i)),
    ],
  });
  assert.equal(s.presets[0].name, 'Name');
  assert.deepEqual(s.presets[0].config, { count: 2, sides: 20, modifier: 1 });
  assert.equal(s.presets.filter((p) => p.id === 'ok-1').length, 1);
  assert.ok(!s.presets.some((p) => p.id === 'bad id!' || p.id === 'x' || p.id === 'e1'));
  assert.deepEqual(s.presets.find((p) => p.id === 'c1').config, CONFIG_DEFAULTS.dice);
  assert.equal(s.presets.find((p) => p.id === 'n1').name.length, 60);
  assert.equal(s.presets.filter((p) => p.tool === 'dice').length, 20);
  const many = normalize({
    version: 2,
    presets: CONFIG_TOOLS.flatMap((tool) => Array.from({ length: 20 }, (_, i) => ({ id: `${tool}-${i}`, tool, name: 'p', config: {}, t: 0 }))),
  });
  assert.equal(many.presets.length, 100);
});

test('store dice, coin and cards normalization', () => {
  const s = normalize({ version: 2, dice: { count: 40, sides: 500, modifier: -500, values: [90, 2] } });
  assert.deepEqual([s.dice.count, s.dice.sides, s.dice.modifier], [12, 100, -99]);
  assert.equal(s.dice.values.length, 12);
  assert.equal(s.dice.values[0], 90);
  assert.equal(normalize({ dice: { count: 2, sides: 4, values: [9, 3] } }).dice.values[0], 4);
  const c = normalize({ coin: { heads: 1, tails: 0, last: null, run: 5, best: 3, bestFace: 'x' } }).coin;
  assert.deepEqual([c.run, c.best, c.bestFace], [0, 3, null]);
  const c2 = normalize({ coin: { heads: 2, tails: 3, last: 'heads', run: 0, best: 0 } }).coin;
  assert.deepEqual([c2.run, c2.best, c2.bestFace], [1, 1, 'heads']);
  const c3 = normalize({ coin: { heads: 2, tails: 3, last: 'tails', run: 2, best: 4, bestFace: 'heads' } }).coin;
  assert.deepEqual([c3.run, c3.best, c3.bestFace], [2, 4, 'heads']);
  const cd = normalize({ cards: { jokers: false, drawn: [0, 52, 53, 3, 3] } }).cards;
  assert.deepEqual(cd.drawn, [0, 3]);
  assert.deepEqual(normalize({ cards: { jokers: true, drawn: [53, 54] } }).cards.drawn, [53]);
});

console.log(`\n${passed} tests passed`);
