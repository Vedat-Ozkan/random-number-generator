import { h, openSheet, copyText } from '../ui.js';
import { getState, clearHistory } from '../store.js';

const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (t) => {
  const d = new Date(t);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export function openHistorySheet(key, title) {
  const list = h('div', { class: 'history-list' });

  const entries = () => getState().history[key] || [];

  function paint() {
    const items = entries();
    copyAll.disabled = clear.disabled = items.length === 0;
    if (!items.length) {
      list.replaceChildren(h('p', { class: 'muted empty', text: 'No results yet' }));
      return;
    }
    list.replaceChildren(...items.map((e) => h('button', {
      class: 'history-row', attrs: { type: 'button' }, on: { click: () => copyText(e.text) },
    }, h('span', { class: 'history-text', text: e.text }), h('span', { class: 'history-time', text: fmtTime(e.t) }))));
  }

  const copyAll = h('button', {
    class: 'btn', attrs: { type: 'button' }, text: 'Copy all',
    on: { click: () => copyText(entries().map((e) => e.text).join('\n')) },
  });
  const clear = h('button', {
    class: 'btn danger-text', attrs: { type: 'button' }, text: 'Clear',
    on: { click: () => { clearHistory(key); paint(); } },
  });
  paint();
  return openSheet({ title: 'History', subtitle: title, body: list, actions: [copyAll, clear] });
}
