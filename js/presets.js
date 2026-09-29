// Presets, tool chrome (menu, preset bar) and share. DOM module.
import { h, iconButton, historyButton, soundMenuItem, openMenu, promptDialog, confirmDialog, toast, copyText } from './ui.js';
import {
  getState, update, subscribe, getPreset, addPreset, updatePreset, renamePreset, deletePreset,
  MAX_PRESETS, MAX_PRESETS_PER_TOOL,
} from './store.js';
import {
  toolById, SCHEMAS, extractConfig, configKey, applyConfig, fromParams, toParams, summary,
} from './tools.js';
import { hashQuery, stripHashQuery, replace, remount } from './router.js';
import { openHistorySheet } from './screens/history.js';
import { helpButton } from './help.js';

const siteRoot = () => new URL('../', import.meta.url).href;

function applyIfDiffers(tool, cfg) {
  if (configKey(tool, extractConfig(tool, getState()[tool])) === configKey(tool, cfg)) return;
  update((s) => { applyConfig(tool, s[tool], cfg); });
}

// Call first in render(). Returns null if it redirected.
export function initTool(tool, params = {}) {
  const t = toolById(tool);
  let preset = null;
  if (params.id) {
    preset = getPreset(params.id);
    if (!preset || preset.tool !== tool) {
      toast('Preset not found');
      replace('#' + t.route);
      return null;
    }
    applyIfDiffers(tool, preset.config);
  } else if (SCHEMAS[tool]) {
    const q = hashQuery();
    if (SCHEMAS[tool].some((f) => q.has(f[0]))) {
      const cfg = fromParams(tool, q);
      if (cfg) applyIfDiffers(tool, cfg);
      else toast('This link has invalid settings');
      stripHashQuery();
    }
  }
  const q = hashQuery();
  const edit = q.get('edit') === '1';
  if ([...q.keys()].length) stripHashQuery();
  return { preset, edit };
}

export function limitMessage(tool) {
  const ps = getState().presets;
  if (ps.filter((p) => p.tool === tool).length >= MAX_PRESETS_PER_TOOL) return `Preset limit reached (${MAX_PRESETS_PER_TOOL} per tool)`;
  if (ps.length >= MAX_PRESETS) return `Preset limit reached (${MAX_PRESETS} total)`;
  return '';
}

async function deliver({ text, url, truncated }) {
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Random', text, url });
      if (truncated) toast('Link includes the first 100 items');
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  await copyText(text + '\n' + url);
  if (truncated) toast('Link includes the first 100 items');
}

export function share(tool, shareText = () => '', preset = null) {
  const t = toolById(tool);
  const st = getState();
  let query = '';
  let truncated = false;
  let sum = '';
  if (t.presets) {
    const cfg = extractConfig(tool, st[tool]);
    const r = toParams(tool, cfg, st.lists);
    query = '?' + r.query;
    truncated = r.truncated;
    sum = summary(tool, cfg, st.lists);
  }
  const url = siteRoot() + '#' + t.route + query;
  const text = shareText() || `Random: ${preset ? preset.name : t.label}${sum ? ' — ' + sum : ''}`;
  return deliver({ text, url, truncated });
}

const CAP_ITEMS = 100;
const CAP_CHARS = 2000;
export function shareList(name, items, text = `Random list: ${name}`) {
  let list = items.slice(0, CAP_ITEMS);
  let truncated = list.length < items.length;
  while (list.length && list.join('\n').length > CAP_CHARS) { list = list.slice(0, -1); truncated = true; }
  const q = new URLSearchParams({ name, items: list.join('\n') });
  return deliver({ text, url: siteRoot() + '#/list/new?' + q.toString(), truncated });
}

export function toolChrome({ tool, preset, title, historyKey, shareText }) {
  const t = toolById(tool);
  const section = () => getState()[tool];
  const current = () => extractConfig(tool, section());
  const live = () => (preset ? getPreset(preset.id) : null);

  const text = h('div', { class: 'preset-bar-text', attrs: { 'aria-live': 'polite' } });
  const bar = h('div', { class: 'preset-bar', attrs: { hidden: true } }, text,
    h('div', { class: 'preset-bar-actions' },
      h('button', { class: 'btn sm', attrs: { type: 'button' }, text: 'Update', on: { click: doUpdate } }),
      h('button', { class: 'btn sm', attrs: { type: 'button' }, text: 'Revert', on: { click: doRevert } })));

  function paintBar() {
    const p = live();
    const dirty = !!p && configKey(tool, current()) !== configKey(tool, p.config);
    if (dirty) {
      const msg = 'Unsaved changes';
      if (text.textContent !== msg) text.textContent = msg;
    } else text.textContent = '';
    bar.hidden = !dirty;
  }

  function doUpdate() {
    const p = live();
    if (!p) return;
    updatePreset(p.id, current());
    toast('Preset updated');
  }

  function doRevert() {
    const p = live();
    if (!p) return;
    update((s) => { applyConfig(tool, s[tool], p.config); });
    remount();
  }

  async function saveNew(defaultName) {
    const limit = limitMessage(tool);
    if (limit) { toast(limit); return; }
    const name = await promptDialog({
      title: 'Save preset', label: 'Name', value: defaultName.slice(0, 60), confirmLabel: 'Save',
    });
    if (name === null) return;
    const id = addPreset(tool, name, current());
    if (!id) { toast(limitMessage(tool) || 'Could not save preset'); return; }
    toast('Preset saved');
    replace(`#${t.route}/p/${encodeURIComponent(id)}`);
  }

  async function doRename() {
    const p = live();
    if (!p) return;
    const name = await promptDialog({ title: 'Rename preset', label: 'Name', value: p.name, confirmLabel: 'Rename' });
    if (name === null) return;
    renamePreset(p.id, name);
    const h1 = document.querySelector('#app h1');
    if (h1) h1.textContent = live().name;
    paintBar();
  }

  async function doDelete() {
    const p = live();
    if (!p) return;
    if (!(await confirmDialog({ message: `Delete preset "${p.name}"?` }))) return;
    deletePreset(p.id);
    toast('Preset deleted');
    replace('#' + t.route);
  }

  const menuBtn = iconButton({
    icon: 'more', label: 'Tool options',
    onClick: () => {
      const items = [soundMenuItem()];
      if (t.presets) {
        items.push({
          label: preset ? 'Save as new preset…' : 'Save as preset…',
          onClick: () => saveNew(preset ? `${live()?.name ?? ''} 2` : summary(tool, current(), getState().lists)),
        });
        if (preset) {
          items.push({ label: 'Rename preset…', onClick: doRename });
          items.push({ label: 'Delete preset', danger: true, onClick: doDelete });
        }
      }
      items.push({ label: 'Share…', onClick: () => share(tool, shareText, live()) });
      openMenu(menuBtn, items);
    },
  });
  menuBtn.setAttribute('aria-haspopup', 'menu');

  const unsub = subscribe(paintBar);
  paintBar();
  return {
    title: preset ? preset.name : title,
    actions: [historyButton(() => openHistorySheet(historyKey, t.label)), menuBtn, helpButton(tool)],
    bar,
    cleanup: unsub,
  };
}
