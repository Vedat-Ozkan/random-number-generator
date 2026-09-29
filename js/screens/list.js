import { h, topBar, historyButton, soundMenuItem, iconButton, fab, paramsPill, noRepeatCard, openSheet, stepper, showResult, toast, openMenu, confirmDialog } from '../ui.js';
import { getState, update, addHistory, deleteList, ensureBuiltinList } from '../store.js';
import { draw, drawWeighted } from '../rng.js';
import { parseWeighted } from '../parse.js';
import { shareList } from '../presets.js';
import { click, vibrate } from '../feedback.js';
import { setPrimaryAction, back } from '../router.js';
import { openHistorySheet } from './history.js';
import { helpButton } from '../help.js';

export function render(root, { id }) {
  const find = () => getState().lists.find((l) => l.id === id) || ensureBuiltinList(id);
  if (!find()) {
    toast('List not found');
    back('#/lists');
    return;
  }

  let picked = new Set();
  const itemsBox = h('div', { class: 'items scroll-region' });
  const emptyBox = h('div', { class: 'empty-list' },
    h('p', { class: 'muted', text: 'This list is empty' }),
    h('a', { class: 'btn filled', attrs: { href: `#/list/${encodeURIComponent(id)}/edit` }, text: 'Edit list' }));

  function paintItems() {
    const l = find();
    if (!l) return;
    if (!l.items.length) { itemsBox.replaceChildren(emptyBox); return; }
    const drawn = new Set(l.noRepeat ? l.drawn : []);
    itemsBox.replaceChildren(...l.items.map((raw, i) => {
      const { text, weight } = parseWeighted(raw);
      return h('div', { class: 'item' + (picked.has(i) ? ' picked' : '') + (drawn.has(i) ? ' drawn' : '') },
        h('span', { class: 'item-text', text }),
        weight > 1 ? h('span', { class: 'weight-badge', attrs: { 'aria-label': `weight ${weight}` }, text: `\u00d7${weight}` }) : null);
    }));
  }

  const pool = noRepeatCard({
    onToggle(want) {
      update(() => { find().noRepeat = want; });
      refresh();
    },
    onReset() {
      update(() => { find().drawn = []; });
      picked = new Set();
      refresh();
    },
  });

  function refresh() {
    const l = find();
    pool.update({ on: l.noRepeat, drawn: l.drawn.length, total: l.items.length });
    paintItems();
  }

  function generate() {
    const l = find();
    const n = l.items.length;
    if (!n) { toast('Add items first'); return; }
    const parsed = l.items.map(parseWeighted);
    const count = Math.min(l.pickCount, n, 20);
    const r = parsed.some((p) => p.weight > 1)
      ? drawWeighted({ weights: parsed.map((p) => p.weight), count, noRepeat: l.noRepeat, drawn: l.drawn, label: 'items' })
      : draw({ min: 0, max: n - 1, count, noRepeat: l.noRepeat, drawn: l.drawn, label: 'items' });
    update(() => { find().drawn = r.drawn; });
    picked = new Set(r.values);
    refresh();
    if (r.notes.length) toast(r.notes.join('. '));
    const texts = r.values.map((i) => parsed[i].text);
    click();
    vibrate(15);
    addHistory(`list:${id}`, texts.join(', '));
    showResult({
      values: texts, lines: true, caption: l.name, onAgain: generate, returnFocus: fabEl,
      onShare: () => shareList(l.name, l.items, `${l.name}: ${texts.join(', ')}`),
    });
  }

  function openParams() {
    const l = find();
    const max = Math.max(1, Math.min(20, l.items.length));
    const pick = stepper({
      label: 'pick count', value: Math.min(l.pickCount, max), min: 1, max,
      onChange: (v) => update(() => { find().pickCount = v; }),
    });
    openSheet({
      title: 'Parameters',
      body: h('div', { class: 'sheet-rows' },
        h('div', { class: 'row' }, h('div', { class: 'row-text' }, h('div', { class: 'row-label', text: 'How many to pick' })), pick.el)),
    });
  }

  const menuBtn = iconButton({
    icon: 'more', label: 'List options',
    onClick: () => openMenu(menuBtn, [
      soundMenuItem(),
      { label: 'Edit list', onClick: () => { location.hash = `#/list/${encodeURIComponent(id)}/edit`; } },
      { label: 'Share list…', onClick: () => shareList(find().name, find().items) },
      {
        label: 'Delete list', danger: true,
        onClick: async () => {
          if (await confirmDialog({ message: `Delete list "${find().name}"?` })) {
            deleteList(id);
            back('#/lists');
          }
        },
      },
    ]),
  });
  menuBtn.setAttribute('aria-haspopup', 'menu');

  const fabEl = fab({ label: 'Generate', onClick: generate, disabled: !find().items.length });

  root.append(
    topBar({ title: find().name, actions: [historyButton(() => openHistorySheet(`list:${id}`, find().name)), menuBtn, helpButton('list', { title: find().name })] }),
    h('div', { class: 'content' }, itemsBox, pool.el, paramsPill(openParams)),
    fabEl);
  refresh();
  setPrimaryAction(generate);
}
