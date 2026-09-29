import { h, topBar, fab, announce, toast, motionOn, resultActions, scrollToResult, capHistory } from '../ui.js';
import { addHistory } from '../store.js';
import { shuffle as shuffleArr } from '../rng.js';
import { click, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { initTool, toolChrome, share } from '../presets.js';
import { sourceCard } from './source.js';

export function render(root, params = {}) {
  const init = initTool('shuffle', params);
  if (!init) return;
  let lastCopy = '';
  const chrome = toolChrome({ tool: 'shuffle', preset: init.preset, title: 'Shuffle', historyKey: 'shuffle', shareText: () => lastCopy });
  const source = sourceCard({ tool: 'shuffle' });
  const result = h('ol', { class: 'group shuffle-out', attrs: { hidden: true, 'aria-label': 'Shuffled order' } });
  const actions = resultActions({ getText: () => lastCopy, onShare: () => share('shuffle', () => lastCopy, init.preset) });

  function doShuffle() {
    const items = source.getItems().map((i) => i.text);
    if (items.length < 2) { toast('Add at least 2 items'); return; }
    const out = shuffleArr(items.slice());
    lastCopy = out.map((t, i) => `${i + 1}. ${t}`).join('\n');
    result.replaceChildren(...out.map((t, i) => h('li', { class: motionOn() ? 'reveal' : '', style: { animationDelay: `${Math.min(i, 12) * 25}ms` } },
      h('span', { class: 'shuffle-idx', text: String(i + 1) }), h('span', { class: 'shuffle-text', text: t }))));
    result.hidden = false;
    actions.hidden = false;
    click();
    vibrate(15);
    addHistory('shuffle', capHistory(out.join(', ')));
    announce(`Shuffled ${out.length} items`);
    scrollToResult(result);
  }

  const fabEl = fab({ label: 'Shuffle', icon: 'shuffle', onClick: doShuffle });
  root.append(
    topBar({ title: chrome.title, actions: chrome.actions }),
    h('div', { class: 'content tool-stack' }, chrome.bar, source.el, result, actions),
    fabEl);
  setPrimaryAction(doShuffle);
  if (init.edit) requestAnimationFrame(() => source.focus());
  return () => { source.cleanup(); chrome.cleanup(); };
}
