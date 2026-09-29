import { h, topBar, fab, announce, toast, decorMotion, resultActions, setShown, capHistory } from '../ui.js';
import { addHistory } from '../store.js';
import { shuffle as shuffleArr } from '../rng.js';
import { click, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { initTool, toolChrome, share } from '../presets.js';
import { sourceSummary } from './source.js';

export function render(root, params = {}) {
  const init = initTool('shuffle', params);
  if (!init) return;
  let lastCopy = '';
  const chrome = toolChrome({ tool: 'shuffle', preset: init.preset, title: 'Shuffle', historyKey: 'shuffle', shareText: () => lastCopy });
  const source = sourceSummary({ tool: 'shuffle', noun: 'items' });
  const result = h('ol', { class: 'shuffle-out', attrs: { 'aria-label': 'Shuffled order' } });
  const placeholder = h('p', { class: 'muted region-empty', text: 'Tap Shuffle for a random order' });
  const region = h('div', { class: 'scroll-region' }, placeholder);
  const actions = resultActions({ getText: () => lastCopy, onShare: () => share('shuffle', () => lastCopy, init.preset) });

  function doShuffle() {
    const items = source.getItems().map((i) => i.text);
    if (items.length < 2) { toast('Add at least 2 items'); return; }
    const out = shuffleArr(items.slice());
    lastCopy = out.map((t, i) => `${i + 1}. ${t}`).join('\n');
    result.replaceChildren(...out.map((t, i) => h('li', { class: decorMotion() ? 'reveal' : '', style: { animationDelay: `${Math.min(i, 12) * 25}ms` } },
      h('span', { class: 'shuffle-idx', text: String(i + 1) }), h('span', { class: 'shuffle-text', text: t }))));
    region.replaceChildren(result);
    region.scrollTop = 0;
    setShown(actions, true);
    click();
    vibrate(15);
    addHistory('shuffle', capHistory(out.join(', ')));
    announce(`Shuffled ${out.length} items`);
  }

  const fabEl = fab({ label: 'Shuffle', icon: 'shuffle', onClick: doShuffle });
  root.append(
    topBar({ title: chrome.title, actions: chrome.actions }),
    h('div', { class: 'content tool-stack' }, chrome.bar, source.el, region,
      h('div', { class: 'foot-row' }, actions)),
    fabEl);
  setPrimaryAction(doShuffle);
  if (init.edit) requestAnimationFrame(() => source.focus());
  return () => { source.cleanup(); chrome.cleanup(); };
}
