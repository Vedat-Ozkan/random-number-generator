import { h, topBar, fab, paramsPill, openSheet, stepper, switchRow, noRepeatCard, announce, toast, motionOn, resultActions, scrollToResult, capHistory } from '../ui.js';
import { getState, update, addHistory } from '../store.js';
import { draw } from '../rng.js';
import { click, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { extractConfig, applyConfig } from '../tools.js';
import { initTool, toolChrome, share } from '../presets.js';

const VS = '︎'; // text presentation, so iOS does not render suit glyphs as emoji
const SUITS = [['♠', 'spades', false], ['♥', 'hearts', true], ['♦', 'diamonds', true], ['♣', 'clubs', false]];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const RANK_NAMES = ['Ace', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Jack', 'Queen', 'King'];
const cfg = () => getState().cards;
const deckSize = () => (cfg().jokers ? 54 : 52);

export function cardInfo(i) {
  if (i >= 52) {
    const red = i === 52;
    return { joker: true, red, short: 'Joker', name: `${red ? 'Red' : 'Black'} joker` };
  }
  const [glyph, suit, red] = SUITS[Math.floor(i / 13)];
  const r = i % 13;
  return { joker: false, red, rank: RANKS[r], glyph: glyph + VS, short: RANKS[r] + glyph + VS, name: `${RANK_NAMES[r]} of ${suit}` };
}

function cardEl(i, delay) {
  const c = cardInfo(i);
  const el = h('div', {
    class: 'playing-card ' + (c.red ? 'red' : 'black') + (c.joker ? ' joker' : '') + (motionOn() ? ' reveal' : ''),
    attrs: { role: 'img', 'aria-label': c.name }, style: { animationDelay: `${delay}ms` },
  });
  if (c.joker) {
    el.append(h('span', { class: 'pc-star', attrs: { 'aria-hidden': 'true' }, text: '★' }),
      h('span', { class: 'pc-joker-text', attrs: { 'aria-hidden': 'true' }, text: 'JOKER' }),
      h('span', { class: 'pc-star pc-star-b', attrs: { 'aria-hidden': 'true' }, text: '★' }));
    return el;
  }
  const corner = (cls) => h('span', { class: `pc-corner ${cls}`, attrs: { 'aria-hidden': 'true' } },
    h('span', { class: 'pc-rank', text: c.rank }), h('span', { class: 'pc-suit', text: c.glyph }));
  el.append(corner('tl'), h('span', { class: 'pc-center', attrs: { 'aria-hidden': 'true' }, text: c.glyph }), corner('br'));
  return el;
}

export function render(root, params = {}) {
  const init = initTool('cards', params);
  if (!init) return;
  let lastCopy = '';
  const chrome = toolChrome({ tool: 'cards', preset: init.preset, title: 'Cards', historyKey: 'cards', shareText: () => lastCopy });

  const pool = noRepeatCard({
    label: 'No repeat (deck)', format: ({ drawn, total }) => `${total - drawn} left`, resetLabel: 'Reshuffle', resetToast: 'Deck reshuffled',
    onToggle(want) { update((s) => { s.cards.noRepeat = want; }); refresh(); },
    onReset() { update((s) => { s.cards.drawn = []; }); refresh(); },
  });
  function refresh() {
    const c = cfg();
    pool.update({ on: c.noRepeat, drawn: c.drawn.length, total: deckSize() });
  }

  const hand = h('div', { class: 'hand', attrs: { hidden: true } });
  const actions = resultActions({ getText: () => lastCopy, onShare: () => share('cards', () => lastCopy, init.preset) });

  function drawCards() {
    const c = cfg();
    const r = draw({
      min: 0, max: deckSize() - 1, count: c.count, noRepeat: c.noRepeat, drawn: c.drawn,
      label: 'cards', resetNote: 'Deck empty — reshuffled',
    });
    update((s) => { s.cards.drawn = r.drawn; });
    refresh();
    if (r.notes.length) toast(r.notes.join('. '));
    const infos = r.values.map(cardInfo);
    lastCopy = infos.map((i) => i.short).join(', ');
    hand.replaceChildren(...r.values.map((v, i) => cardEl(v, i * 40)));
    hand.hidden = false;
    actions.hidden = false;
    click();
    vibrate(15);
    addHistory('cards', capHistory(lastCopy));
    announce(infos.map((i) => i.name).join(', '));
    scrollToResult(hand);
  }

  function openParams() {
    const count = stepper({
      label: 'cards per draw', value: cfg().count, min: 1, max: 10,
      format: (v) => `${v} ${v === 1 ? 'card' : 'cards'}`,
      onChange: (v) => update((s) => { s.cards.count = v; }),
    });
    const jokers = switchRow({
      label: 'Include 2 jokers', checked: cfg().jokers,
      onChange: (v) => {
        update((s) => { applyConfig('cards', s.cards, { ...extractConfig('cards', s.cards), jokers: v }); });
        refresh();
      },
    });
    openSheet({
      title: 'Parameters',
      body: h('div', { class: 'sheet-rows' },
        h('div', { class: 'row' }, h('div', { class: 'row-text' }, h('div', { class: 'row-label', text: 'Cards per draw' })), count.el),
        jokers.el),
    });
  }

  const fabEl = fab({ label: 'Draw', icon: 'cards', onClick: drawCards });
  root.append(
    topBar({ title: chrome.title, actions: chrome.actions }),
    h('div', { class: 'content tool-stack' }, chrome.bar, pool.el, hand, actions, h('div', { class: 'pill-wrap' }, paramsPill(openParams))),
    fabEl);
  refresh();
  setPrimaryAction(drawCards);
  if (init.edit) requestAnimationFrame(openParams);
  return () => chrome.cleanup();
}
