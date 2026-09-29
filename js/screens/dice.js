import { h, topBar, historyButton, soundToggle, fab, stepper, announce, motionOn, PALETTE } from '../ui.js';
import { getState, update, addHistory } from '../store.js';
import { randInt } from '../rng.js';
import { rollClicks, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { openHistorySheet } from './history.js';

const PIPS = {
  1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8],
};
const dieSize = (n) => (n <= 2 ? 112 : n <= 4 ? 96 : 80);
const sum = (a) => a.reduce((x, y) => x + y, 0);

function dieEl(index, size) {
  return h('div', {
    class: 'die', attrs: { role: 'img' },
    style: { '--die': `${size}px`, background: PALETTE[(index * 3) % 10] },
  });
}

function paintDie(el, value) {
  el.setAttribute('aria-label', `Die showing ${value}`);
  el.replaceChildren(...PIPS[value].map((c) => h('span', {
    class: 'pip', style: { gridRow: String(Math.floor(c / 3) + 1), gridColumn: String((c % 3) + 1) },
  })));
}

export function render(root) {
  let timers = [];
  let dice = [];
  let pending = null; // values of an in-flight roll awaiting settle()
  const area = h('div', { class: 'dice-area', on: { click: () => roll() } });
  const totalEl = h('div', { class: 'dice-total' });
  const clearTimers = () => { timers.forEach((t) => { clearTimeout(t); clearInterval(t); }); timers = []; };

  function paintTotal() {
    const { values } = getState().dice;
    totalEl.textContent = `Total: ${sum(values)}`;
    totalEl.hidden = values.length <= 1;
  }

  function build() {
    pending = null;
    clearTimers();
    const { values } = getState().dice;
    const size = dieSize(values.length);
    dice = values.map((v, i) => { const d = dieEl(i, size); paintDie(d, v); return d; });
    area.replaceChildren(...dice);
    paintTotal();
  }

  function settle(values) {
    pending = null;
    clearTimers();
    dice.forEach((d, i) => { d.classList.remove('rolling'); paintDie(d, values[i]); });
    paintTotal();
    vibrate(20);
    const total = sum(values);
    addHistory('dice', values.length > 1 ? `${values.join(' + ')} = ${total}` : String(values[0]));
    announce(values.length > 1 ? `Rolled ${values.join(', ')}. Total ${total}` : `Rolled ${values[0]}`);
  }

  function roll() {
    if (pending) settle(pending); // don't lose the in-flight roll's history/announcement
    clearTimers();
    const values = dice.map(() => randInt(1, 6));
    update((s) => { s.dice.values = values; });
    rollClicks();
    if (!motionOn()) { settle(values); return; }
    pending = values;
    dice.forEach((d) => { d.classList.remove('rolling'); void d.offsetWidth; d.classList.add('rolling'); });
    timers.push(setInterval(() => dice.forEach((d) => paintDie(d, randInt(1, 6))), 70));
    timers.push(setTimeout(() => settle(values), 500));
  }

  const count = stepper({
    label: 'dice', value: getState().dice.count, min: 1, max: 6,
    format: (v) => `${v} ${v === 1 ? 'die' : 'dice'}`,
    onChange: (v) => {
      if (pending) settle(pending); // record the in-flight roll before the die set changes
      update((s) => { s.dice.count = v; s.dice.values = Array(v).fill(1); });
      build();
    },
  });

  const fabEl = fab({ label: 'Roll', onClick: roll });
  root.append(
    topBar({ title: 'Dice', actions: [historyButton(() => openHistorySheet('dice', 'Dice')), soundToggle()] }),
    h('div', { class: 'content' },
      h('div', { class: 'center-area' }, area, totalEl),
      h('div', { class: 'stepper-wrap' }, count.el)),
    fabEl);
  build();
  setPrimaryAction(roll);
  return () => { if (pending) settle(pending); clearTimers(); };
}
