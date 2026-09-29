// App state: one localStorage key, normalized on load.
import { CONFIG_DEFAULTS, CONFIG_TOOLS, cleanConfig, BUILTIN_LISTS } from './tools.js';
import { randInt } from './rng.js';

const KEY = 'random:state';
const VERSION = 2;

export const DEFAULTS = {
  version: VERSION,
  settings: { theme: 'system', sound: true, vibration: true, animations: true },
  number: { from: 1, to: 10, noRepeat: false, drawn: [], count: 1, sort: false, allowDupes: false },
  lists: [{
    id: 'default-answer', name: 'Random answer',
    items: ['Yes', 'No', 'Maybe', 'Ask again later'],
    noRepeat: false, drawn: [], pickCount: 1,
  }],
  dice: { count: 2, sides: 6, modifier: 0, values: [1, 1] },
  coin: { heads: 0, tails: 0, last: null, run: 0, best: 0, bestFace: null },
  lots: { n: 6, k: 1 },
  teams: { ...CONFIG_DEFAULTS.teams },
  shuffle: { ...CONFIG_DEFAULTS.shuffle },
  wheel: { ...CONFIG_DEFAULTS.wheel },
  lottery: { ...CONFIG_DEFAULTS.lottery },
  cards: { ...CONFIG_DEFAULTS.cards, drawn: [] },
  presets: [], // [{ id, tool, name, config, t }] in creation order
  history: {},
};

// MIGRATIONS[v] upgrades a state of version v to v + 1.
const MIGRATIONS = [
  (raw) => raw, // 0 -> 1: unversioned data is already compatible
  (raw) => ({ ...raw, version: 2 }), // 1 -> 2: new sections are filled from defaults by normalize()
];

export const MAX_PRESETS_PER_TOOL = 20;
export const MAX_PRESETS = 100;

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

function normalizePresets(arr) {
  const ids = new Set();
  const perTool = {};
  const out = [];
  for (const p of arr) {
    if (out.length >= MAX_PRESETS) break;
    if (!isObj(p) || typeof p.id !== 'string' || !/^[\w-]{1,64}$/.test(p.id) || ids.has(p.id)) continue;
    if (!CONFIG_TOOLS.includes(p.tool) || typeof p.name !== 'string' || !isObj(p.config)) continue;
    const name = p.name.trim().slice(0, 60);
    if (!name) continue;
    if ((perTool[p.tool] || 0) >= MAX_PRESETS_PER_TOOL) continue;
    ids.add(p.id);
    perTool[p.tool] = (perTool[p.tool] || 0) + 1;
    out.push({
      id: p.id, tool: p.tool, name,
      config: cleanConfig(p.tool, p.config, { lenient: true }),
      t: typeof p.t === 'number' && Number.isFinite(p.t) ? p.t : 0,
    });
  }
  return out;
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
    const count = clampInt(raw.dice.count, 1, 12, 2);
    const sides = clampInt(raw.dice.sides, 2, 100, 6);
    const vals = Array.isArray(raw.dice.values) ? raw.dice.values : [];
    s.dice.count = count;
    s.dice.sides = sides;
    s.dice.modifier = clampInt(raw.dice.modifier, -99, 99, 0);
    s.dice.values = Array.from({ length: count }, (_, i) => clampInt(vals[i], 1, sides, 1));
  }

  if (isObj(raw.coin)) {
    s.coin.heads = clampInt(raw.coin.heads, 0, Number.MAX_SAFE_INTEGER, 0);
    s.coin.tails = clampInt(raw.coin.tails, 0, Number.MAX_SAFE_INTEGER, 0);
    s.coin.last = raw.coin.last === 'heads' || raw.coin.last === 'tails' ? raw.coin.last : null;
    const run = clampInt(raw.coin.run, 0, Number.MAX_SAFE_INTEGER, 0);
    s.coin.run = s.coin.last ? Math.max(1, run) : 0;
    s.coin.best = Math.max(clampInt(raw.coin.best, 0, Number.MAX_SAFE_INTEGER, 0), s.coin.run);
    s.coin.bestFace = raw.coin.bestFace === 'heads' || raw.coin.bestFace === 'tails' ? raw.coin.bestFace : null;
    if (s.coin.best > 0 && !s.coin.bestFace) s.coin.bestFace = s.coin.last;
  }

  if (isObj(raw.lots)) {
    s.lots.n = clampInt(raw.lots.n, 2, 30, 6);
    s.lots.k = clampInt(raw.lots.k, 1, s.lots.n - 1, 1);
  }

  for (const tool of ['teams', 'shuffle', 'wheel', 'lottery', 'cards']) {
    if (!isObj(raw[tool])) continue;
    const c = cleanConfig(tool, raw[tool], { lenient: true });
    s[tool] = tool === 'cards' ? { ...c, drawn: cleanDrawn(raw.cards.drawn, 0, c.jokers ? 53 : 51) } : c;
  }

  if (Array.isArray(raw.presets)) s.presets = normalizePresets(raw.presets);

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

const newId = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + randInt(0, 2 ** 31).toString(36);

// Returns the new preset id, or null when a limit is hit.
export function addPreset(tool, name, config) {
  const ps = state.presets;
  if (ps.length >= MAX_PRESETS || ps.filter((p) => p.tool === tool).length >= MAX_PRESETS_PER_TOOL) return null;
  const id = newId();
  update((s) => {
    s.presets.push({
      id, tool, name: name.trim().slice(0, 60),
      config: cleanConfig(tool, config, { lenient: true }), t: Date.now(),
    });
  });
  return id;
}

export const getPreset = (id) => state.presets.find((p) => p.id === id) || null;

export function updatePreset(id, config) {
  update((s) => {
    const p = s.presets.find((x) => x.id === id);
    if (p) p.config = cleanConfig(p.tool, config, { lenient: true });
  });
}

export function renamePreset(id, name) {
  update((s) => {
    const p = s.presets.find((x) => x.id === id);
    const n = name.trim().slice(0, 60);
    if (p && n) p.name = n;
  });
}

export function deletePreset(id) {
  update((s) => { s.presets = s.presets.filter((p) => p.id !== id); });
}

export function renameList(id, name) {
  update((s) => {
    const l = s.lists.find((x) => x.id === id);
    const n = name.trim().slice(0, 60);
    if (l && n) l.name = n;
  });
}

// Creates the builtin list when it is missing. Returns the list or null.
export function ensureBuiltinList(id) {
  const existing = state.lists.find((l) => l.id === id);
  if (existing) return existing;
  const b = Object.hasOwn(BUILTIN_LISTS, id) ? BUILTIN_LISTS[id] : null;
  if (!b) return null;
  update((s) => { s.lists.push({ id, name: b.name, items: [...b.items], noRepeat: false, drawn: [], pickCount: 1 }); });
  return state.lists.find((l) => l.id === id);
}

// Wipes storage and resets memory WITHOUT writing back (caller reloads).
export function clearAll() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  state = normalize(null);
}
