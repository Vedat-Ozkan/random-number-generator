// DOM helpers and shared components.
import { getState, update } from './store.js';
import { randInt } from './rng.js';
import { back, beforeMount } from './router.js';

export const PALETTE = ['#7B1FA2', '#C2185B', '#D32F2F', '#E64A19', '#00796B', '#388E3C', '#1976D2', '#303F9F', '#6A4FB6', '#0097A7'];

export const motionOn = () => document.documentElement.dataset.motion !== 'off';

let uidCounter = 0;
const uid = (p = 'u') => `${p}${++uidCounter}`;

/* ---------- h() ---------- */
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  const { class: cls, attrs, on, text, style } = props || {};
  if (cls) el.className = cls;
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  if (on) for (const [ev, fn] of Object.entries(on)) el.addEventListener(ev, fn);
  if (text !== undefined) el.textContent = text;
  if (style) {
    for (const [k, v] of Object.entries(style)) {
      if (k.startsWith('--')) el.style.setProperty(k, v);
      else el.style[k] = v;
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

/* ---------- icons (static SVG strings only) ---------- */
const svg = (inner) =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
  inner + '</svg>';

export const icons = {
  back: svg('<path d="M19 12H5M12 5l-7 7 7 7"/>'),
  settings: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  refresh: svg('<path d="M21 4v6h-6M3 20v-6h6"/><path d="M4.5 9a8 8 0 0 1 13.6-2.9L21 10M3 14l2.9 3.9A8 8 0 0 0 19.5 15"/>'),
  volumeOn: svg('<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/>'),
  volumeOff: svg('<path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M22 9l-6 6M16 9l6 6"/>'),
  more: svg('<circle cx="12" cy="5" r="1.6" fill="currentColor"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/><circle cx="12" cy="19" r="1.6" fill="currentColor"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  minus: svg('<path d="M5 12h14"/>'),
  history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
  tune: svg('<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>'),
  number: svg('<path d="M5 9h14M5 15h14M10 3L8 21M16 3l-2 18"/>'),
  list: svg('<path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/>'),
  dice: svg('<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/>'),
  lots: svg('<path d="M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z"/><path d="M14 8v1.5M14 11.3v1.4M14 14.5V16"/>'),
  coin: svg('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5.5"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/>'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 10v6M14 10v6"/>'),
  edit: svg('<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  heart: svg('<path d="M12 20.5s-7-4.3-9.2-8.3C1.2 9.1 3 5.5 6.6 5.5c2.1 0 3.6 1.1 5.4 3 1.8-1.9 3.3-3 5.4-3 3.6 0 5.4 3.6 3.8 6.7C19 16.2 12 20.5 12 20.5z"/>'),
  star: svg('<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z" fill="currentColor"/>'),
};

export function icon(name, cls = '') {
  const s = h('span', { class: ('icon ' + cls).trim(), attrs: { 'aria-hidden': 'true' } });
  s.innerHTML = icons[name]; // static, trusted SVG only
  return s;
}

export function iconButton({ icon: name, label, onClick, cls = '', pressed }) {
  const b = h('button', {
    class: ('icon-btn ' + cls).trim(),
    attrs: { type: 'button', 'aria-label': label, 'aria-pressed': pressed === undefined ? null : String(pressed) },
    on: onClick ? { click: onClick } : {},
  }, icon(name));
  return b;
}

/* ---------- top bar / FAB / pill ---------- */
export function topBar({ title, showBack = true, actions = [] }) {
  return h('header', { class: 'topbar' },
    showBack ? iconButton({ icon: 'back', label: 'Back', onClick: back, cls: 'topbar-back' }) : null,
    h('h1', { attrs: { tabindex: '-1' }, text: title }),
    h('div', { class: 'topbar-actions' }, ...actions));
}

export function historyButton(onClick) {
  return iconButton({ icon: 'history', label: 'History', onClick });
}

export function soundToggle() {
  const on = () => getState().settings.sound;
  const btn = iconButton({
    icon: on() ? 'volumeOn' : 'volumeOff', label: 'Sound', pressed: on(),
    onClick: () => {
      update((s) => { s.settings.sound = !s.settings.sound; });
      paint();
    },
  });
  function paint() {
    btn.setAttribute('aria-pressed', String(on()));
    btn.replaceChildren(icon(on() ? 'volumeOn' : 'volumeOff'));
  }
  return btn;
}

export function fab({ label, onClick, disabled = false }) {
  return h('button', {
    class: 'fab' + (disabled ? ' disabled' : ''),
    attrs: { type: 'button', 'aria-label': label, 'aria-disabled': disabled ? 'true' : null },
    on: { click: onClick },
  }, icon('refresh'));
}

export function paramsPill(onClick) {
  return h('button', { class: 'pill', attrs: { type: 'button' }, on: { click: onClick } },
    icon('tune'), h('span', { text: 'Parameters' }));
}

/* ---------- toast + live region ---------- */
let toastEl = null;
let toastTimer = 0;

export function toast(text) {
  if (!toastEl) {
    toastEl = h('div', { class: 'toast', attrs: { role: 'status', popover: 'manual' } });
    document.body.append(toastEl);
  }
  toastEl.textContent = text;
  try {
    // Top layer, so it stays visible above modal dialogs.
    if (toastEl.matches(':popover-open')) toastEl.hidePopover();
    toastEl.showPopover();
  } catch { /* popover API unsupported */ }
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    try { toastEl.hidePopover(); } catch { /* ignore */ }
  }, 2500);
}

export function announce(text) {
  const live = document.getElementById('live');
  if (!live) return;
  live.textContent = '';
  requestAnimationFrame(() => { live.textContent = text; });
}

export async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = h('textarea', { attrs: { 'aria-hidden': 'true', readonly: '' }, style: { position: 'fixed', opacity: '0', left: '-9999px' } });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      if (!ok) throw new Error('copy failed');
    }
    toast('Copied');
  } catch {
    toast('Copy failed');
  }
}

/* ---------- switch / stepper ---------- */
export function makeSwitch({ checked = false, labelledby, label }) {
  const b = h('button', {
    class: 'switch',
    attrs: { type: 'button', role: 'switch', 'aria-checked': String(checked), 'aria-labelledby': labelledby, 'aria-label': labelledby ? null : label },
  }, h('span', { class: 'thumb' }));
  b.setChecked = (v) => b.setAttribute('aria-checked', String(!!v));
  b.isChecked = () => b.getAttribute('aria-checked') === 'true';
  return b;
}

export function switchRow({ label, hint, checked = false, disabled = false, onChange }) {
  const id = uid('sw');
  const sw = makeSwitch({ checked, labelledby: id });
  const hintEl = h('div', { class: 'row-hint' });
  const row = h('div', {
    class: 'row switch-row',
    on: {
      click: () => {
        if (sw.disabled) return;
        const v = !sw.isChecked();
        sw.setChecked(v);
        onChange?.(v);
      },
    },
  }, h('div', { class: 'row-text' }, h('div', { class: 'row-label', attrs: { id }, text: label }), hintEl), sw);
  const api = {
    el: row,
    set: (v) => sw.setChecked(v),
    setHint: (t) => { hintEl.textContent = t || ''; hintEl.hidden = !t; },
    setDisabled: (d) => { sw.disabled = d; row.classList.toggle('disabled', d); },
  };
  api.setHint(hint);
  api.setDisabled(disabled);
  return api;
}

export function stepper({ label, value, min, max, onChange, format = String }) {
  let v = value;
  let lo = min;
  let hi = max;
  const dec = h('button', { class: 'step-btn', attrs: { type: 'button', 'aria-label': `Decrease ${label}` }, on: { click: () => change(v - 1) } }, icon('minus'));
  const inc = h('button', { class: 'step-btn', attrs: { type: 'button', 'aria-label': `Increase ${label}` }, on: { click: () => change(v + 1) } }, icon('plus'));
  const val = h('span', { class: 'step-value', attrs: { 'aria-live': 'polite' } });
  function paint() {
    val.textContent = format(v);
    dec.disabled = v <= lo;
    inc.disabled = v >= hi;
  }
  function change(n) {
    n = Math.min(hi, Math.max(lo, n));
    if (n === v) return;
    v = n;
    paint();
    onChange(v);
  }
  paint();
  return {
    el: h('div', { class: 'stepper' }, dec, val, inc),
    set(n) { v = Math.min(hi, Math.max(lo, n)); paint(); },
    setRange(l, hgh) { lo = l; hi = hgh; v = Math.min(hi, Math.max(lo, v)); paint(); },
  };
}

/* ---------- popover menu ---------- */
let menuEl = null;
let lastMenuAnchor = null;
let menuClosedAt = 0;

export const isMenuOpen = () => !!menuEl;

function onMenuPointerDown(e) {
  if (menuEl && !menuEl.contains(e.target)) closeMenu();
}

export function closeMenu(restoreFocus = false) {
  if (!menuEl) return;
  document.removeEventListener('pointerdown', onMenuPointerDown, true);
  lastMenuAnchor?.setAttribute('aria-expanded', 'false');
  menuEl.remove();
  menuEl = null;
  menuClosedAt = Date.now();
  if (restoreFocus && lastMenuAnchor?.isConnected) lastMenuAnchor.focus({ preventScroll: true });
}

export function openMenu(anchor, items) {
  const toggleOff = lastMenuAnchor === anchor && Date.now() - menuClosedAt < 250;
  closeMenu();
  if (toggleOff) return;
  lastMenuAnchor = anchor;
  anchor.setAttribute('aria-expanded', 'true');
  menuEl = h('div', { class: 'menu', attrs: { role: 'menu' } },
    items.map((it) => h('button', {
      class: 'menu-item' + (it.danger ? ' danger' : ''),
      attrs: { type: 'button', role: 'menuitem', disabled: it.disabled ? true : null },
      on: { click: () => { closeMenu(true); it.onClick?.(); } },
      text: it.label,
    })));
  document.body.append(menuEl);
  const r = anchor.getBoundingClientRect();
  const w = menuEl.offsetWidth;
  const mh = menuEl.offsetHeight;
  const left = Math.min(Math.max(r.right - w, 8), window.innerWidth - w - 8);
  let top = r.bottom + 4;
  if (top + mh > window.innerHeight - 8) top = Math.max(8, r.top - mh - 4);
  menuEl.style.left = `${left + window.scrollX}px`;
  menuEl.style.top = `${top + window.scrollY}px`;
  document.addEventListener('pointerdown', onMenuPointerDown, true);
  menuEl.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
}

/* ---------- bottom sheet / confirm ---------- */
export function openSheet({ title, subtitle, body, actions, onClose }) {
  const dlg = h('dialog', { class: 'sheet', attrs: { 'aria-label': title } });
  const done = h('button', { class: 'btn filled', attrs: { type: 'button' }, text: 'Done', on: { click: () => dlg.close() } });
  dlg.append(h('div', { class: 'sheet-body' },
    h('div', { class: 'sheet-handle', attrs: { 'aria-hidden': 'true' } }),
    h('div', { class: 'sheet-head' }, h('h2', { text: title }), subtitle ? h('span', { class: 'sheet-sub', text: subtitle }) : null),
    body,
    h('div', { class: 'sheet-actions' }, ...(actions || [done]))));
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
  dlg.addEventListener('close', () => { dlg.remove(); onClose?.(); });
  document.body.append(dlg);
  dlg.showModal();
  return dlg;
}

export function confirmDialog({ message, confirmLabel = 'Delete', danger = true }) {
  return new Promise((resolve) => {
    const id = uid('cf');
    const dlg = h('dialog', { class: 'confirm', attrs: { 'aria-labelledby': id } },
      h('p', { attrs: { id }, text: message }),
      h('div', { class: 'confirm-actions' },
        h('button', { class: 'btn', attrs: { type: 'button' }, text: 'Cancel', on: { click: () => dlg.close('cancel') } }),
        h('button', { class: 'btn filled' + (danger ? ' danger' : ''), attrs: { type: 'button' }, text: confirmLabel, on: { click: () => dlg.close('ok') } })));
    dlg.addEventListener('close', () => { const ok = dlg.returnValue === 'ok'; dlg.remove(); resolve(ok); });
    document.body.append(dlg);
    dlg.showModal();
  });
}

/* ---------- No repeat card ---------- */
export function noRepeatCard({ onToggle, onReset }) {
  const id = uid('nr');
  let on = false;
  let drawn = 0;
  const sw = makeSwitch({ labelledby: id });
  const counter = h('span', { class: 'nr-counter' });
  const more = iconButton({
    icon: 'more', label: 'Pool options',
    onClick: () => openMenu(more, [{
      label: 'Reset pool', disabled: !on || drawn === 0,
      onClick: () => { onReset(); toast('Pool reset'); },
    }]),
  });
  more.setAttribute('aria-haspopup', 'menu');
  const el = h('div', { class: 'card nr-card' },
    h('div', { class: 'nr-main', on: { click: () => onToggle(!on) } }, sw, h('span', { class: 'nr-label', attrs: { id }, text: 'No repeat' })),
    counter, more);
  return {
    el,
    update(s) {
      on = s.on; drawn = s.drawn;
      sw.setChecked(on);
      counter.textContent = on ? `${s.drawn} / ${s.total}` : 'Off';
      counter.classList.toggle('muted', !on);
    },
  };
}

/* ---------- result overlay ---------- */
let ov = null;
let card = null;
let copyBtn = null;
let cur = { text: '', again: null, ret: null };
let lastColor = -1;

function ensureOverlay() {
  if (ov) return;
  card = h('div', { class: 'result-card', attrs: { tabindex: '0' }, on: { click: () => cur.again?.() } });
  copyBtn = iconButton({ icon: 'copy', label: 'Copy result', cls: 'result-copy', onClick: () => copyText(cur.text) });
  ov = h('div', {
    class: 'result-overlay',
    attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Result' },
    on: { click: (e) => { if (e.target === ov) closeResult(); } },
  }, card, copyBtn);
  ov.hidden = true;
  document.body.append(ov);
}

export const isResultOpen = () => !!ov && !ov.hidden;

// Keep keyboard/AT focus out of the page behind the modal overlay; the FAB stays live.
function setBackgroundInert(on) {
  const app = document.getElementById('app');
  const targets = [...(app ? app.children : []), document.getElementById('below')];
  for (const el of targets) {
    if (el && !el.classList.contains('fab')) el.inert = on;
  }
}

function resultFontSize(values, lines) {
  const text = values.join(lines ? '\n' : ', ');
  if (!lines && values.length === 1 && text.length <= 4) return 'clamp(64px, 22vw, 140px)';
  if (text.length <= 12) return '48px';
  if (text.length <= 40) return '32px';
  return '22px';
}

export function showResult({ values, lines = false, onAgain, returnFocus }) {
  ensureOverlay();
  const wasOpen = isResultOpen();
  let i;
  do { i = randInt(0, PALETTE.length - 1); } while (i === lastColor);
  lastColor = i;
  cur = { text: values.join(lines ? '\n' : ', '), again: onAgain, ret: returnFocus || cur.ret };

  card.style.background = PALETTE[i];
  card.style.fontSize = resultFontSize(values, lines);
  card.classList.toggle('lines', lines);
  card.replaceChildren(h('div', { class: 'result-inner' }, ...values.map((v) => h('span', { class: 'result-val', text: v }))));
  card.scrollTop = 0;
  ov.hidden = false;
  setBackgroundInert(true);
  ov.classList.toggle('enter', !wasOpen);
  card.classList.remove('pop');
  void card.offsetWidth; // restart animation
  card.classList.add('pop');
  if (!wasOpen) card.focus({ preventScroll: true });
  announce(cur.text.replace(/\n/g, ', '));
}

export function closeResult(restoreFocus = true) {
  if (!isResultOpen()) return;
  ov.hidden = true;
  setBackgroundInert(false);
  if (restoreFocus && cur.ret?.isConnected) cur.ret.focus({ preventScroll: true });
}

export function closeAllOverlays() {
  closeMenu();
  closeResult(false);
  document.querySelectorAll('dialog[open]').forEach((d) => d.close());
}

beforeMount(closeAllOverlays);
