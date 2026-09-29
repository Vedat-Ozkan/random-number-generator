// Landing-page support: entry route, presets, below-the-fold section.
// Top-level code must not touch the DOM (node tests and the build import this file).
import { getState, update } from './store.js';
import { beforeMount, currentPath } from './router.js';

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
  }
}

// Shows the static #below section only on the page's own entry route and hides
// the FAB while it is on screen.
export function initBelow() {
  const below = document.getElementById('below');
  if (!below || !document.getElementById('app')) return;
  const html = document.documentElement;
  beforeMount(() => html.toggleAttribute('data-off-entry', currentPath() !== getEntry()));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      html.toggleAttribute('data-below', entries.some((e) => e.isIntersecting));
    }, { rootMargin: '0px 0px -120px 0px' }).observe(below);
  }
}
