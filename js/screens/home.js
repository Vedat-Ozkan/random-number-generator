import { h, icon, iconButton, topBar, openMenu, confirmDialog, promptDialog, announce, isMenuOpen } from '../ui.js';
import { getState, subscribe, deleteList, renameList, renamePreset, deletePreset } from '../store.js';
import { TOOLS, summary } from '../tools.js';
import { buildIndex, search } from '../search.js';

const COLLAPSE_AFTER = 5;
const expanded = new Set(); // tool ids whose child rows are fully shown (session only)

const plural = (n) => `${n} ${n === 1 ? 'item' : 'items'}`;
const tile = (name) => h('span', { class: 'tile' }, icon(name));

// Child rows (presets, or saved lists for the List tool) of a tool.
function childrenOf(tool) {
  const st = getState();
  if (tool.id === 'list') {
    return st.lists.map((l) => ({
      name: l.name, sub: plural(l.items.length), href: `#/list/${encodeURIComponent(l.id)}`,
      editHref: `#/list/${encodeURIComponent(l.id)}/edit`,
      rename: (n) => renameList(l.id, n),
      remove: () => deleteList(l.id),
      deleteMessage: `Delete list "${l.name}"?`,
    }));
  }
  return st.presets.filter((p) => p.tool === tool.id).map((p) => ({
    name: p.name, sub: summary(p.tool, p.config, st.lists), href: `#${tool.route}/p/${encodeURIComponent(p.id)}`,
    editHref: `#${tool.route}/p/${encodeURIComponent(p.id)}?edit=1`,
    rename: (n) => renamePreset(p.id, n),
    remove: () => deletePreset(p.id),
    deleteMessage: `Delete preset "${p.name}"?`,
  }));
}

function childRow(c) {
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

function toolBlock(t) {
  const kids = h('div', { class: 'children' });
  const head = t.route
    ? h('a', { class: 'tool-row', attrs: { href: '#' + t.route } },
      tile(t.icon), h('span', { class: 'row-label', text: t.label }), icon('chevron', 'chev'))
    : h('div', { class: 'tool-row' },
      tile(t.icon), h('span', { class: 'row-label', text: t.label }),
      h('a', { class: 'icon-btn plus-btn', attrs: { href: '#/list/new', 'aria-label': 'New list' } }, icon('plus')));

  function paint() {
    const list = childrenOf(t);
    if (!list.length) {
      if (t.id === 'list') kids.replaceChildren(h('div', { class: 'child-row empty muted', text: 'No lists yet — tap + to create one' }));
      else kids.replaceChildren();
      return;
    }
    const open = expanded.has(t.id);
    const shown = list.length > COLLAPSE_AFTER && !open ? list.slice(0, COLLAPSE_AFTER) : list;
    const nodes = shown.map(childRow);
    if (list.length > COLLAPSE_AFTER) {
      const btn = h('button', {
        class: 'child-more', attrs: { type: 'button', 'aria-expanded': String(open) },
        text: open ? 'Show less' : `Show all (${list.length})`,
        on: { click: () => { if (expanded.has(t.id)) expanded.delete(t.id); else expanded.add(t.id); paint(); } },
      });
      nodes.push(btn);
    }
    kids.replaceChildren(...nodes);
  }
  paint();
  return { el: h('div', { class: 'tool-item' }, head, kids), paint };
}

function highlight(label, q) {
  const i = q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return [label];
  return [label.slice(0, i), h('mark', { text: label.slice(i, i + q.length) }), label.slice(i + q.length)];
}

export function render(root) {
  const blocks = TOOLS.map(toolBlock);
  const group = (section) => h('div', { class: 'group' },
    ...TOOLS.map((t, i) => (t.section === section ? blocks[i].el : null)));

  const sections = h('div', { class: 'home-sections' },
    h('h2', { class: 'section-label', text: 'Tools' }), group('main'),
    h('h2', { class: 'section-label', text: 'More tools' }), group('more'));

  const input = h('input', {
    attrs: {
      type: 'search', enterkeyhint: 'go', autocomplete: 'off', spellcheck: 'false',
      'aria-label': 'Search tools and presets', placeholder: 'Search tools and presets',
    },
  });
  const clear = iconButton({
    icon: 'close', label: 'Clear search', cls: 'search-clear',
    onClick: () => { input.value = ''; onInput(); input.focus(); },
  });
  clear.hidden = true;
  const searchEl = h('div', { class: 'search' }, icon('search', 'sm search-icon'), input, clear);
  const results = h('div', { class: 'search-panel' });
  results.hidden = true;

  let announceTimer = 0;

  function paintResults() {
    const q = input.value.trim();
    if (!q) return;
    const found = search(buildIndex(getState()), q);
    if (!found.length) {
      results.replaceChildren(h('div', { class: 'search-empty' },
        h('p', { class: 'search-empty-title', text: `No results for "${q}"` }),
        h('p', { class: 'muted', text: 'Try d20, coin, teams or wheel' })));
    } else {
      results.replaceChildren(h('ul', { class: 'search-results group', attrs: { 'aria-label': 'Search results' } },
        ...found.map((e) => h('li', {},
          h('a', { class: 'tool-row', attrs: { href: e.href } },
            tile(e.icon),
            h('span', { class: 'row-body' },
              h('span', { class: 'row-label' }, ...highlight(e.label, q)),
              h('span', { class: 'row-sub', text: e.sub })),
            icon('chevron', 'chev'))))));
    }
    return found.length;
  }

  function onInput() {
    const q = input.value.trim();
    clear.hidden = !input.value;
    sections.hidden = !!q;
    results.hidden = !q;
    if (!q) { clearTimeout(announceTimer); return; }
    const n = paintResults();
    clearTimeout(announceTimer);
    announceTimer = setTimeout(() => announce(n ? `${n} ${n === 1 ? 'result' : 'results'}` : 'No results'), 400);
  }
  input.addEventListener('input', onInput);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const first = results.querySelector('a');
      if (first) { e.preventDefault(); location.hash = first.getAttribute('href'); }
    } else if (e.key === 'ArrowDown') {
      const first = results.querySelector('a');
      if (first) { e.preventDefault(); first.focus(); }
    } else if (e.key === 'Escape') {
      if (input.value) { e.stopPropagation(); input.value = ''; onInput(); } else input.blur();
    }
  });
  results.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const links = [...results.querySelectorAll('a')];
    const i = links.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    if (e.key === 'ArrowDown') links[Math.min(i + 1, links.length - 1)].focus();
    else if (i === 0) input.focus();
    else links[i - 1].focus();
  });

  function onSlash(e) {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t instanceof Element && t.closest('input, textarea, select, [contenteditable]')) return;
    if (isMenuOpen() || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    input.focus();
  }
  window.addEventListener('keydown', onSlash);

  const unsub = subscribe(() => {
    blocks.forEach((b) => b.paint());
    if (input.value.trim()) paintResults();
  });

  root.append(
    topBar({
      title: 'Random', showBack: false, large: true,
      actions: [h('a', { class: 'icon-btn', attrs: { href: '#/settings', 'aria-label': 'Settings' } }, icon('settings'))],
    }),
    h('div', { class: 'content home-stack' }, searchEl, sections, results));

  return () => { window.removeEventListener('keydown', onSlash); unsub(); clearTimeout(announceTimer); };
}
