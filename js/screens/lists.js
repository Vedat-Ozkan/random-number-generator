// #/lists: saved lists, ready-made lists and a "New list" button.
import { h, iconButton, topBar, fab, openMenu, confirmDialog, promptDialog } from '../ui.js';
import { getState, subscribe, deleteList, renameList } from '../store.js';
import { BUILTIN_LISTS } from '../tools.js';
import { helpButton } from '../help.js';

export const plural = (n) => `${n} ${n === 1 ? 'item' : 'items'}`;

// Child rows for the saved lists (shared with Home's Saved region).
export function listChildren() {
  return getState().lists.map((l) => ({
    name: l.name, sub: plural(l.items.length), href: `#/list/${encodeURIComponent(l.id)}`,
    editHref: `#/list/${encodeURIComponent(l.id)}/edit`,
    rename: (n) => renameList(l.id, n),
    remove: () => deleteList(l.id),
    deleteMessage: `Delete list "${l.name}"?`,
  }));
}

// A saved item row: link plus a "⋮" menu (Rename, Edit, Delete).
export function childRow(c) {
  const more = iconButton({
    icon: 'more', label: `Options for ${c.name}`,
    onClick: (e) => {
      e.preventDefault();
      e.stopPropagation();
      openMenu(more, [
        {
          label: 'Rename',
          onClick: async () => {
            const n = await promptDialog({ title: 'Rename', label: 'Name', value: c.name, confirmLabel: 'Rename' });
            if (n !== null) c.rename(n);
          },
        },
        { label: 'Edit', onClick: () => { location.hash = c.editHref; } },
        {
          label: 'Delete', danger: true,
          onClick: async () => { if (await confirmDialog({ message: c.deleteMessage })) c.remove(); },
        },
      ]);
    },
  });
  more.setAttribute('aria-haspopup', 'menu');
  return h('div', { class: 'child-row' },
    h('a', { class: 'child-link', attrs: { href: c.href } },
      h('span', { class: 'child-name', text: c.name }),
      h('span', { class: 'child-sub', text: c.sub })),
    more);
}

export function render(root) {
  const region = h('div', { class: 'scroll-region lists-region' });

  function paint() {
    const top = region.scrollTop;
    const saved = listChildren();
    const have = new Set(getState().lists.map((l) => l.id));
    const ready = Object.entries(BUILTIN_LISTS).filter(([id]) => !have.has(id));
    region.replaceChildren(
      h('h2', { class: 'section-label first', text: 'Your lists' }),
      saved.length
        ? h('div', { class: 'child-list' }, ...saved.map(childRow))
        : h('p', { class: 'muted region-empty left', text: 'No lists yet' }),
      ready.length ? h('h2', { class: 'section-label', text: 'Ready-made' }) : null,
      ready.length
        ? h('div', { class: 'child-list' }, ...ready.map(([id, b]) => h('div', { class: 'child-row' },
          h('a', { class: 'child-link', attrs: { href: `#/list/${id}` } },
            h('span', { class: 'child-name', text: b.name }),
            h('span', { class: 'child-sub', text: plural(b.items.length) })),
          h('span', { class: 'child-slot', attrs: { 'aria-hidden': 'true' } }))))
        : null);
    region.scrollTop = top;
  }
  paint();
  const unsub = subscribe(paint);

  root.append(
    topBar({ title: 'Lists', actions: [helpButton('lists')] }),
    h('div', { class: 'content lists-page' }, region),
    fab({ label: 'New list', icon: 'plus', onClick: () => { location.hash = '#/list/new'; } }));
  return unsub;
}
