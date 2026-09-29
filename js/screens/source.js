// Shared items source for Teams, Shuffle and Wheel: a one-line summary row that opens an
// "Items" sheet (Paste | Saved list).
import { h, segmented, pasteButton, openSheet } from '../ui.js';
import { getState, update } from '../store.js';
import { parseItems, parseList } from '../parse.js';
import { MAX_TEXT } from '../tools.js';

const DEBOUNCE = 250;

export function sourceSummary({ tool, noun = 'items', cap = 0, onChange = () => {} }) {
  const sec = () => getState()[tool];
  const lists = () => getState().lists;
  const findList = () => lists().find((l) => l.id === sec().listId) || null;
  const plural = (n) => `${n} ${n === 1 ? noun.replace(/s$/, '') : noun}`;

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
  const currentText = () => (pending !== null ? pending : sec().text);

  /* ---------- summary row ---------- */
  const titleEl = h('span', { class: 'source-title' });
  const subEl = h('span', { class: 'source-sub' });
  const el = h('button', { class: 'card source-row', attrs: { type: 'button', 'aria-haspopup': 'dialog' }, on: { click: () => openEditor() } },
    h('span', { class: 'source-text-col' }, titleEl, subEl),
    h('span', { class: 'source-edit', text: 'Edit' }));

  function paintRow() {
    let n;
    let sub;
    const isList = sec().source === 'list';
    if (isList) {
      const l = findList();
      n = l ? parseItems(l.items.join('\n')).length : 0;
      titleEl.textContent = l ? `List: ${l.name}` : 'Choose a list';
      sub = l ? plural(n) : 'Tap to choose';
    } else {
      n = parseItems(currentText()).length;
      titleEl.textContent = n >= 2 ? plural(n) : `Add at least 2 ${noun}`;
      sub = 'Tap to edit';
    }
    if (cap && n > cap) sub = `First ${cap} shown`;
    subEl.textContent = sub;
    el.classList.toggle('need', !isList && n < 2);
    el.setAttribute('aria-label', `${titleEl.textContent}. ${sub}. Edit ${noun}`);
  }

  /* ---------- items sheet ---------- */
  function openEditor() {
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

    const area = h('textarea', {
      class: 'field textarea source-text',
      attrs: { rows: '8', placeholder: 'One per line', 'aria-label': 'Items', maxlength: String(MAX_TEXT), autocapitalize: 'sentences' },
    });
    area.value = currentText();
    const count = h('span', { class: 'muted field-count' });
    const paintCount = () => {
      const n = parseItems(area.value).length;
      count.textContent = `${n} ${n === 1 ? 'item' : 'items'}`;
    };
    area.addEventListener('input', () => {
      paintCount();
      pending = area.value;
      clearTimeout(timer);
      timer = setTimeout(() => { flush(); onChange(); paintRow(); }, DEBOUNCE);
    });
    const clear = h('button', {
      class: 'btn sm tonal', attrs: { type: 'button' }, text: 'Clear',
      on: { click: () => { area.value = ''; area.dispatchEvent(new Event('input', { bubbles: true })); area.focus(); } },
    });
    const pastePanel = h('div', { class: 'source-panel' }, area,
      h('div', { class: 'source-foot' }, count, h('div', { class: 'source-btns' }, pasteButton(area), clear)));

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
      const opts = lists().map((l) => h('option', { attrs: { value: l.id }, text: `${l.name} (${l.items.length})` }));
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
      paintRow();
    }
    paint();

    const dlg = openSheet({
      title: 'Items',
      body: h('div', { class: 'source-sheet' }, seg.el, noLists, pastePanel, listPanel),
      onClose: () => { if (flush()) onChange(); paintRow(); },
    });
    dlg.classList.add('items-sheet');
    if (sec().source === 'paste') area.focus({ preventScroll: true });
  }

  paintRow();

  return {
    el,
    getItems() {
      if (sec().source === 'list') {
        const l = findList();
        return l ? parseList(l.items.join('\n')) : [];
      }
      return parseList(currentText());
    },
    focus() { openEditor(); },
    cleanup() { flush(); },
  };
}
