// Pure parsers (no DOM, no store): items, weights, import splitting, dice notation.

const MAX_ITEMS = 500;
const MAX_ITEM_LEN = 200;

export function parseItems(text) {
  return String(text).split('\n').map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, MAX_ITEM_LEN)).slice(0, MAX_ITEMS);
}

// "Pizza *3" / "Pizza x3" -> weight 3. "Size \x3" -> literal "Size x3".
export function parseWeighted(line) {
  const s = String(line).trim();
  let m = s.match(/^(.*\S)\s\\([*xX]\d{1,3})$/);
  if (m) return { text: m[1] + ' ' + m[2], weight: 1 };
  m = s.match(/^(.*\S)\s[*xX](\d{1,3})$/);
  if (m) {
    const w = Number(m[2]);
    if (w >= 1 && w <= 100) return { text: m[1], weight: w };
  }
  return { text: s, weight: 1 };
}

export const parseList = (text) => parseItems(text).map(parseWeighted);

export function splitImport(text) {
  const t = String(text);
  const parts = t.includes('\n') ? t.split(/\r?\n/) : t.split(/[,;\t]/);
  return parts.map((s) => s.trim()).filter(Boolean);
}

export function parseDice(str) {
  const s = String(str).trim().replace(/−/g, '-').replace(/\s+/g, '');
  const m = s.match(/^(\d{1,2})?[dD](\d{1,3})(?:([+-])(\d{1,2}))?$/);
  if (!m) return null;
  const count = m[1] === undefined ? 1 : Number(m[1]);
  const sides = Number(m[2]);
  const modifier = m[3] ? (m[3] === '-' ? -1 : 1) * Number(m[4]) : 0;
  if (count < 1 || count > 12 || sides < 2 || sides > 100 || modifier < -99 || modifier > 99) return null;
  return { count, sides, modifier };
}

export function formatDice({ count, sides, modifier }) {
  return (count > 1 ? count : '') + 'd' + sides + (modifier > 0 ? '+' + modifier : modifier < 0 ? String(modifier) : '');
}
