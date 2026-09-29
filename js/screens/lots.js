import { h, icon, topBar, fab, paramsPill, openSheet, stepper, decorMotion, fitTiles, observeSize } from '../ui.js';
import { getState, update, addHistory } from '../store.js';
import { sampleDistinct } from '../rng.js';
import { click, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { initTool, toolChrome } from '../presets.js';

export function render(root, params = {}) {
  const init = initTool('lots', params);
  if (!init) return;
  let lastLine = '';
  const chrome = toolChrome({ tool: 'lots', preset: init.preset, title: 'Cast lots', historyKey: 'lots', shareText: () => lastLine });
  let winners = new Set();
  let revealed = new Set();
  let timer = 0;
  const grid = h('div', { class: 'lots-grid' });
  const box = h('div', { class: 'fit-box lots-box' }, grid);
  const status = h('div', { class: 'lots-status', attrs: { 'aria-live': 'polite' } });
  const cfg = () => getState().lots;

  function paintStatus() {
    const { k } = cfg();
    const found = [...revealed].filter((i) => winners.has(i)).length;
    status.textContent = `Revealed ${revealed.size} / ${cfg().n} · Winners found ${found} / ${k}` + (found === k ? ' · All winners found' : '');
  }

  function lotEl(i) {
    const btn = h('button', { class: 'lot', attrs: { type: 'button', 'aria-label': `Lot ${i + 1}, hidden` }, on: { click: () => reveal(i, btn) } },
      h('div', { class: 'lot-inner' },
        h('div', { class: 'lot-face lot-front' }, h('span', { class: 'lot-q', text: '?' }), h('span', { class: 'lot-num', text: String(i + 1) })),
        h('div', { class: 'lot-face lot-back' })));
    return btn;
  }

  function reveal(i, btn) {
    if (revealed.has(i)) return;
    revealed.add(i);
    const win = winners.has(i);
    const back = btn.querySelector('.lot-back');
    back.replaceChildren(...(win ? [icon('star'), h('span', { class: 'lot-win', text: 'WIN' })] : [h('span', { class: 'lot-blank', text: '—' })]));
    btn.classList.add('revealed', win ? 'win' : 'blank');
    btn.disabled = true;
    btn.setAttribute('aria-label', `Lot ${i + 1}, ${win ? 'winner' : 'blank'}`);
    click();
    vibrate(win ? [30, 40, 30] : 15);
    lastLine = `Lot ${i + 1}: ${win ? 'winner' : 'blank'}`;
    addHistory('lots', lastLine);
    paintStatus();
  }

  function resetRound() {
    const { n, k } = cfg();
    winners = new Set(sampleDistinct(0, n - 1, k));
    revealed = new Set();
    grid.inert = false;
    grid.replaceChildren(...Array.from({ length: n }, (_, i) => lotEl(i)));
    paintStatus();
    fit();
  }

  function fit() {
    if (!box.clientWidth || !box.clientHeight) return;
    const { cols, size, fits } = fitTiles(box, cfg().n, { aspect: 4 / 3, gap: matchMedia('(max-height: 600px)').matches ? 6 : 8, min: 40, max: 96 });
    box.style.setProperty('--cols', cols);
    box.style.setProperty('--tile', `${size}px`);
    box.classList.toggle('scroll-region', !fits);
  }

  function newRound() {
    clearTimeout(timer);
    if (decorMotion() && revealed.size) {
      grid.inert = true; // no taps while lots flip back
      grid.querySelectorAll('.lot.revealed').forEach((b) => b.classList.remove('revealed'));
      timer = setTimeout(resetRound, 300);
    } else {
      resetRound();
    }
  }

  function openParams() {
    const { n, k } = cfg();
    const winStep = stepper({
      label: 'winning lots', value: k, min: 1, max: n - 1,
      onChange: (v) => { update((s) => { s.lots.k = v; }); clearTimeout(timer); resetRound(); },
    });
    const lotsStep = stepper({
      label: 'lots', value: n, min: 2, max: 30,
      onChange: (v) => {
        update((s) => { s.lots.n = v; s.lots.k = Math.min(s.lots.k, v - 1); });
        winStep.setRange(1, v - 1);
        winStep.set(cfg().k);
        clearTimeout(timer);
        resetRound();
      },
    });
    openSheet({
      title: 'Parameters',
      body: h('div', { class: 'sheet-rows' },
        h('div', { class: 'row' }, h('div', { class: 'row-text' }, h('div', { class: 'row-label', text: 'Number of lots' })), lotsStep.el),
        h('div', { class: 'row' }, h('div', { class: 'row-text' }, h('div', { class: 'row-label', text: 'Winning lots' })), winStep.el)),
    });
  }

  root.append(
    topBar({ title: chrome.title, actions: chrome.actions }),
    h('div', { class: 'content' }, chrome.bar, status, box, paramsPill(openParams)),
    fab({ label: 'New round', onClick: newRound }));
  const stopObserving = observeSize(box, fit);
  resetRound();
  setPrimaryAction(newRound);
  if (init.edit) requestAnimationFrame(openParams);
  return () => { clearTimeout(timer); stopObserving(); chrome.cleanup(); };
}
