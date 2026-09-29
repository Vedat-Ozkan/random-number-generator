import { h, icon, iconButton, topBar, openMenu, confirmDialog } from '../ui.js';
import { getState, deleteList } from '../store.js';

const TOOLS = [
  { label: 'Number', icon: 'number', href: '#/number' },
  { label: 'List', icon: 'list', href: null },
  { label: 'Dice', icon: 'dice', href: '#/dice' },
  { label: 'Cast lots', icon: 'lots', href: '#/lots' },
  { label: 'Coin', icon: 'coin', href: '#/coin' },
];

const watermark = (name) => h('span', { class: 'watermark', attrs: { 'aria-hidden': 'true' } }, icon(name));
const iconCircle = (name) => h('span', { class: 'icon-circle' }, icon(name));

function simpleCard(t) {
  return h('a', { class: 'card home-card', attrs: { href: t.href } },
    iconCircle(t.icon), h('span', { class: 'card-label', text: t.label }), watermark(t.icon));
}

function listCard(t) {
  const rows = h('div', { class: 'card-rows' });

  function paintRows() {
    const lists = getState().lists;
    if (!lists.length) {
      rows.replaceChildren(h('div', { class: 'list-row empty muted', text: 'No lists yet — tap + to create one' }));
      return;
    }
    rows.replaceChildren(...lists.map((l) => {
      const more = iconButton({
        icon: 'more', label: `Options for ${l.name}`,
        onClick: (e) => {
          e.preventDefault();
          e.stopPropagation();
          openMenu(more, [
            { label: 'Edit', onClick: () => { location.hash = `#/list/${encodeURIComponent(l.id)}/edit`; } },
            {
              label: 'Delete', danger: true,
              onClick: async () => {
                if (await confirmDialog({ message: `Delete list "${l.name}"?` })) {
                  deleteList(l.id);
                  paintRows();
                }
              },
            },
          ]);
        },
      });
      more.setAttribute('aria-haspopup', 'menu');
      return h('div', { class: 'list-row' },
        h('a', { class: 'list-link', attrs: { href: `#/list/${encodeURIComponent(l.id)}` } },
          h('span', { class: 'list-name', text: l.name }),
          h('span', { class: 'list-count muted', text: `${l.items.length} ${l.items.length === 1 ? 'item' : 'items'}` })),
        more);
    }));
  }
  paintRows();

  return h('div', { class: 'card home-card list-card' },
    h('div', { class: 'card-head' },
      watermark(t.icon),
      iconCircle(t.icon),
      h('span', { class: 'card-label', text: t.label }),
      h('a', { class: 'icon-btn plus-btn', attrs: { href: '#/list/new', 'aria-label': 'New list' } }, icon('plus'))),
    rows);
}

export function render(root) {
  root.append(
    topBar({
      title: 'Random', showBack: false,
      actions: [h('a', { class: 'icon-btn', attrs: { href: '#/settings', 'aria-label': 'Settings' } }, icon('settings'))],
    }),
    h('div', { class: 'content home-stack' }, TOOLS.map((t) => (t.href ? simpleCard(t) : listCard(t)))));
}
