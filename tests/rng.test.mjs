import assert from 'node:assert/strict';
import { randInt, sampleDistinct, draw, shuffle } from '../js/rng.js';
import { normalize, DEFAULTS } from '../js/store.js';

let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };

test('randInt stays within bounds', () => {
  for (const [a, b] of [[1, 10], [-5, 5], [0, 0], [-1e9, 1e9]]) {
    for (let i = 0; i < 100000; i++) {
      const v = randInt(a, b);
      assert.ok(Number.isInteger(v) && v >= a && v <= b, `randInt(${a},${b}) -> ${v}`);
    }
  }
});

test('randInt(1,6) distribution within 5%', () => {
  const counts = Array(7).fill(0);
  for (let i = 0; i < 60000; i++) counts[randInt(1, 6)]++;
  for (let f = 1; f <= 6; f++) assert.ok(Math.abs(counts[f] - 10000) <= 500, `face ${f}: ${counts[f]}`);
});

test('sampleDistinct sparse branch', () => {
  const r = sampleDistinct(1, 1e6, 10);
  assert.equal(r.length, 10);
  assert.equal(new Set(r).size, 10);
  assert.ok(r.every((v) => v >= 1 && v <= 1e6));
});

test('sampleDistinct dense branch respects exclude', () => {
  for (let i = 0; i < 500; i++) {
    const r = sampleDistinct(1, 10, 8, new Set([1, 2]));
    assert.equal(new Set(r).size, 8);
    assert.deepEqual([...r].sort((a, b) => a - b), [3, 4, 5, 6, 7, 8, 9, 10]);
  }
});

test('sampleDistinct throws when k > available', () => {
  assert.throws(() => sampleDistinct(1, 10, 9, new Set([1, 2])), RangeError);
  assert.throws(() => sampleDistinct(1, 3, 4), RangeError);
});

test('full no-repeat pool is a permutation', () => {
  const drawn = new Set();
  const out = [];
  for (let i = 0; i < 10; i++) {
    const [v] = sampleDistinct(1, 10, 1, drawn);
    drawn.add(v);
    out.push(v);
  }
  assert.deepEqual(out.sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test('shuffle keeps elements', () => {
  const a = shuffle([1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...a].sort(), [1, 2, 3, 4, 5, 6]);
});

test('draw: no-repeat cycle, cap and auto reset', () => {
  let drawn = [];
  const seen = [];
  for (let i = 0; i < 10; i++) {
    const r = draw({ min: 1, max: 10, count: 1, noRepeat: true, drawn });
    drawn = r.drawn;
    seen.push(...r.values);
  }
  assert.equal(new Set(seen).size, 10);
  const r = draw({ min: 1, max: 10, count: 1, noRepeat: true, drawn });
  assert.equal(r.drawn.length, 1);
  assert.match(r.notes[0], /pool reset/);
  const c = draw({ min: 1, max: 10, count: 5, noRepeat: true, drawn: [1, 2, 3, 4, 5, 6, 7, 8] });
  assert.equal(c.values.length, 2);
  assert.match(c.notes[0], /Only 2 left/);
  const s = draw({ min: 1, max: 100, count: 5, noRepeat: false, sort: true });
  assert.deepEqual(s.values, [...s.values].sort((a, b) => a - b));
  assert.equal(new Set(s.values).size, 5);
  assert.equal(draw({ min: 4, max: 4, count: 1, noRepeat: false }).values[0], 4);
});

test('normalize(null) equals DEFAULTS', () => {
  assert.deepEqual(normalize(null), DEFAULTS);
  assert.deepEqual(normalize('junk'), DEFAULTS);
  assert.deepEqual(normalize({ version: 99 }), DEFAULTS);
});

test('normalize survives garbage', () => {
  assert.doesNotThrow(() => normalize({ garbage: 1, settings: 5, number: [], lists: [null, 3, { id: 1 }], history: { a: 'x', b: [null, { t: 'z' }] }, dice: 'x' }));
  const n = normalize({ lists: [null, { id: 1 }] });
  assert.deepEqual(n.lists, []);
});

test('normalize clamps and filters', () => {
  const n = normalize({ version: 1, number: { from: -5e12, to: 3.9, count: 500, drawn: [1, 1, 99, -3, 2.5], noRepeat: true } });
  assert.equal(n.number.from, -1e9);
  assert.equal(n.number.to, 3);
  assert.equal(n.number.count, 100);
  assert.equal(n.number.noRepeat, false); // range too large for a pool
  const m = normalize({ number: { from: 1, to: 10, noRepeat: true, drawn: [3, 3, 11, 0, 7] } });
  assert.deepEqual(m.number.drawn, [3, 7]);
  const l = normalize({ lists: [{ id: 'a', name: 'A', items: ['x', 'y'], drawn: [0, 5, 0, 1], pickCount: 9 }] });
  assert.deepEqual(l.lists[0].drawn, [0, 1]);
  assert.equal(l.lists[0].pickCount, 2);
  const hh = normalize({ history: { number: Array.from({ length: 30 }, (_, i) => ({ t: i, text: String(i) })) } });
  assert.equal(hh.history.number.length, 20);
  assert.equal(normalize({ lots: { n: 5, k: 40 } }).lots.k, 4);
});

test('new installs start with no saved lists; stored lists are kept', () => {
  assert.equal(normalize({ version: 1 }).lists.length, 0);
  assert.equal(normalize(null).lists.length, 0);
  assert.equal(normalize({ version: 1, lists: [] }).lists.length, 0);
});

console.log(`\n${passed} tests passed`);
