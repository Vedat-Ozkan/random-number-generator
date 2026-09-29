import { h, topBar, fab, paramsPill, openSheet, stepper, chipRow, switchRow, announce, resultActions, scrollToResult, capHistory } from '../ui.js';
import { getState, update, addHistory } from '../store.js';
import { drawLottery } from '../rng.js';
import { click, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { extractConfig, applyConfig } from '../tools.js';
import { initTool, toolChrome, share } from '../presets.js';

const FORMATS = [
  ['6/49', { n: 49, k: 6, bonusK: 0 }],
  ['6/59', { n: 59, k: 6, bonusK: 0 }],
  ['5/69 + 1/26', { n: 69, k: 5, bonusK: 1, bonusN: 26 }],
  ['5/70 + 1/25', { n: 70, k: 5, bonusK: 1, bonusN: 25 }],
  ['5/50 + 2/12', { n: 50, k: 5, bonusK: 2, bonusN: 12 }],
  ['7/35', { n: 35, k: 7, bonusK: 0 }],
];
const cfg = () => getState().lottery;

const matches = (fmt) => {
  const c = cfg();
  return c.n === fmt.n && c.k === fmt.k && c.bonusK === fmt.bonusK && !c.bonusSame && (fmt.bonusK === 0 || c.bonusN === fmt.bonusN);
};

export function render(root, params = {}) {
  const init = initTool('lottery', params);
  if (!init) return;
  let lastCopy = '';
  let sheet = null;
  const chrome = toolChrome({ tool: 'lottery', preset: init.preset, title: 'Lottery', historyKey: 'lottery', shareText: () => lastCopy });

  function patch(p) {
    update((s) => { applyConfig('lottery', s.lottery, { ...extractConfig('lottery', s.lottery), ...p }); });
    formats.paint();
    sheet?.sync();
  }

  const formats = chipRow({
    label: 'Formats', options: FORMATS.map(([label], i) => [i, label]),
    isOn: (i) => matches(FORMATS[i][1]),
    onPick: (i) => patch({ bonusSame: false, ...FORMATS[i][1] }),
  });

  const result = h('div', { class: 'lottery-lines', attrs: { hidden: true } });
  const foot = h('p', { class: 'muted hint lottery-foot', attrs: { hidden: true }, text: "Random picks don't change your odds. Play responsibly." });
  const actions = resultActions({ getText: () => lastCopy, onShare: () => share('lottery', () => lastCopy, init.preset) });

  const ball = (n, bonus) => h('span', { class: 'ball' + (bonus ? ' bonus' : ''), attrs: { 'aria-hidden': 'true' }, text: String(n) });

  function draw() {
    const c = cfg();
    const lines = Array.from({ length: c.lines }, () => drawLottery(c));
    const asText = (l) => l.main.join(' ') + (l.bonus.length ? ' + ' + l.bonus.join(' ') : '');
    lastCopy = lines.map(asText).join('\n');
    result.replaceChildren(...lines.map((l, i) => {
      const label = `Line ${i + 1}: ${l.main.join(', ')}` + (l.bonus.length ? `. Bonus ${l.bonus.join(', ')}` : '');
      return h('div', { class: 'lottery-line' },
        c.lines > 1 ? h('div', { class: 'line-label', text: `Line ${i + 1}`, attrs: { 'aria-hidden': 'true' } }) : null,
        h('div', { class: 'balls', attrs: { role: 'img', 'aria-label': label } },
          ...l.main.map((n, j) => { const b = ball(n, false); b.style.animationDelay = `${j * 40}ms`; return b; }),
          l.bonus.length ? h('span', { class: 'plus', attrs: { 'aria-hidden': 'true' }, text: '+' }) : null,
          ...l.bonus.map((n) => ball(n, true))));
    }));
    result.classList.remove('reveal');
    void result.offsetWidth;
    result.classList.add('reveal');
    result.hidden = false;
    foot.hidden = false;
    actions.hidden = false;
    click();
    vibrate(15);
    addHistory('lottery', capHistory(lines.map(asText).join(' | ')));
    announce(lines.map((l, i) => `Line ${i + 1}: ${l.main.join(', ')}` + (l.bonus.length ? `, bonus ${l.bonus.join(', ')}` : '')).join('. '));
    scrollToResult(result);
  }

  function openParams() {
    const c = cfg();
    const main = stepper({ label: 'main pool', value: c.n, min: 2, max: 99, format: (v) => `1–${v}`, onChange: (v) => patch({ n: v }) });
    const pick = stepper({ label: 'numbers to pick', value: c.k, min: 1, max: Math.min(10, c.n), onChange: (v) => patch({ k: v }) });
    const bonus = stepper({ label: 'bonus balls', value: c.bonusK, min: 0, max: 3, onChange: (v) => patch({ bonusK: v }) });
    const bonusPool = stepper({ label: 'bonus pool', value: c.bonusN, min: 1, max: 99, format: (v) => `1–${v}`, onChange: (v) => patch({ bonusN: v }) });
    const same = switchRow({ label: 'Bonus from the main pool', checked: c.bonusSame, onChange: (v) => patch({ bonusSame: v }) });
    const lines = stepper({ label: 'lines', value: c.lines, min: 1, max: 10, format: (v) => `${v} ${v === 1 ? 'line' : 'lines'}`, onChange: (v) => patch({ lines: v }) });
    const row = (label, ctl) => h('div', { class: 'row' }, h('div', { class: 'row-text' }, h('div', { class: 'row-label', text: label })), ctl.el);
    const poolRow = row('Bonus pool', bonusPool);
    sheet = {
      sync() {
        const s = cfg();
        main.set(s.n);
        pick.setRange(1, Math.min(10, s.n)); pick.set(s.k);
        bonus.setRange(0, Math.max(0, Math.min(3, s.bonusSame ? s.n - s.k : s.bonusN))); bonus.set(s.bonusK);
        same.set(s.bonusSame);
        lines.set(s.lines);
        const off = s.bonusK === 0 || s.bonusSame;
        poolRow.classList.toggle('disabled', off);
        if (off) bonusPool.setRange(s.bonusN, s.bonusN); // locks both buttons
        else bonusPool.setRange(1, 99);
        bonusPool.set(s.bonusN);
      },
    };
    sheet.sync();
    openSheet({
      title: 'Parameters',
      body: h('div', { class: 'sheet-rows' }, row('Main pool', main), row('Numbers to pick', pick), row('Bonus balls', bonus), poolRow, same.el, row('Lines', lines)),
      onClose: () => { sheet = null; },
    });
  }

  const fabEl = fab({ label: 'Draw', icon: 'lottery', onClick: draw });
  root.append(
    topBar({ title: chrome.title, actions: chrome.actions }),
    h('div', { class: 'content tool-stack' }, chrome.bar, formats.el, result, actions, foot, h('div', { class: 'pill-wrap' }, paramsPill(openParams))),
    fabEl);
  setPrimaryAction(draw);
  if (init.edit) requestAnimationFrame(openParams);
  return () => chrome.cleanup();
}
