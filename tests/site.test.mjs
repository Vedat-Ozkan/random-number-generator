import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePreset } from '../js/site.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0;
const test = (name, fn) => { fn(); passed++; console.log('ok -', name); };

test('parsePreset accepts number and swaps', () => {
  assert.deepEqual(parsePreset('{"number":{"from":1,"to":100}}'), { number: { from: 1, to: 100 } });
  assert.deepEqual(parsePreset({ number: { from: 9, to: -3 } }), { number: { from: -3, to: 9 } });
  assert.deepEqual(parsePreset({ number: { from: -1e9, to: 1e9 } }), { number: { from: -1e9, to: 1e9 } });
});

test('parsePreset accepts list and normalizes', () => {
  const p = parsePreset({ list: { id: 'preset-names', name: '  Names ', items: [' a ', '', '  ', 'b'] } });
  assert.deepEqual(p, { list: { id: 'preset-names', name: 'Names', items: ['a', 'b'] } });
  assert.equal(parsePreset({ list: { id: 'preset-x', name: 'n'.repeat(100), items: [] } }).list.name.length, 60);
  const big = parsePreset({ list: { id: 'preset-big', name: 'B', items: Array.from({ length: 600 }, () => 'x'.repeat(300)) } });
  assert.equal(big.list.items.length, 500);
  assert.equal(big.list.items[0].length, 200);
});

test('parsePreset rejects bad input', () => {
  for (const bad of [
    '{', '', null, undefined, 5, [], {}, { foo: 1 },
    { number: { from: 1.5, to: 3 } }, { number: { from: 1, to: 2e9 } }, { number: { from: '1', to: 3 } }, { number: null },
    { list: { id: 'default-answer', name: 'x', items: [] } },
    { list: { id: 'preset-<script>', name: 'x', items: [] } },
    { list: { id: 'preset-a', name: '', items: [] } },
    { list: { id: 'preset-a', name: 'x', items: 'nope' } },
    { list: { id: 'preset-a', name: 'x', items: [1] } },
  ]) assert.equal(parsePreset(bad), null, JSON.stringify(bad));
});

const readSafe = (p) => (existsSync(path.join(ROOT, p)) ? readFileSync(path.join(ROOT, p)) : Buffer.alloc(0));
function snapshot() {
  const h = createHash('sha256');
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      if (['node_modules', 'docs', 'tests', '.claude'].includes(name) && dir === ROOT) continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else files.push(full);
    }
  };
  walk(ROOT);
  for (const f of files) { h.update(path.relative(ROOT, f)); h.update(readFileSync(f)); }
  return h.digest('hex');
}
const build = () => execFileSync(process.execPath, [path.join(ROOT, 'tools/build-pages.mjs')], { stdio: 'pipe' });

test('build is idempotent', () => {
  build();
  const a = snapshot();
  build();
  assert.equal(snapshot(), a);
});

const pages = () => {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (['docs', 'tests', 'tools', '.claude', 'js', 'css', 'icons'].includes(name) && dir === ROOT) continue;
      if (statSync(full).isDirectory()) walk(full);
      else if (name === 'index.html') out.push(full);
    }
  };
  walk(ROOT);
  return out;
};

test('generated output with the committed config', () => {
  const config = readFileSync(path.join(ROOT, 'js/config.js'), 'utf8');
  const empty = /SITE_URL: '',/.test(config) && /ADSENSE_CLIENT: '',/.test(config);
  const files = pages();
  assert.equal(files.length, 10);
  for (const f of files) {
    const html = readFileSync(f, 'utf8');
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(html), 'no unresolved placeholders: ' + f);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
    const canon = (html.match(/rel="canonical"/g) || []).length;
    if (empty) {
      assert.ok(!/googlesyndication|adsbygoogle/.test(html), 'no ads markup: ' + f);
      assert.equal(canon, 0);
    } else if (!/privacy/.test(f)) {
      assert.equal(canon, 1);
    }
  }
  if (empty) assert.ok(!existsSync(path.join(ROOT, 'ads.txt')));
});

console.log(`\n${passed} tests passed`);
