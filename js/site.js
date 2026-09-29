// Landing-page support: entry route, presets, Home flag.
// Top-level code must not touch the DOM (node tests and the build import this file).
import { getState, update } from './store.js';
import { beforeMount, currentPath } from './router.js';
import { SCHEMAS, CONFIG_DEFAULTS, cleanConfig, extractConfig, applyConfig } from './tools.js';

const TOOL_PRESETS = ['dice', 'lots', 'lottery', 'cards'];

const BOUND = 1e9;
const isBoundedInt = (v) => Number.isInteger(v) && Math.abs(v) <= BOUND;

export function getEntry() {
  const e = document.documentElement.dataset.entry;
  return typeof e === 'string' && /^\/[a-z0-9\/-]*$/.test(e) ? e : '/';
}

// Pure: returns a validated preset object or null. Never throws.
export function parsePreset(json) {
  try {
    const raw = typeof json === 'string' ? JSON.parse(json) : json;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    if (raw.number !== undefined) {
      const { from, to } = raw.number || {};
      if (!isBoundedInt(from) || !isBoundedInt(to)) return null;
      return { number: from > to ? { from: to, to: from } : { from, to } };
    }

    if (raw.list !== undefined) {
      const { id, name, items } = raw.list || {};
      if (typeof id !== 'string' || !/^preset-[a-z0-9-]{1,40}$/.test(id)) return null;
      if (typeof name !== 'string' || !name.trim()) return null;
      if (!Array.isArray(items) || !items.every((i) => typeof i === 'string')) return null;
      const clean = items.map((i) => i.trim()).filter(Boolean).map((i) => i.slice(0, 200)).slice(0, 500);
      return { list: { id, name: name.trim().slice(0, 60), items: clean } };
    }

    // Tool shapes: exactly one top-level key, a partial config with schema keys only.
    const keys = Object.keys(raw);
    if (keys.length === 1 && TOOL_PRESETS.includes(keys[0])) {
      const tool = keys[0];
      const partial = raw[tool];
      if (!partial || typeof partial !== 'object' || Array.isArray(partial)) return null;
      const known = new Set(SCHEMAS[tool].map((f) => f[0]));
      if (!Object.keys(partial).every((k) => known.has(k))) return null;
      const cleaned = cleanConfig(tool, { ...CONFIG_DEFAULTS[tool], ...partial });
      if (!cleaned) return null;
      return { [tool]: Object.fromEntries(Object.keys(partial).map((k) => [k, cleaned[k]])) };
    }
    return null;
  } catch {
    return null;
  }
}

// Applies data-preset on a fresh landing (empty hash) only.
export function applyPreset() {
  if (location.hash !== '' && location.hash !== '#') return;
  const preset = parsePreset(document.documentElement.dataset.preset ?? '');
  if (!preset) return;

  if (preset.number) {
    const { from, to } = preset.number;
    const n = getState().number;
    if (n.from !== from || n.to !== to) {
      update((s) => {
        s.number.from = from;
        s.number.to = to;
        s.number.drawn = [];
        if (to - from + 1 > 100000) s.number.noRepeat = false;
      });
    }
  } else if (preset.list) {
    const { id, name, items } = preset.list;
    if (!getState().lists.some((l) => l.id === id)) {
      update((s) => { s.lists.push({ id, name, items, noRepeat: false, drawn: [], pickCount: 1 }); });
    }
  } else {
    const tool = Object.keys(preset)[0];
    const st = getState()[tool];
    const next = { ...extractConfig(tool, st), ...preset[tool] };
    if (Object.keys(preset[tool]).some((k) => st[k] !== next[k])) update((s) => { applyConfig(tool, s[tool], next); });
  }
}

// Marks the Home route so the ad dock (Home only) can show without shifting layout.
export function initHomeFlag() {
  const html = document.documentElement;
  beforeMount(() => html.toggleAttribute('data-home', currentPath() === '/'));
}
