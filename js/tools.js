// Pure tool registry (no DOM, no store): schemas, config cleaning, presets, share params, search data.
import { parseItems, formatDice } from './parse.js';

export const TOOLS = [
  { id: 'number', label: 'Number', icon: 'number', route: '/number', section: 'main', presets: true },
  { id: 'list', label: 'List', icon: 'list', route: '/lists', section: 'main', presets: false },
  { id: 'dice', label: 'Dice', icon: 'dice', route: '/dice', section: 'main', presets: true },
  { id: 'lots', label: 'Cast lots', icon: 'lots', route: '/lots', section: 'main', presets: true },
  { id: 'coin', label: 'Coin', icon: 'coin', route: '/coin', section: 'main', presets: false },
  { id: 'teams', label: 'Teams', icon: 'teams', route: '/teams', section: 'more', presets: true },
  { id: 'shuffle', label: 'Shuffle', icon: 'shuffle', route: '/shuffle', section: 'more', presets: true },
  { id: 'wheel', label: 'Wheel', icon: 'wheel', route: '/wheel', section: 'more', presets: true },
  { id: 'lottery', label: 'Lottery', icon: 'lottery', route: '/lottery', section: 'more', presets: true },
  { id: 'cards', label: 'Cards', icon: 'cards', route: '/cards', section: 'more', presets: true },
];
export const CONFIG_TOOLS = TOOLS.filter((t) => t.presets).map((t) => t.id);
export const toolById = (id) => TOOLS.find((t) => t.id === id);

export const SAMPLE_NAMES = 'Alice\nBob\nCharlie\nDana\nEli\nFarah\nGus\nHana';
export const SAMPLE_WHEEL = 'Pizza\nBurgers\nSushi\nTacos\nPasta\nSalad';
export const MAX_TEXT = 10000;
export const LIST_TOOLS = ['teams', 'shuffle', 'wheel'];

const B = 1e9;
const sourceFields = (text) => [
  ['source', 'enum', ['paste', 'list'], 'paste'],
  ['listId', 'id', ''],
  ['text', 'text', text],
];

// Field: [key, 'int', lo, hi, def] | [key, 'bool', def] | [key, 'enum', values, def] | [key, 'id', def] | [key, 'text', def]
export const SCHEMAS = {
  number: [
    ['from', 'int', -B, B, 1], ['to', 'int', -B, B, 10], ['count', 'int', 1, 100, 1],
    ['sort', 'bool', false], ['allowDupes', 'bool', false], ['noRepeat', 'bool', false],
  ],
  dice: [['count', 'int', 1, 12, 2], ['sides', 'int', 2, 100, 6], ['modifier', 'int', -99, 99, 0]],
  lots: [['n', 'int', 2, 30, 6], ['k', 'int', 1, 29, 1]],
  teams: [...sourceFields(SAMPLE_NAMES), ['mode', 'enum', ['teams', 'size'], 'teams'], ['n', 'int', 2, 50, 2]],
  shuffle: sourceFields(SAMPLE_NAMES),
  wheel: sourceFields(SAMPLE_WHEEL),
  lottery: [
    ['n', 'int', 2, 99, 49], ['k', 'int', 1, 10, 6], ['bonusK', 'int', 0, 3, 0],
    ['bonusN', 'int', 1, 99, 10], ['bonusSame', 'bool', false], ['lines', 'int', 1, 10, 1],
  ],
  cards: [['count', 'int', 1, 10, 1], ['jokers', 'bool', false], ['noRepeat', 'bool', true]],
};

export const CONFIG_DEFAULTS = Object.fromEntries(
  Object.entries(SCHEMAS).map(([tool, fields]) => [tool, Object.fromEntries(fields.map((f) => [f[0], f[f.length - 1]]))]));

const isPlain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const normText = (s) => s.replace(/\r\n/g, '\n').slice(0, MAX_TEXT);

function cleanField(f, v) {
  const [, type] = f;
  if (type === 'int') return Number.isInteger(v) && v >= f[2] && v <= f[3] ? v : undefined;
  if (type === 'bool') return typeof v === 'boolean' ? v : undefined;
  if (type === 'enum') return f[2].includes(v) ? v : undefined;
  if (type === 'id') return typeof v === 'string' && /^[\w-]{0,64}$/.test(v) ? v : undefined;
  if (type === 'text') return typeof v === 'string' ? normText(v) : undefined;
  return undefined;
}

function fix(tool, c) {
  if (tool === 'number') {
    if (c.from > c.to) [c.from, c.to] = [c.to, c.from];
    if (c.to - c.from + 1 > 100000) c.noRepeat = false;
  } else if (tool === 'lots') {
    c.k = Math.min(c.k, c.n - 1);
  } else if (tool === 'lottery') {
    c.k = Math.min(c.k, c.n);
    c.bonusK = Math.min(c.bonusK, c.bonusSame ? c.n - c.k : c.bonusN);
  }
  return c;
}

export function cleanConfig(tool, raw, { lenient = false } = {}) {
  const fields = SCHEMAS[tool];
  if (!fields || !isPlain(raw)) return null;
  const out = {};
  for (const f of fields) {
    const key = f[0];
    const def = f[f.length - 1];
    if (!(key in raw) || raw[key] === undefined) { out[key] = def; continue; }
    const v = cleanField(f, raw[key]);
    if (v === undefined) {
      if (!lenient) return null;
      out[key] = def;
    } else out[key] = v;
  }
  return fix(tool, out);
}

export function extractConfig(tool, section) {
  const c = cleanConfig(tool, section, { lenient: true });
  if (LIST_TOOLS.includes(tool)) {
    if (c.source === 'list') c.text = '';
    else c.listId = '';
  }
  return c;
}

export const configKey = (tool, config) => JSON.stringify(cleanConfig(tool, config, { lenient: true }));

// Mutates a working section to match `config`. Returns true if anything changed.
export function applyConfig(tool, section, config) {
  const cfg = cleanConfig(tool, config, { lenient: true });
  let changed = false;
  const before = { ...section };
  const set = (k, v) => { if (section[k] !== v) { section[k] = v; changed = true; } };
  if (LIST_TOOLS.includes(tool)) {
    set('source', cfg.source);
    if (cfg.source === 'list') set('listId', cfg.listId);
    else { set('text', cfg.text); set('listId', ''); }
    if (tool === 'teams') { set('mode', cfg.mode); set('n', cfg.n); }
    return changed;
  }
  for (const f of SCHEMAS[tool]) set(f[0], cfg[f[0]]);
  if (!changed) return false;
  if (tool === 'number' && (before.from !== cfg.from || before.to !== cfg.to)) section.drawn = [];
  if (tool === 'dice' && (before.count !== cfg.count || before.sides !== cfg.sides)) section.values = Array(cfg.count).fill(1);
  if (tool === 'cards' && before.jokers !== cfg.jokers) section.drawn = [];
  return true;
}

/* ---------- summaries ---------- */
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;

function sourceSummary(config, lists, unit) {
  if (config.source === 'list') {
    const l = (lists || []).find((x) => x.id === config.listId);
    return l ? l.name : 'list missing';
  }
  return plural(parseItems(config.text).length, unit);
}

export function summary(tool, config, lists) {
  const c = config;
  switch (tool) {
    case 'number':
      return `${c.from}–${c.to}` + (c.count > 1 ? ` · ${c.count} numbers` : '') + (c.noRepeat ? ' · no repeat' : '');
    case 'dice': return formatDice(c);
    case 'lots': return `${c.n} lots · ${plural(c.k, 'winner')}`;
    case 'teams':
      return (c.mode === 'teams' ? plural(c.n, 'team') : `groups of ${c.n}`) + ' · ' + sourceSummary(c, lists, 'name');
    case 'shuffle':
    case 'wheel': return sourceSummary(c, lists, 'item');
    case 'lottery':
      return `${c.k}/${c.n}` + (c.bonusK ? ` + ${c.bonusK}` + (c.bonusSame ? '' : `/${c.bonusN}`) : '') + (c.lines > 1 ? ` · ${c.lines} lines` : '');
    case 'cards':
      return plural(c.count, 'card') + (c.jokers ? ' · jokers' : '') + (c.noRepeat ? ' · deck' : '');
    default: return '';
  }
}

/* ---------- share params ---------- */
const SHARE_LINES = 100;
const SHARE_CHARS = 2000;

export function toParams(tool, config, lists) {
  const c = { ...cleanConfig(tool, config, { lenient: true }) };
  const q = new URLSearchParams();
  q.set('v', '1');
  let truncated = false;
  for (const f of SCHEMAS[tool]) {
    const key = f[0];
    if (LIST_TOOLS.includes(tool) && (key === 'source' || key === 'listId')) continue;
    let v = c[key];
    if (key === 'text') {
      if (config.source === 'list') {
        const l = (lists || []).find((x) => x.id === config.listId);
        v = l ? l.items.join('\n') : '';
      }
      let lines = String(v).split('\n');
      if (lines.length > SHARE_LINES) { lines = lines.slice(0, SHARE_LINES); truncated = true; }
      v = lines.join('\n');
      if (v.length > SHARE_CHARS) {
        v = v.slice(0, SHARE_CHARS);
        const cut = v.lastIndexOf('\n');
        if (cut > 0) v = v.slice(0, cut);
        truncated = true;
      }
    }
    q.set(key, typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
  }
  return { query: q.toString(), truncated };
}

export function fromParams(tool, q) {
  const fields = SCHEMAS[tool];
  if (!fields) return null;
  if (q.has('v') && q.get('v') !== '1') return null;
  const obj = {};
  for (const f of fields) {
    const key = f[0];
    if (LIST_TOOLS.includes(tool) && (key === 'source' || key === 'listId')) continue;
    if (!q.has(key)) continue;
    const raw = q.get(key);
    const type = f[1];
    if (type === 'int') {
      if (!/^-?\d{1,10}$/.test(raw)) return null;
      obj[key] = Number(raw);
    } else if (type === 'bool') {
      if (!['1', '0', 'true', 'false'].includes(raw)) return null;
      obj[key] = raw === '1' || raw === 'true';
    } else if (type === 'enum') {
      obj[key] = raw;
    } else if (type === 'text') {
      if (raw.length > MAX_TEXT) return null;
      obj[key] = raw;
    }
  }
  return cleanConfig(tool, obj);
}

/* ---------- builtin lists ---------- */
const seq = (s) => s.split(', ');
export const BUILTIN_LISTS = {
  'preset-names': {
    name: 'Names', items: seq('Alice, Bob, Charlie, Dana, Eli, Farah'), keywords: ['names', 'name picker'],
  },
  'preset-yes-no': { name: 'Yes or No', items: ['Yes', 'No'], keywords: ['yes no', 'decide'] },
  'preset-magic-8-ball': {
    name: 'Magic 8-ball',
    items: [
      'It is certain', 'It is decidedly so', 'Without a doubt', 'Yes definitely', 'You may rely on it',
      'As I see it, yes', 'Most likely', 'Outlook good', 'Yes', 'Signs point to yes',
      'Reply hazy, try again', 'Ask again later', 'Better not tell you now', 'Cannot predict now', 'Concentrate and ask again',
      "Don't count on it", 'My reply is no', 'My sources say no', 'Outlook not so good', 'Very doubtful',
    ],
    keywords: ['8 ball', 'eight ball', 'magic ball', 'fortune'],
  },
  'preset-rock-paper-scissors': {
    name: 'Rock paper scissors', items: ['Rock', 'Paper', 'Scissors'],
    keywords: ['rps', 'rock', 'paper', 'scissors', 'hand game'],
  },
  'preset-letters': {
    name: 'Letters A–Z', items: [...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'], keywords: ['letter', 'alphabet', 'a z'],
  },
  'preset-months': {
    name: 'Months',
    items: seq('January, February, March, April, May, June, July, August, September, October, November, December'),
    keywords: ['month', 'months', 'year'],
  },
  'preset-weekdays': {
    name: 'Days of the week', items: seq('Monday, Tuesday, Wednesday, Thursday, Friday, Saturday, Sunday'),
    keywords: ['day', 'weekday', 'week'],
  },
};

/* ---------- search data ---------- */
export const TOOL_KEYWORDS = {
  number: ['random number', 'rng', 'pick a number', 'range', 'digit', 'integer'],
  list: ['list', 'lists', 'saved lists', 'name picker', 'names', 'pick', 'choose', 'random item', 'picker'],
  dice: ['dice', 'die', 'roll', 'd4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100', 'rpg', 'dnd', 'tabletop'],
  lots: ['lots', 'draw lots', 'straws', 'draw straws', 'winner', 'raffle'],
  coin: ['coin', 'flip', 'heads', 'tails', 'toss', 'yes no', '50 50', 'decide'],
  teams: ['teams', 'team', 'groups', 'group', 'split', 'divide', 'team generator', 'pairs'],
  shuffle: ['shuffle', 'random order', 'order', 'sequence', 'turn order', 'queue', 'sort'],
  wheel: ['wheel', 'spin', 'spinner', 'wheel of names', 'roulette', 'spin the wheel'],
  lottery: ['lottery', 'lotto', 'numbers', 'balls', 'powerball', 'euromillions', 'mega millions', 'bonus'],
  cards: ['cards', 'card', 'deck', 'playing cards', 'draw a card', 'poker', 'joker'],
};

export const SHORTCUTS = [
  ...[4, 6, 8, 10, 12, 20, 100].map((n) => ({
    label: 'd' + n, sub: 'Dice', icon: 'dice', href: `#/dice?v=1&count=1&sides=${n}&modifier=0`,
  })),
  ...[6, 10, 50, 100, 1000].map((n) => ({
    label: `Number 1–${n}`, sub: 'Number', icon: 'number', href: `#/number?v=1&from=1&to=${n}`,
  })),
  { label: '6/49', sub: 'Lottery', icon: 'lottery', href: '#/lottery?v=1&n=49&k=6&bonusK=0&bonusSame=0' },
  { label: '5/69 + 1/26', sub: 'Lottery', icon: 'lottery', href: '#/lottery?v=1&n=69&k=5&bonusK=1&bonusN=26&bonusSame=0' },
];
