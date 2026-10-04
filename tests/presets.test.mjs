// Run: node tests/presets.test.mjs
import assert from 'node:assert/strict';
import { CONFIG_DEFAULTS, applyConfig } from '../js/tools.js';

const storage = new Map();
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
};
globalThis.location = { hash: '#/number' };

const store = await import('../js/store.js');
const { initTool } = await import('../js/presets.js');
const { getState, update, addPreset, getPreset, setActivePreset, updatePreset, normalize } = store;

const first = addPreset('number', 'First', CONFIG_DEFAULTS.number);
const second = addPreset('number', 'Second', { ...CONFIG_DEFAULTS.number, to: 50 });
initTool('number', { id: first });
update((s) => {
  s.number.noRepeat = true;
  s.number.count = 3;
  s.number.sort = true;
  s.number.drawn = [2, 5];
});
assert.equal(getPreset(first).config.noRepeat, false);
assert.equal(getPreset(first).draft.noRepeat, true);

// A fresh store instance reads the actual saved localStorage payload.
const reloaded = await import('../js/store.js?reloaded');
assert.equal(reloaded.getPreset(first).draft.noRepeat, true);
assert.equal(reloaded.getState().number.noRepeat, true);
setActivePreset(null);
update((s) => Object.assign(s, reloaded.getState()));
initTool('number', { id: first });
assert.equal(getState().number.noRepeat, true);
assert.equal(getState().number.count, 3);
assert.equal(getState().number.sort, true);
assert.deepEqual(getState().number.drawn, [2, 5]);
console.log('ok - preset changes and pool survive a fresh session');

initTool('number', { id: second });
assert.equal(getState().number.noRepeat, false);
assert.equal(getPreset(second).draft, undefined);
initTool('number', { id: first });
assert.equal(getState().number.noRepeat, true);
assert.equal(getState().number.count, 3);
setActivePreset(null);
update((s) => { s.number.count = 10; });
initTool('number', { id: first });
assert.equal(getState().number.count, 3);
console.log('ok - drafts belong to their own preset');

updatePreset(first, getPreset(first).draft);
assert.equal(getPreset(first).config.noRepeat, true);
assert.equal(getPreset(first).draft, undefined);
update((s) => { s.number.noRepeat = false; });
assert.equal(getPreset(first).draft.noRepeat, false);
update((s) => applyConfig('number', s.number, getPreset(first).config));
assert.equal(getState().number.noRepeat, true);
assert.equal(getPreset(first).draft, undefined);
console.log('ok - Update commits changes and Revert discards them');

const rawPreset = { id: 'valid', tool: 'number', name: 'Valid', config: CONFIG_DEFAULTS.number };
assert.equal(normalize({ presets: [{ ...rawPreset, draft: { noRepeat: 'bad' } }] }).presets[0].draft, undefined);
assert.equal(normalize({ presets: [rawPreset] }).presets[0].draft, undefined);
console.log('ok - invalid drafts are ignored and older presets remain compatible');
