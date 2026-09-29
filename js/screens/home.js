import { h, icon, iconButton, topBar, announce, isMenuOpen } from '../ui.js';
import { getState, subscribe, renamePreset, deletePreset } from '../store.js';
import { TOOLS, summary } from '../tools.js';
import { buildIndex, search } from '../search.js';
import { helpButton } from '../help.js';
import { childRow, listChildren } from './lists.js';

const tile = (name) => h('span', { class: 'tile' }, icon(name));

// Child rows (presets, or saved lists for the List tool) of a tool.
function childrenOf(tool) {
  if (tool.id === 'list') return listChildren();
  const st = getState();
  return st.presets.filter((p) => p.tool === tool.id).map((p) => ({
    name: p.name, sub: summary(p.tool, p.config, st.lists), href: `#${tool.route}/p/${encodeURIComponent(p.id)}`,
    editHref: `#${tool.route}/p/${encodeURIComponent(p.id)}?edit=1`,
    rename: (n) => renamePreset(p.id, n),
    remove: () => deletePreset(p.id),
    deleteMessage: `Delete preset "${p.name}"?`,
  }));
}

function highlight(label, q) {
  const i = q ? label.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return [label];
  return [label.slice(0, i), h('mark', { text: label.slice(i, i + q.length) }), label.slice(i + q.length)];
}

export function render(root) {
  const grid = h('nav', { class: 'tool-grid', attrs: { 'aria-label': 'Tools' } },
    ...TOOLS.map((t) => h('a', { class: 'tool-tile', attrs: { href: '#' + t.route } }, tile(t.icon), h('span', { class: 'tool-tile-label', text: t.label }))));
  const savedRegion = h('div', { class: 'scroll-region saved-region' });
  const sections = h('div', { class: 'home-sections' },
    grid,
    h('h2', { class: 'section-label', text: 'Saved' }));

  function paintSaved() {
    const top = savedRegion.scrollTop;
    const groups = TOOLS.map((t) => [t, childrenOf(t)]).filter(([, kids]) => kids.length);
    if (!groups.length) {
      savedRegion.replaceChildren(h('p', { class: 'muted region-empty', text: 'Presets and lists you save appear here' }));
      return;
    }
    savedRegion.replaceChildren(...groups.map(([t, kids]) => h('section', { class: 'saved-group', attrs: { 'aria-label': t.label } },
      h('div', { class: 'saved-head' }, tile(t.icon), h('span', { text: t.label })),
      ...kids.map(childRow))));
    savedRegion.scrollTop = top;
  }
  paintSaved();

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
  const results = h('div', { class: 'search-panel scroll-region' });
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
    savedRegion.hidden = !!q;
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
    paintSaved();
    if (input.value.trim()) paintResults();
  });

  root.append(
    topBar({
      title: 'Random', showBack: false, cls: 'home',
      actions: [h('a', { class: 'icon-btn', attrs: { href: '#/settings', 'aria-label': 'Settings' } }, icon('settings')), helpButton('home')],
    }),
    h('div', { class: 'content home-stack' }, searchEl, sections, savedRegion, results));

  return () => { window.removeEventListener('keydown', onSlash); unsub(); clearTimeout(announceTimer); };
}
