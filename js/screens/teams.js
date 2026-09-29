import { h, topBar, fab, stepper, segmented, announce, toast, decorMotion, resultActions, setShown, capHistory, PALETTE } from '../ui.js';
import { getState, update, addHistory } from '../store.js';
import { splitTeams } from '../rng.js';
import { click, vibrate } from '../feedback.js';
import { setPrimaryAction } from '../router.js';
import { initTool, toolChrome, share } from '../presets.js';
import { sourceSummary } from './source.js';

const sec = () => getState().teams;

export function render(root, params = {}) {
  const init = initTool('teams', params);
  if (!init) return;
  let lastCopy = '';
  const chrome = toolChrome({ tool: 'teams', preset: init.preset, title: 'Teams', historyKey: 'teams', shareText: () => lastCopy });
  const source = sourceSummary({ tool: 'teams', noun: 'names' });

  const settings = h('div', { class: 'card settings-card' });
  const modeSeg = segmented({
    label: 'Split by', options: [['teams', 'Teams'], ['size', 'Group size']], value: sec().mode,
    onChange: (v) => { update((s) => { s.teams.mode = v; }); paintSettings(); },
  });
  function paintSettings() {
    const mode = sec().mode;
    const step = stepper({
      label: mode === 'teams' ? 'teams' : 'group size', value: sec().n, min: 2, max: 50,
      format: (v) => (mode === 'teams' ? `${v} teams` : `${v} per group`),
      onChange: (v) => update((s) => { s.teams.n = v; }),
    });
    settings.replaceChildren(modeSeg.el, h('div', { class: 'row' },
      h('div', { class: 'row-text' }, h('div', { class: 'row-label', text: mode === 'teams' ? 'Teams' : 'Group size' })), step.el));
  }
  paintSettings();

  const placeholder = h('p', { class: 'muted region-empty', text: 'Tap Split to make teams' });
  const region = h('div', { class: 'scroll-region' }, placeholder);
  const actions = resultActions({ getText: () => lastCopy, onShare: () => share('teams', () => lastCopy, init.preset) });

  function split() {
    const names = source.getItems().map((i) => i.text);
    if (names.length < 2) { toast('Add at least 2 names'); return; }
    const { mode, n } = sec();
    if (mode === 'teams' && n > names.length) toast(`Only ${names.length} names — made ${names.length} teams`);
    const teams = splitTeams(names, mode, n);
    lastCopy = teams.map((t, i) => `Team ${i + 1}: ${t.join(', ')}`).join('\n');
    const cards = teams.map((members, i) => {
      const hid = `team-h-${i}`;
      return h('section', { class: 'group team-card' + (decorMotion() ? ' reveal' : ''), attrs: { 'aria-labelledby': hid }, style: { animationDelay: `${i * 40}ms` } },
        h('h2', { class: 'team-head', attrs: { id: hid } },
          h('span', { class: 'team-dot', style: { background: PALETTE[i % PALETTE.length] }, attrs: { 'aria-hidden': 'true' } }),
          h('span', { text: `Team ${i + 1}` }),
          h('span', { class: 'muted team-count', text: String(members.length) })),
        h('ul', { class: 'team-list' }, ...members.map((m) => h('li', { text: m }))));
    });
    region.replaceChildren(h('div', { class: 'teams-grid' }, ...cards));
    region.scrollTop = 0;
    setShown(actions, true);
    click();
    vibrate(15);
    addHistory('teams', capHistory(lastCopy.split('\n').join(' · ')));
    announce(`Split into ${teams.length} teams`);
  }

  const fabEl = fab({ label: 'Split', icon: 'teams', onClick: split });
  root.append(
    topBar({ title: chrome.title, actions: chrome.actions }),
    h('div', { class: 'content tool-stack' }, chrome.bar, source.el, settings, region,
      h('div', { class: 'foot-row' }, actions)),
    fabEl);
  setPrimaryAction(split);
  if (init.edit) requestAnimationFrame(() => source.focus());
  return () => { source.cleanup(); chrome.cleanup(); };
}
