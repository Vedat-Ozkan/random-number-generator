import { h, topBar, fab, stepper, chipRow, openSheet, announce, toast, motionOn } from '../ui.js';
import { getState, update, addHistory } from '../store.js';
import { randInt } from '../rng.js';
import { rollClicks, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { parseDice, formatDice } from '../parse.js';
import { extractConfig, applyConfig } from '../tools.js';
import { initTool, toolChrome, share } from '../presets.js';

const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const SIDE_CHIPS = [4, 6, 8, 10, 12, 20, 100];
const dieSize = (n) => (n <= 2 ? 112 : n <= 4 ? 96 : n <= 6 ? 80 : 64);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const dice = () => getState().dice;
const signed = (m) => (m < 0 ? `−${-m}` : `+${m}`);

function dieEl(size) {
  return h('div', { class: 'die', attrs: { role: 'img' }, style: { '--die': `${size}px` } });
}

function paintDie(el, value, sides) {
  if (sides === 6) {
    el.classList.remove('numeric');
    el.setAttribute('aria-label', `Die showing ${value}`);
    el.replaceChildren(...PIPS[value].map((c) => h('span', {
      class: 'pip', style: { gridRow: String(Math.floor(c / 3) + 1), gridColumn: String((c % 3) + 1) },
    })));
  } else {
    el.classList.add('numeric');
    el.setAttribute('aria-label', `d${sides} showing ${value}`);
    el.replaceChildren(h('span', { class: 'die-num', text: String(value) }));
  }
}

export function render(root, params = {}) {
  const init = initTool('dice', params);
  if (!init) return;
  let timers = [];
  let els = [];
  let pending = null; // values of an in-flight roll awaiting settle()
  let lastTotal = null;
  let sheet = null; // live Parameters controls, or null
  const notation = () => formatDice(dice());
  const chrome = toolChrome({
    tool: 'dice', preset: init.preset, title: 'Dice', historyKey: 'dice',
    shareText: () => (lastTotal === null ? '' : `Dice ${notation()}: ${lastTotal}`),
  });
  const area = h('div', { class: 'dice-area', on: { click: () => roll() } });
  const chip = h('button', { class: 'notation-chip', attrs: { type: 'button' }, on: { click: () => openParams() } });
  const totalEl = h('div', { class: 'dice-total' });
  const clearTimers = () => { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; };

  const breakdown = (values, mod) => values.join(' + ') + (mod ? ` ${mod < 0 ? '−' : '+'} ${Math.abs(mod)}` : '');

  function paintTotal() {
    const { values, modifier } = dice();
    chip.textContent = notation();
    chip.setAttribute('aria-label', `Dice ${notation()}, open parameters`);
    const show = values.length > 1 || modifier !== 0;
    totalEl.hidden = !show;
    if (!show) return;
    totalEl.replaceChildren(
      h('div', { class: 'total-main', text: `Total ${sum(values) + modifier}` }),
      h('div', { class: 'total-sub', text: breakdown(values, modifier) }));
  }

  function build() {
    pending = null;
    clearTimers();
    const { values, sides } = dice();
    const size = dieSize(values.length);
    els = values.map((v) => { const d = dieEl(size); paintDie(d, v, sides); return d; });
    area.replaceChildren(...els);
    paintTotal();
  }

  function settle(values) {
    pending = null;
    clearTimers();
    const { sides, modifier } = dice();
    els.forEach((d, i) => {
      d.classList.remove('rolling', 'settle');
      paintDie(d, values[i], sides);
      if (motionOn()) {
        void d.offsetWidth;
        d.style.animationDelay = `${i * 30}ms`;
        d.classList.add('settle');
      }
    });
    paintTotal();
    vibrate(20);
    const total = sum(values) + modifier;
    lastTotal = total;
    const text = values.length === 1 && !modifier
      ? (sides === 6 ? String(values[0]) : `${notation()}: ${values[0]}`)
      : `${notation()}: ${breakdown(values, modifier)} = ${total}`;
    addHistory('dice', text);
    announce(values.length === 1 && !modifier
      ? `Rolled ${values[0]}`
      : `Rolled ${values.join(', ')}.${modifier ? ` ${modifier < 0 ? 'Minus' : 'Plus'} ${Math.abs(modifier)}.` : ''} Total ${total}`);
  }

  function roll() {
    if (pending) settle(pending); // don't lose the in-flight roll's history/announcement
    clearTimers();
    const { sides } = dice();
    const values = els.map(() => randInt(1, sides));
    update((s) => { s.dice.values = values; });
    rollClicks();
    if (!motionOn()) { settle(values); return; }
    pending = values;
    els.forEach((d) => { d.classList.remove('rolling'); void d.offsetWidth; d.classList.add('rolling'); });
    timers.push(setInterval(() => els.forEach((d) => paintDie(d, randInt(1, sides), sides)), 70));
    timers.push(setTimeout(() => settle(values), 500));
  }

  const count = stepper({
    label: 'dice', value: dice().count, min: 1, max: 12,
    format: (v) => `${v} ${v === 1 ? 'die' : 'dice'}`,
    onChange: (v) => applyPatch({ count: v }),
  });

  function syncControls() {
    count.set(dice().count);
    if (sheet) sheet.sync();
  }

  function applyPatch(patch) {
    if (pending) settle(pending); // record the in-flight roll before the die set changes
    update((s) => { applyConfig('dice', s.dice, { ...extractConfig('dice', s.dice), ...patch }); });
    build();
    syncControls();
  }

  function openParams() {
    const d = dice();
    const field = h('input', {
      class: 'field', attrs: { type: 'text', inputmode: 'text', autocapitalize: 'off', autocomplete: 'off', spellcheck: 'false', placeholder: 'e.g. 2d6+3', 'aria-label': 'Notation' },
    });
    field.value = notation();
    const applyField = () => {
      const parsed = parseDice(field.value);
      if (!parsed) {
        field.value = notation();
        toast('Use a format like 2d6+3 (1–12 dice, d2–d100, ±99)');
        return;
      }
      applyPatch(parsed);
    };
    field.addEventListener('change', applyField);
    field.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); applyField(); } });
    const sides = chipRow({
      label: 'Sides', options: SIDE_CHIPS.map((n) => [n, 'd' + n]),
      isOn: (n) => dice().sides === n, onPick: (n) => applyPatch({ sides: n }),
    });
    const mod = stepper({
      label: 'modifier', value: d.modifier, min: -99, max: 99,
      format: (v) => (v === 0 ? '0' : signed(v)),
      onChange: (v) => applyPatch({ modifier: v }),
    });
    sheet = {
      sync() { field.value = notation(); sides.paint(); mod.set(dice().modifier); },
    };
    openSheet({
      title: 'Parameters',
      body: h('div', { class: 'sheet-rows' },
        h('label', { class: 'field-caption sheet-field', text: 'Notation' }, field),
        h('div', { class: 'sheet-block' }, h('div', { class: 'row-label', text: 'Sides' }), sides.el),
        h('div', { class: 'row' }, h('div', { class: 'row-text' }, h('div', { class: 'row-label', text: 'Modifier' })), mod.el)),
      onClose: () => { sheet = null; },
    });
  }

  const fabEl = fab({ label: 'Roll', onClick: roll });
  root.append(
    topBar({ title: chrome.title, actions: chrome.actions }),
    h('div', { class: 'content' },
      chrome.bar,
      h('div', { class: 'center-area' }, area, chip, totalEl),
      h('div', { class: 'stepper-wrap' }, count.el)),
    fabEl);
  build();
  setPrimaryAction(roll);
  if (init.edit) requestAnimationFrame(openParams);
  return () => { if (pending) settle(pending); clearTimers(); chrome.cleanup(); };
}
