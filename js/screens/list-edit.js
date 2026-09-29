import { h, topBar, toast, pasteButton } from '../ui.js';
import { helpButton } from '../help.js';
import { parseItems } from '../parse.js';
import { getState, update, ensureBuiltinList } from '../store.js';
import { back, replace, navDepth, hashQuery, stripHashQuery } from '../router.js';
import { BUILTIN_LISTS } from '../tools.js';
import { randInt } from '../rng.js';

const newId = () => globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36) + randInt(0, 2 ** 31).toString(36);

export function render(root, { id }) {
  if (id && Object.hasOwn(BUILTIN_LISTS, id)) ensureBuiltinList(id);
  const existing = id ? getState().lists.find((l) => l.id === id) : null;
  if (id && !existing) {
    toast('List not found');
    back('#/lists');
    return;
  }

  const name = h('input', {
    class: 'field', attrs: { type: 'text', maxlength: '60', 'aria-label': 'Name', placeholder: 'List name', autocomplete: 'off', autofocus: !existing },
  });
  name.value = existing ? existing.name : '';
  const items = h('textarea', {
    class: 'field textarea editor-text',
    attrs: { id: 'items-field', rows: '4', placeholder: 'One item per line', autocapitalize: 'sentences', 'aria-label': 'Items' },
  });
  items.value = existing ? existing.items.join('\n') : '';
  if (!existing) {
    const q = hashQuery();
    if (q.has('name') || q.has('items')) {
      const rawItems = q.get('items') || '';
      if (rawItems.length > 20000) toast('This link has invalid settings');
      else {
        name.value = (q.get('name') || '').trim().slice(0, 60);
        items.value = parseItems(rawItems).join('\n');
        toast('List loaded from link \u2014 tap Save to keep it');
      }
      stripHashQuery();
    }
  }
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
    topBar({ title: existing ? 'Edit list' : 'New list', actions: [helpButton('listEdit')] }),
    h('div', { class: 'content editor' },
      h('label', { class: 'field-caption', text: 'Name' }, name),
      h('div', { class: 'caption-row' },
        h('label', { class: 'field-caption', attrs: { for: 'items-field' }, text: 'Items' }),
        pasteButton(items)),
      items,
      h('div', { class: 'field-foot' },
        h('div', { class: 'muted hint', text: 'Tip: add a space and *3 after an item (Pizza *3) for 3\u00d7 odds.' }),
        count),
      h('div', { class: 'editor-actions' },
        h('button', { class: 'btn', attrs: { type: 'button' }, text: 'Cancel', on: { click: back } }),
        h('button', { class: 'btn filled', attrs: { type: 'button' }, text: 'Save', on: { click: save } }))));
  if (!existing) requestAnimationFrame(() => name.focus({ preventScroll: true })); // after the router focuses the h1
}
