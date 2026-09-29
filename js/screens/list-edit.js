import { h, topBar, toast } from '../ui.js';
import { getState, update } from '../store.js';
import { back, replace, navDepth } from '../router.js';
import { randInt } from '../rng.js';

const MAX_ITEMS = 500;
const MAX_LEN = 200;

export function parseItems(text) {
  return text.split('\n').map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, MAX_LEN)).slice(0, MAX_ITEMS);
}

const newId = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + randInt(0, 2 ** 31).toString(36);

export function render(root, { id }) {
  const existing = id ? getState().lists.find((l) => l.id === id) : null;
  if (id && !existing) {
    toast('List not found');
    replace('#/');
    return;
  }

  const name = h('input', {
    class: 'field', attrs: { type: 'text', maxlength: '60', 'aria-label': 'Name', placeholder: 'List name', autocomplete: 'off', autofocus: !existing },
  });
  name.value = existing ? existing.name : '';
  const items = h('textarea', {
    class: 'field textarea',
    attrs: { rows: '10', placeholder: 'One item per line', autocapitalize: 'sentences', 'aria-label': 'Items' },
  });
  items.value = existing ? existing.items.join('\n') : '';
  const count = h('div', { class: 'muted field-count', attrs: { 'aria-live': 'off' } });
  const paintCount = () => {
    const n = parseItems(items.value).length;
    count.textContent = `${n} ${n === 1 ? 'item' : 'items'}`;
  };
  items.addEventListener('input', paintCount);
  paintCount();

  function save() {
    const newItems = parseItems(items.value);
    const listName = name.value.trim() || 'Untitled list';
    if (existing) {
      const changed = JSON.stringify(newItems) !== JSON.stringify(existing.items);
      update(() => {
        const l = getState().lists.find((x) => x.id === existing.id);
        l.name = listName;
        l.items = newItems;
        if (changed) l.drawn = [];
        l.pickCount = Math.min(l.pickCount, Math.max(1, Math.min(20, newItems.length)));
      });
      if (navDepth() > 0) back();
      else replace(`#/list/${encodeURIComponent(existing.id)}`); // deep-linked editor: don't go Home
    } else {
      const nid = newId();
      update((s) => {
        s.lists.push({ id: nid, name: listName, items: newItems, noRepeat: false, drawn: [], pickCount: 1 });
      });
      replace(`#/list/${encodeURIComponent(nid)}`);
    }
  }

  root.append(
    topBar({ title: existing ? 'Edit list' : 'New list' }),
    h('div', { class: 'content editor' },
      h('label', { class: 'field-caption', text: 'Name' }, name),
      h('label', { class: 'field-caption', text: 'Items' }, items),
      count,
      h('div', { class: 'editor-actions' },
        h('button', { class: 'btn', attrs: { type: 'button' }, text: 'Cancel', on: { click: back } }),
        h('button', { class: 'btn filled', attrs: { type: 'button' }, text: 'Save', on: { click: save } }))));
  if (!existing) requestAnimationFrame(() => name.focus({ preventScroll: true })); // after the router focuses the h1
}
