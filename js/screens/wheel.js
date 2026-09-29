import { h, topBar, fab, announce, motionOn, PALETTE, resultActions, scrollToResult } from '../ui.js';
import { addHistory } from '../store.js';
import { randInt, weightedIndex } from '../rng.js';
import { click, ting, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { initTool, toolChrome, share } from '../presets.js';
import { sourceCard } from './source.js';

const NS = 'http://www.w3.org/2000/svg';
const MAX_ITEMS = 100;
const SPIN_MS = 4400;
const MIN_LABEL_DEG = 5.5;

const svgEl = (tag, attrs = {}, text) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  if (text !== undefined) el.textContent = text;
  return el;
};
const f = (n) => Number(n.toFixed(3));
// Point at clockwise angle `deg` from 12 o'clock, radius r.
const pt = (deg, r) => [f(r * Math.sin((deg * Math.PI) / 180)), f(-r * Math.cos((deg * Math.PI) / 180))];
const LABEL_OUTER = 92;
const LABEL_INNER = 30;

export function render(root, params = {}) {
  const init = initTool('wheel', params);
  if (!init) return;
  let lastText = '';
  let items = [];
  let segs = []; // [{ start, width }]
  let rotation = 0;
  let spinning = null; // { finish }
  const chrome = toolChrome({ tool: 'wheel', preset: init.preset, title: 'Wheel', historyKey: 'wheel', shareText: () => (lastText ? `Wheel: ${lastText}` : '') });

  const svg = svgEl('svg', { class: 'wheel', viewBox: '-110 -110 220 220', role: 'img' });
  const stage = h('div', { class: 'wheel-stage' }, svg, h('div', { class: 'wheel-pointer', attrs: { 'aria-hidden': 'true' } }), h('div', { class: 'wheel-hub', attrs: { 'aria-hidden': 'true' } }));
  const resultEl = h('div', { class: 'wheel-result', attrs: { 'aria-live': 'polite' } });
  const note = h('div', { class: 'muted hint wheel-note', attrs: { hidden: true }, text: 'Showing the first 100 items' });

  const actions = resultActions({ getText: () => lastText, onShare: () => share('wheel', () => `Wheel: ${lastText}`, init.preset) });
  const source = sourceCard({ tool: 'wheel', onChange: () => rebuild() });
  const fabEl = fab({ label: 'Spin', icon: 'wheel', onClick: () => spin() });

  function finishNow() { spinning?.finish(); }

  function rebuild() {
    finishNow();
    resultEl.textContent = '';
    const all = source.getItems();
    items = all.slice(0, MAX_ITEMS);
    note.hidden = all.length <= MAX_ITEMS;
    rotation = 0;
    svg.style.transition = 'none';
    svg.style.transform = 'rotate(0deg)';
    svg.replaceChildren();
    segs = [];
    const ok = items.length >= 2;
    fabEl.classList.toggle('disabled', !ok);
    fabEl.setAttribute('aria-disabled', ok ? 'false' : 'true');
    if (!ok) {
      svg.setAttribute('aria-label', 'Wheel, add at least 2 items');
      svg.append(svgEl('circle', { r: 100, class: 'wheel-empty' }),
        svgEl('text', { class: 'wheel-empty-text', 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 9 }, 'Add at least 2 items'),
        svgEl('circle', { r: 100, class: 'wheel-rim' }));
      return;
    }
    svg.setAttribute('aria-label', `Wheel with ${items.length} segments`);
    const total = items.reduce((a, it) => a + it.weight, 0);
    let a = 0;
    const paths = [];
    const labels = [];
    const fitQueue = [];
    items.forEach((it, i) => {
      const width = (it.weight / total) * 360;
      segs.push({ start: a, width });
      const [x1, y1] = pt(a, 100);
      const [x2, y2] = pt(a + width, 100);
      const color = i === items.length - 1 && items.length > 1 && (items.length - 1) % PALETTE.length === 0 ? PALETTE[5] : PALETTE[i % PALETTE.length];
      paths.push(svgEl('path', { class: 'wheel-seg', d: `M0 0 L${x1} ${y1} A100 100 0 ${width > 180 ? 1 : 0} 1 ${x2} ${y2} Z`, fill: color }));
      if (width >= MIN_LABEL_DEG) {
        const c = a + width / 2;
        const size = Math.min(11, Math.max(5, width * 0.35));
        const label = svgEl('text', {
          fill: '#fff', 'text-anchor': 'end', 'dominant-baseline': 'middle', 'font-weight': 600,
          'font-size': size, transform: `rotate(${f(c - 90)}) translate(92 0)`,
        }, it.text);
        labels.push(label);
        fitQueue.push([label, it.text]);
      }
      a += width;
    });
    svg.append(...paths, ...labels, svgEl('circle', { r: 100, class: 'wheel-rim' }));
    fitQueue.forEach(([el, text]) => fitLabel(el, text));
  }

  // Keeps each label between the hub (r~30) and the rim (r~92).
  function fitLabel(el, text) {
    const room = LABEL_OUTER - LABEL_INNER;
    let len = 0;
    try { len = el.getComputedTextLength(); } catch { return; }
    if (len === 0 || len <= room) return; // 0: not rendered, keep as is
    let lo = 1;
    let hi = text.length - 1;
    while (lo < hi) { // longest prefix (+ ellipsis) that fits
      const mid = Math.ceil((lo + hi) / 2);
      el.textContent = text.slice(0, mid).trimEnd() + '\u2026';
      if (el.getComputedTextLength() <= room) lo = mid; else hi = mid - 1;
    }
    el.textContent = text.slice(0, lo).trimEnd() + '\u2026';
  }

  function spin() {
    if (spinning || items.length < 2) return;
    const weights = items.map((it) => it.weight);
    const i = weightedIndex(weights); // decided by crypto RNG before any animation
    const { start, width } = segs[i];
    const target = start + width * (0.15 + (0.7 * randInt(0, 1000)) / 1000);
    const delta = ((((-target - rotation) % 360) + 360) % 360);
    rotation += 360 * 6 + delta;
    resultEl.textContent = '';
    const text = items[i].text;
    let timer = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      svg.removeEventListener('transitionend', onEnd);
      spinning = null;
      resultEl.textContent = text;
      lastText = text;
      ting();
      vibrate(20);
      addHistory('wheel', text.slice(0, 1000));
      announce(`Landed on ${text}`);
      actions.hidden = false;
      scrollToResult(resultEl);
    };
    const onEnd = (e) => { if (e.target === svg && e.propertyName === 'transform') finish(); };
    spinning = { finish };
    click();
    if (motionOn()) {
      svg.addEventListener('transitionend', onEnd);
      timer = setTimeout(finish, SPIN_MS + 200);
      svg.style.transition = `transform ${SPIN_MS}ms cubic-bezier(.12,.72,.14,1)`;
      void svg.getBoundingClientRect();
      svg.style.transform = `rotate(${rotation}deg)`;
    } else {
      svg.style.transition = 'none';
      svg.style.transform = `rotate(${rotation}deg)`;
      finish();
    }
  }

  root.append(
    topBar({ title: chrome.title, actions: chrome.actions }),
    h('div', { class: 'content tool-stack' }, chrome.bar,
      h('div', { class: 'wheel-wrap' }, stage, resultEl, actions, note),
      source.el),
    fabEl);
  rebuild();
  setPrimaryAction(spin);
  if (init.edit) requestAnimationFrame(() => source.focus());
  return () => { finishNow(); source.cleanup(); chrome.cleanup(); };
}
