import { h, topBar, historyButton, soundToggle, fab, paramsPill, noRepeatCard, openSheet, stepper, switchRow, showResult, toast } from '../ui.js';
import { getState, update, addHistory } from '../store.js';
import { draw } from '../rng.js';
import { click, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { openHistorySheet } from './history.js';

const LIMIT = 1e9;
const MAX_POOL = 100000;
const num = () => getState().number;
const total = () => Math.abs(num().to - num().from) + 1;

export function render(root) {
  const inputs = {};

  function bigInput(which, label) {
    const input = h('input', {
      class: 'big-input',
      attrs: { type: 'number', step: '1', inputmode: 'numeric', 'aria-label': label, autocomplete: 'off' },
      on: {
        change: () => commit(which),
        blur: () => commit(which),
        keydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } },
        input: () => sizeClass(input),
      },
    });
    input.value = num()[which];
    sizeClass(input);
    inputs[which] = input;
    return h('div', { class: 'field-group' }, h('div', { class: 'field-label', text: label }), input);
  }

  function sizeClass(input) {
    input.classList.toggle('long', input.value.length > 7);
  }

  function commit(which) {
    const input = inputs[which];
    const raw = input.value.trim();
    const n = Math.trunc(Number(raw));
    if (raw === '' || !Number.isFinite(n) || Math.abs(n) > LIMIT) {
      input.value = num()[which];
      sizeClass(input);
      toast('Enter a whole number between -1e9 and 1e9');
      return;
    }
    input.value = n;
    sizeClass(input);
    if (n === num()[which]) return;
    update((s) => { s.number[which] = n; s.number.drawn = []; });
    if (num().noRepeat && total() > MAX_POOL) {
      update((s) => { s.number.noRepeat = false; });
      toast('No repeat supports ranges up to 100,000 numbers');
    }
    refresh();
  }

  const pool = noRepeatCard({
    onToggle(want) {
      if (want && total() > MAX_POOL) {
        toast('No repeat supports ranges up to 100,000 numbers');
        refresh();
        return;
      }
      update((s) => { s.number.noRepeat = want; });
      refresh();
    },
    onReset() {
      update((s) => { s.number.drawn = []; });
      refresh();
    },
  });

  function refresh() {
    const n = num();
    pool.update({ on: n.noRepeat, drawn: n.drawn.length, total: total() });
  }

  function generate() {
    commit('from');
    commit('to');
    if (num().from > num().to) {
      update((s) => { [s.number.from, s.number.to] = [s.number.to, s.number.from]; });
      inputs.from.value = num().from;
      inputs.to.value = num().to;
      sizeClass(inputs.from);
      sizeClass(inputs.to);
    }
    const n = num();
    const r = draw({
      min: n.from, max: n.to, count: n.count, noRepeat: n.noRepeat,
      allowDupes: n.allowDupes, drawn: n.drawn, sort: n.sort, label: 'numbers',
    });
    update((s) => { s.number.drawn = r.drawn; });
    refresh();
    if (r.notes.length) toast(r.notes.join('. '));
    const texts = r.values.map(String);
    click();
    vibrate(15);
    addHistory('number', texts.join(', '));
    showResult({ values: texts, onAgain: generate, returnFocus: fabEl });
  }

  function openParams() {
    const n = num();
    const count = stepper({
      label: 'count', value: n.count, min: 1, max: 100,
      onChange: (v) => update((s) => { s.number.count = v; }),
    });
    const sort = switchRow({
      label: 'Sort results', checked: n.sort,
      onChange: (v) => update((s) => { s.number.sort = v; }),
    });
    const dupes = switchRow({
      label: 'Allow duplicates', checked: n.allowDupes,
      onChange: (v) => update((s) => { s.number.allowDupes = v; }),
    });
    if (n.noRepeat) { dupes.setDisabled(true); dupes.setHint('Not available with No repeat'); }
    openSheet({
      title: 'Parameters',
      body: h('div', { class: 'sheet-rows' },
        h('div', { class: 'row' }, h('div', { class: 'row-text' }, h('div', { class: 'row-label', text: 'How many numbers' })), count.el),
        sort.el, dupes.el),
    });
  }

  const fabEl = fab({ label: 'Generate', onClick: generate });

  root.append(
    topBar({ title: 'Number', actions: [historyButton(() => openHistorySheet('number', 'Number')), soundToggle()] }),
    h('div', { class: 'content' },
      h('div', { class: 'center-area' }, bigInput('from', 'From'), bigInput('to', 'To')),
      pool.el,
      paramsPill(openParams)),
    fabEl);
  refresh();
  setPrimaryAction(generate);
}
