import { h, topBar, historyButton, soundToggle, fab, motionOn } from '../ui.js';
import { getState, update, addHistory } from '../store.js';
import { randInt } from '../rng.js';
import { ting, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { openHistorySheet } from './history.js';

const coin = () => getState().coin;
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function render(root) {
  let rot = coin().last === 'tails' ? 180 : 0;
  let flipping = false;
  let timer = 0;
  let pending = null;

  const coinEl = h('div', { class: 'coin' },
    h('div', { class: 'face front' }, h('span', { class: 'face-letter', text: 'H' }), h('span', { class: 'face-label', text: 'HEADS' })),
    h('div', { class: 'face back' }, h('span', { class: 'face-letter', text: 'T' }), h('span', { class: 'face-label', text: 'TAILS' })));
  const stage = h('div', { class: 'coin-stage', on: { click: () => flip() }, attrs: { 'aria-hidden': 'true' } }, coinEl);
  const resultEl = h('div', { class: 'coin-result', attrs: { 'aria-live': 'polite' } });
  const tallyEl = h('div', { class: 'coin-tally' });

  const setRot = (r, animated) => {
    coinEl.style.transition = animated ? 'transform 900ms cubic-bezier(.2,.7,.2,1)' : 'none';
    coinEl.style.transform = `rotateY(${r}deg)`;
  };

  function paintText() {
    const c = coin();
    resultEl.textContent = c.last ? cap(c.last) : ' ';
    tallyEl.textContent = `Heads ${c.heads} · Tails ${c.tails}`;
  }

  function finish() {
    if (!pending) return;
    const result = pending;
    pending = null;
    clearTimeout(timer);
    update((s) => { s.coin[result]++; s.coin.last = result; });
    flipping = false;
    stage.classList.remove('arc');
    paintText();
    ting();
    vibrate(20);
    addHistory('coin', cap(result));
  }

  function flip() {
    if (flipping) return;
    flipping = true;
    const result = randInt(0, 1) ? 'tails' : 'heads';
    const target = result === 'tails' ? 180 : 0;
    pending = result;
    if (!motionOn()) {
      rot += ((target - (((rot % 360) + 360) % 360)) + 360) % 360;
      setRot(rot, false);
      finish();
      return;
    }
    const cur = ((rot % 360) + 360) % 360;
    rot += 1800 + ((target - cur + 360) % 360);
    stage.classList.remove('arc');
    void stage.offsetWidth;
    stage.classList.add('arc');
    setRot(rot, true);
    timer = setTimeout(finish, 950);
  }

  coinEl.addEventListener('transitionend', (e) => { if (e.propertyName === 'transform') finish(); });

  const reset = h('button', {
    class: 'btn', attrs: { type: 'button' }, text: 'Reset tally',
    on: { click: () => { update((s) => { s.coin.heads = 0; s.coin.tails = 0; s.coin.last = null; }); paintText(); } },
  });

  const fabEl = fab({ label: 'Flip', onClick: flip });
  root.append(
    topBar({ title: 'Coin', actions: [historyButton(() => openHistorySheet('coin', 'Coin')), soundToggle()] }),
    h('div', { class: 'content' },
      h('div', { class: 'center-area' }, stage, resultEl, tallyEl, h('div', { class: 'coin-reset' }, reset))),
    fabEl);
  setRot(rot, false);
  paintText();
  setPrimaryAction(flip);
  return () => { finish(); clearTimeout(timer); };
}
