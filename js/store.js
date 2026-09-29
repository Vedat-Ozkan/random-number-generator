// App state: one localStorage key, normalized on load.

const KEY = 'random:state';
const VERSION = 1;

export const DEFAULTS = {
  version: VERSION,
  settings: { theme: 'system', sound: true, vibration: true, animations: true },
  number: { from: 1, to: 10, noRepeat: false, drawn: [], count: 1, sort: false, allowDupes: false },
  lists: [{
    id: 'default-answer', name: 'Random answer',
    items: ['Yes', 'No', 'Maybe', 'Ask again later'],
    noRepeat: false, drawn: [], pickCount: 1,
  }],
  dice: { count: 2, values: [1, 1] },
  coin: { heads: 0, tails: 0, last: null },
  lots: { n: 6, k: 1 },
  history: {},
};

// MIGRATIONS[v] upgrades a state of version v to v + 1.
const MIGRATIONS = [
  (raw) => raw, // 0 -> 1: unversioned data is already compatible
];

const BOUND = 1e9;
const MAX_ITEMS = 500;
const MAX_ITEM_LEN = 200;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isInt = (v) => typeof v === 'number' && Number.isFinite(v);
const clampInt = (v, lo, hi, fallback) => (isInt(v) ? Math.min(hi, Math.max(lo, Math.trunc(v))) : fallback);
const bool = (v, fallback) => (typeof v === 'boolean' ? v : fallback);

function cleanDrawn(arr, lo, hi) {
  if (!Array.isArray(arr)) return [];
  const seen = new Set();
  const out = [];
  for (const v of arr) {
    if (!Number.isInteger(v) || v < lo || v > hi || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

function normalizeList(l) {
  if (!isObj(l) || typeof l.id !== 'string' || !l.id || typeof l.name !== 'string' || !Array.isArray(l.items)) return null;
  const items = l.items.filter((s) => typeof s === 'string').slice(0, MAX_ITEMS).map((s) => s.slice(0, MAX_ITEM_LEN));
  return {
    id: l.id,
    name: l.name.slice(0, 60),
    items,
    noRepeat: bool(l.noRepeat, false),
    drawn: cleanDrawn(l.drawn, 0, items.length - 1),
    pickCount: clampInt(l.pickCount, 1, Math.max(1, Math.min(20, items.length)), 1),
  };
}

export function normalize(input) {
  const s = structuredClone(DEFAULTS);
  if (!isObj(input)) return s;
  let raw = input;
  let v = typeof raw.version === 'number' ? raw.version : 0;
  if (v > VERSION) return s;
  for (; v < VERSION; v++) raw = MIGRATIONS[v] ? MIGRATIONS[v](raw) : raw;

  if (isObj(raw.settings)) {
    const r = raw.settings;
    if (['system', 'light', 'dark'].includes(r.theme)) s.settings.theme = r.theme;
    s.settings.sound = bool(r.sound, s.settings.sound);
    s.settings.vibration = bool(r.vibration, s.settings.vibration);
    s.settings.animations = bool(r.animations, s.settings.animations);
  }

  if (isObj(raw.number)) {
    const r = raw.number;
    const n = s.number;
    n.from = clampInt(r.from, -BOUND, BOUND, n.from);
    n.to = clampInt(r.to, -BOUND, BOUND, n.to);
    const lo = Math.min(n.from, n.to);
    const hi = Math.max(n.from, n.to);
    n.noRepeat = bool(r.noRepeat, false) && hi - lo + 1 <= 100000;
    n.drawn = n.noRepeat ? cleanDrawn(r.drawn, lo, hi) : [];
    n.count = clampInt(r.count, 1, 100, 1);
    n.sort = bool(r.sort, false);
    n.allowDupes = bool(r.allowDupes, false);
  }

  if (Array.isArray(raw.lists)) {
    const seen = new Set();
    s.lists = [];
    for (const item of raw.lists) {
      const l = normalizeList(item);
      if (!l || seen.has(l.id)) continue;
      seen.add(l.id);
      s.lists.push(l);
    }
  }

  if (isObj(raw.dice)) {
    const count = clampInt(raw.dice.count, 1, 6, 2);
    const vals = Array.isArray(raw.dice.values) ? raw.dice.values : [];
    s.dice.count = count;
    s.dice.values = Array.from({ length: count }, (_, i) => clampInt(vals[i], 1, 6, 1));
  }

  if (isObj(raw.coin)) {
    s.coin.heads = clampInt(raw.coin.heads, 0, Number.MAX_SAFE_INTEGER, 0);
    s.coin.tails = clampInt(raw.coin.tails, 0, Number.MAX_SAFE_INTEGER, 0);
    s.coin.last = raw.coin.last === 'heads' || raw.coin.last === 'tails' ? raw.coin.last : null;
  }

  if (isObj(raw.lots)) {
    s.lots.n = clampInt(raw.lots.n, 2, 30, 6);
    s.lots.k = clampInt(raw.lots.k, 1, s.lots.n - 1, 1);
  }

  if (isObj(raw.history)) {
    for (const key of Object.keys(raw.history)) {
      if (key === '__proto__' || !Array.isArray(raw.history[key])) continue;
      s.history[key] = raw.history[key]
        .filter((e) => isObj(e) && isInt(e.t) && typeof e.text === 'string')
        .slice(0, 20)
        .map((e) => ({ t: e.t, text: e.text }));
    }
  }
  return s;
}

function readStorage() {
  try {
    return JSON.parse(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}

let state = normalize(readStorage());
const subscribers = new Set();
let saveErrorHandler = null;
let saveErrorShown = false;

export function setSaveErrorHandler(fn) { saveErrorHandler = fn; }

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    if (!saveErrorShown) {
      saveErrorShown = true;
      saveErrorHandler?.();
    }
  }
}

export function getState() { return state; }

export function update(fn) {
  fn(state);
  save();
  for (const s of [...subscribers]) s(state);
}

export function subscribe(fn) {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function addHistory(key, text) {
  update((s) => {
    const arr = s.history[key] || (s.history[key] = []);
    arr.unshift({ t: Date.now(), text });
    arr.length = Math.min(arr.length, 20);
  });
}

export function clearHistory(key) {
  update((s) => { delete s.history[key]; });
}

export function deleteList(id) {
  update((s) => {
    s.lists = s.lists.filter((l) => l.id !== id);
    delete s.history['list:' + id];
  });
}

// Wipes storage and resets memory WITHOUT writing back (caller reloads).
export function clearAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  state = normalize(null);
}
