// Pure search: normalize text, build an index from state, rank matches.
import { TOOLS, TOOL_KEYWORDS, BUILTIN_LISTS, SHORTCUTS, summary, toolById } from './tools.js';

export const norm = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const KIND_ORDER = { tool: 0, list: 1, preset: 2, shortcut: 3 };

export function buildIndex(state) {
  const out = [];
  const lists = state.lists || [];
  for (const t of TOOLS) {
    out.push({
      kind: 'tool', label: t.label, sub: t.label === 'List' ? 'Pick from a list' : 'Tool',
      href: t.route ? '#' + t.route : '#/list/new', icon: t.icon, keywords: TOOL_KEYWORDS[t.id] || [],
    });
  }
  for (const l of lists) {
    out.push({
      kind: 'list', label: l.name, sub: `List · ${l.items.length} ${l.items.length === 1 ? 'item' : 'items'}`,
      href: '#/list/' + encodeURIComponent(l.id), icon: 'list',
      keywords: ['list', ...(BUILTIN_LISTS[l.id]?.keywords || [])],
    });
  }
  for (const p of state.presets || []) {
    const t = toolById(p.tool);
    if (!t) continue;
    out.push({
      kind: 'preset', label: p.name, sub: `${t.label} · ${summary(p.tool, p.config, lists)}`,
      href: `#${t.route}/p/${encodeURIComponent(p.id)}`, icon: t.icon,
      keywords: [t.label, ...(TOOL_KEYWORDS[t.id] || [])],
    });
  }
  const have = new Set(lists.map((l) => l.id));
  for (const [id, b] of Object.entries(BUILTIN_LISTS)) {
    if (have.has(id)) continue;
    out.push({ kind: 'list', label: b.name, sub: 'List', href: '#/list/' + id, icon: 'list', keywords: ['list', ...b.keywords] });
  }
  for (const s of SHORTCUTS) out.push({ kind: 'shortcut', label: s.label, sub: s.sub, href: s.href, icon: s.icon, keywords: [] });
  return out;
}

const tier = (q, s) => (s.startsWith(q) ? 3 : (' ' + s).includes(' ' + q) ? 2 : s.includes(q) ? 1 : 0);

export function search(index, query, limit = 20) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  index.forEach((e, i) => {
    const labelScore = tier(q, norm(e.label));
    let kwScore = 0;
    for (const k of e.keywords) kwScore = Math.max(kwScore, tier(q, norm(k)));
    const score = Math.max(labelScore > 0 ? labelScore * 2 + 1 : 0, kwScore * 2);
    if (score > 0) scored.push({ e, score, i });
  });
  scored.sort((a, b) => b.score - a.score || KIND_ORDER[a.e.kind] - KIND_ORDER[b.e.kind] || a.i - b.i);
  return scored.slice(0, limit).map((s) => s.e);
}
