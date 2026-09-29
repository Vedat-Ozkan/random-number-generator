import { h, topBar, fab, motionLevel, decorMotion } from '../ui.js';
import { getState, update, addHistory } from '../store.js';
import { randInt } from '../rng.js';
import { ting, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { toolChrome } from '../presets.js';

const coin = () => getState().coin;
const cap = (s) => s[0].toUpperCase() + s.slice(1);

export function render(root) {
  const chrome = toolChrome({
    tool: 'coin', preset: null, title: 'Coin', historyKey: 'coin',
    shareText: () => (coin().last ? `Coin: ${cap(coin().last)}` : ''),
  });
  let rot = coin().last === 'tails' ? 180 : 0;
  let flipping = false;
  let timer = 0;
  let pending = null;
  let anim = null;

  const coinEl = h('div', { class: 'coin' },
    h('div', { class: 'face front' }, h('span', { class: 'face-letter', text: 'H' }), h('span', { class: 'face-label', text: 'HEADS' })),
    h('div', { class: 'face back' }, h('span', { class: 'face-letter', text: 'T' }), h('span', { class: 'face-label', text: 'TAILS' })));
  const stage = h('div', { class: 'coin-stage', on: { click: () => flip() }, attrs: { 'aria-hidden': 'true' } }, coinEl);
  const resultEl = h('div', { class: 'coin-result', attrs: { 'aria-live': 'polite' } });
  const headsNum = h('div', { class: 'stat-num' });
  const headsCap = h('div', { class: 'stat-cap' });
  const tailsNum = h('div', { class: 'stat-num' });
  const tailsCap = h('div', { class: 'stat-cap' });
  const streakEl = h('div', { class: 'coin-streak idle' });
  const statsEl = h('div', { class: 'coin-stats' },
    h('div', { class: 'stat' }, headsNum, headsCap),
    h('div', { class: 'stat' }, tailsNum, tailsCap));

  const setRot = (r) => { coinEl.style.transform = `rotateY(${r}deg)`; };

  function paintText() {
    const c = coin();
    resultEl.textContent = c.last ? cap(c.last) : ' ';
    const total = c.heads + c.tails;
    const pct = (n) => (total ? `${Math.round((100 * n) / total)}%` : '\u2014');
    headsNum.textContent = String(c.heads);
    tailsNum.textContent = String(c.tails);
    headsCap.textContent = `HEADS \u00b7 ${pct(c.heads)}`;
    tailsCap.textContent = `TAILS \u00b7 ${pct(c.tails)}`;
    streakEl.classList.toggle('idle', total === 0);
    streakEl.textContent = total === 0 || !c.last ? ' ' :
      `Streak ${c.run} ${c.last} \u00b7 Longest ${c.best} ${c.bestFace ?? c.last}`;
  }

  function finish(silent = false) {
    if (!pending) return;
    const result = pending;
    pending = null;
    clearTimeout(timer);
    anim?.cancel();
    anim = null;
    update((s) => {
      const c = s.coin;
      c[result]++;
      c.run = c.last === result ? c.run + 1 : 1;
      c.last = result;
      if (c.run > c.best) { c.best = c.run; c.bestFace = result; }
    });
    flipping = false;
    stage.classList.remove('arc');
    paintText();
    if (silent !== true) { ting(); vibrate(20); }
    addHistory('coin', cap(result));
  }

  // Essential motion via the Web Animations API (CSS motion rules never affect it).
  const FLIP = {
    on: { ms: 900, turns: 5, easing: 'cubic-bezier(.2,.7,.2,1)' },
    reduced: { ms: 600, turns: 2, easing: 'cubic-bezier(.25,.6,.3,1)' },
  };

  function flip() {
    if (flipping) return;
    flipping = true;
    const result = randInt(0, 1) ? 'tails' : 'heads';
    const target = result === 'tails' ? 180 : 0;
    pending = result;
    const level = motionLevel();
    const cur = ((rot % 360) + 360) % 360;
    const delta = (target - cur + 360) % 360;
    if (level === 'off' || !coinEl.animate) {
      rot += delta;
      setRot(rot);
      finish();
      return;
    }
    const { ms, turns, easing } = FLIP[level] || FLIP.on;
    const prev = rot;
    rot += 360 * turns + delta;
    setRot(rot); // commit the end state first
    if (decorMotion()) {
      stage.classList.remove('arc');
      void stage.offsetWidth;
      stage.classList.add('arc');
    }
    anim = coinEl.animate([{ transform: `rotateY(${prev}deg)` }, { transform: `rotateY(${rot}deg)` }], { duration: ms, easing });
    anim.finished.then(() => finish(), () => {});
    timer = setTimeout(() => finish(), ms + 150);
  }

  const reset = h('button', {
    class: 'btn', attrs: { type: 'button' }, text: 'Reset tally',
    on: {
      click: () => {
        update((s) => { Object.assign(s.coin, { heads: 0, tails: 0, last: null, run: 0, best: 0, bestFace: null }); });
        paintText();
      },
    },
  });

  const fabEl = fab({ label: 'Flip', onClick: flip });
  root.append(
    topBar({ title: chrome.title, actions: chrome.actions }),
    h('div', { class: 'content coin-page' },
      h('div', { class: 'fit-box' }, stage),
      resultEl, statsEl, streakEl, h('div', { class: 'coin-reset' }, reset)),
    fabEl);
  setRot(rot);
  paintText();
  setPrimaryAction(flip);
  return () => { finish(true); clearTimeout(timer); chrome.cleanup(); };
}
