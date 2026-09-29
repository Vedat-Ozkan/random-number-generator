// Shared "items source" card (Paste | Saved list) for Teams, Shuffle and Wheel.
import { h, segmented, pasteButton } from '../ui.js';
import { getState, update } from '../store.js';
import { parseItems, parseList } from '../parse.js';
import { MAX_TEXT } from '../tools.js';

const DEBOUNCE = 250;

export function sourceCard({ tool, onChange = () => {} }) {
  const sec = () => getState()[tool];
  const lists = () => getState().lists;
  const findList = () => lists().find((l) => l.id === sec().listId) || null;

  let timer = 0;
  let pending = null;
  function flush() {
    clearTimeout(timer);
    timer = 0;
    if (pending === null) return false;
    const text = pending.slice(0, MAX_TEXT);
    pending = null;
    update((s) => { s[tool].text = text; });
    return true;
  }

  const seg = segmented({
    label: 'Items source', options: [['paste', 'Paste'], ['list', 'Saved list']], value: sec().source,
    onChange: (v) => {
      flush();
      update((s) => {
        s[tool].source = v;
        if (v === 'list' && !s[tool].listId && s.lists.length) s[tool].listId = s.lists[0].id;
      });
      paint();
      onChange();
    },
  });
  seg.setDisabled('list', lists().length === 0);
  const noLists = h('div', { class: 'muted hint', text: 'No saved lists yet' });
  noLists.hidden = lists().length > 0;

  // Paste mode
  const area = h('textarea', {
    class: 'field textarea source-text',
    attrs: { rows: '6', placeholder: 'One per line', 'aria-label': 'Items', maxlength: String(MAX_TEXT), autocapitalize: 'sentences' },
  });
  area.value = sec().text;
  const count = h('span', { class: 'muted field-count' });
  const paintCount = () => {
    const n = parseItems(area.value).length;
    count.textContent = `${n} ${n === 1 ? 'item' : 'items'}`;
  };
  area.addEventListener('input', () => {
    paintCount();
    pending = area.value;
    clearTimeout(timer);
    timer = setTimeout(() => { flush(); onChange(); }, DEBOUNCE);
  });
  const clear = h('button', {
    class: 'btn sm tonal', attrs: { type: 'button' }, text: 'Clear',
    on: { click: () => { area.value = ''; area.dispatchEvent(new Event('input', { bubbles: true })); area.focus(); } },
  });
  const pastePanel = h('div', { class: 'source-panel' }, area,
    h('div', { class: 'source-foot' }, count, h('div', { class: 'source-btns' }, pasteButton(area), clear)));

  // Saved list mode
  const select = h('select', { class: 'field', attrs: { 'aria-label': 'Saved list' } });
  const editLink = h('a', { class: 'btn sm tonal', text: 'Edit list', attrs: { href: '#/list/new' } });
  const missing = h('div', { class: 'muted hint', text: 'The saved list was deleted' });
  select.addEventListener('change', () => {
    update((s) => { s[tool].listId = select.value; });
    paint();
    onChange();
  });
  const listPanel = h('div', { class: 'source-panel' }, h('div', { class: 'source-list-row' }, select, editLink), missing);

  function paintList() {
    const cur = findList();
    const opts = lists().map((l) => {
      const o = h('option', { attrs: { value: l.id }, text: `${l.name} (${l.items.length})` });
      return o;
    });
    if (!cur) opts.unshift(h('option', { attrs: { value: '', disabled: true, selected: true }, text: 'Choose a list' }));
    select.replaceChildren(...opts);
    if (cur) select.value = cur.id;
    else select.selectedIndex = 0;
    missing.hidden = !!cur || !sec().listId;
    editLink.hidden = !cur;
    if (cur) editLink.setAttribute('href', `#/list/${encodeURIComponent(cur.id)}/edit`);
  }

  function paint() {
    const list = sec().source === 'list';
    seg.set(sec().source);
    pastePanel.hidden = list;
    listPanel.hidden = !list;
    if (list) paintList();
    else paintCount();
  }

  const el = h('div', { class: 'card source-card' }, seg.el, noLists, pastePanel, listPanel);
  paint();

  return {
    el,
    getItems() {
      if (sec().source === 'list') {
        const l = findList();
        return l ? parseList(l.items.join('\n')) : [];
      }
      return parseList(area.value);
    },
    focus() { if (sec().source === 'paste') area.focus({ preventScroll: true }); else select.focus({ preventScroll: true }); },
    cleanup() { flush(); },
  };
}
