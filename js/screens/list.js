import { h, topBar, historyButton, soundToggle, iconButton, fab, paramsPill, noRepeatCard, openSheet, stepper, showResult, toast, openMenu, confirmDialog } from '../ui.js';
import { getState, update, addHistory, deleteList } from '../store.js';
import { draw } from '../rng.js';
import { click, vibrate } from '../feedback.js';
import { setPrimaryAction, replace } from '../router.js';
import { openHistorySheet } from './history.js';

export function render(root, { id }) {
  const find = () => getState().lists.find((l) => l.id === id);
  if (!find()) {
    toast('List not found');
    replace('#/');
    return;
  }

  let picked = new Set();
  const itemsBox = h('div', { class: 'items' });
  const emptyBox = h('div', { class: 'empty-list' },
    h('p', { class: 'muted', text: 'This list is empty' }),
    h('a', { class: 'btn filled', attrs: { href: `#/list/${encodeURIComponent(id)}/edit` }, text: 'Edit list' }));

  function paintItems() {
    const l = find();
    if (!l) return;
    if (!l.items.length) { itemsBox.replaceChildren(emptyBox); return; }
    const drawn = new Set(l.noRepeat ? l.drawn : []);
    itemsBox.replaceChildren(...l.items.map((t, i) => h('div', {
      class: 'item' + (picked.has(i) ? ' picked' : '') + (drawn.has(i) ? ' drawn' : ''),
      text: t,
    })));
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
    const r = draw({
      min: 0, max: n - 1, count: Math.min(l.pickCount, n, 20),
      noRepeat: l.noRepeat, drawn: l.drawn, label: 'items',
    });
    update(() => { find().drawn = r.drawn; });
    picked = new Set(r.values);
    refresh();
    if (r.notes.length) toast(r.notes.join('. '));
    const texts = r.values.map((i) => l.items[i]);
    click();
    vibrate(15);
    addHistory(`list:${id}`, texts.join(', '));
    showResult({ values: texts, lines: true, onAgain: generate, returnFocus: fabEl });
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
      { label: 'Edit list', onClick: () => { location.hash = `#/list/${encodeURIComponent(id)}/edit`; } },
      {
        label: 'Delete list', danger: true,
        onClick: async () => {
          if (await confirmDialog({ message: `Delete list "${find().name}"?` })) {
            deleteList(id);
            replace('#/');
          }
        },
      },
    ]),
  });
  menuBtn.setAttribute('aria-haspopup', 'menu');

  const fabEl = fab({ label: 'Generate', onClick: generate, disabled: !find().items.length });

  root.append(
    topBar({ title: find().name, actions: [historyButton(() => openHistorySheet(`list:${id}`, find().name)), soundToggle(), menuBtn] }),
    h('div', { class: 'content' }, itemsBox, pool.el, paramsPill(openParams)),
    fabEl);
  refresh();
  setPrimaryAction(generate);
}
