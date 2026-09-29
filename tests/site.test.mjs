import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parsePreset } from '../js/site.js';
import { PAGES, GROUPS } from '../tools/pages-data.mjs';
import { BUILTIN_LISTS } from '../js/tools.js';

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

test('parsePreset accepts tool shapes', () => {
  assert.deepEqual(parsePreset({ dice: { count: 1, sides: 20, modifier: 0 } }), { dice: { count: 1, sides: 20, modifier: 0 } });
  assert.deepEqual(parsePreset('{"lottery":{"n":69,"k":5}}'), { lottery: { n: 69, k: 5 } });
  for (const bad of [
    { dice: { sides: 1 } }, { dice: { foo: 1 } }, { dice: {}, number: {} }, { teams: { n: 3 } },
    { dice: null }, { dice: [] }, { cards: { count: 11 } },
  ]) assert.equal(parsePreset(bad), null, JSON.stringify(bad));
});

test('page data: 29 pages, groups, copy limits', () => {
  assert.equal(PAGES.length, 29);
  const groups = new Set(GROUPS.map(([id]) => id));
  const seen = new Set();
  for (const p of PAGES.filter((x) => x.tool && x.slug)) {
    assert.ok(groups.has(p.group), 'group: ' + p.slug);
    assert.ok(p.nav && p.blurb, 'nav/blurb: ' + p.slug);
    assert.ok(p.intro.length >= 2 && p.faq.length >= 2, 'copy: ' + p.slug);
  }
  for (const p of PAGES) {
    assert.ok(p.description.length >= 50 && p.description.length <= 160, 'description length: ' + p.slug);
    assert.ok(!seen.has(p.title) && !seen.has(p.description), 'unique: ' + p.slug);
    seen.add(p.title); seen.add(p.description);
    if (p.preset?.list) {
      const b = BUILTIN_LISTS[p.preset.list.id];
      assert.deepEqual(p.preset.list.items, b.items);
      assert.equal(p.entry, '/list/' + p.preset.list.id);
    }
  }
});

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

test('help dialog: SEO copy, links without self link, no below-the-fold', () => {
  for (const p of PAGES.filter((x) => x.tool)) {
    const html = readFileSync(path.join(ROOT, p.slug, 'index.html'), 'utf8');
    assert.equal((html.match(/<dialog id="help"/g) || []).length, 1, 'one dialog: ' + p.slug);
    const dlg = html.match(/<dialog id="help"[\s\S]*?<\/dialog>/)[0];
    assert.ok(dlg.includes(`id="help-h1" tabindex="-1">${esc(p.h1)}</h1>`), 'h1: ' + p.slug);
    for (const t of p.intro) assert.ok(dlg.includes(`<p>${esc(t)}</p>`), 'intro: ' + p.slug);
    for (const [q] of p.faq) assert.ok(dlg.includes(`<h3>${esc(q)}</h3>`), 'faq: ' + p.slug);
    const nav = dlg.match(/<nav class="help-links"[\s\S]*?<\/nav>/)[0];
    if (p.slug) {
      assert.ok(!nav.includes(`href="../${p.slug}/"`), 'no self link: ' + p.slug);
      assert.ok(nav.includes('href="../">All tools'), 'all tools link: ' + p.slug);
    } else {
      for (const x of PAGES.filter((y) => y.tool && y.slug)) assert.ok(nav.includes(`href="${x.slug}/"`), 'root links ' + x.slug);
    }
    assert.ok(/class="help-foot"><a href="(\.\.\/)?privacy\/">Privacy<\/a>/.test(dlg), 'foot: ' + p.slug);
    for (const bad of ['id="below"', 'class="about"', 'other-tools', 'site-footer']) assert.ok(!html.includes(bad), `${bad}: ${p.slug}`);
  }
  const priv = readFileSync(path.join(ROOT, 'privacy/index.html'), 'utf8');
  assert.ok(priv.includes('class="doc-page"') && !priv.includes('id="help"'));
});

test('JSON-LD FAQ questions equal page data', () => {
  for (const p of PAGES.filter((x) => x.tool)) {
    const html = readFileSync(path.join(ROOT, p.slug, 'index.html'), 'utf8');
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
    const faq = ld['@graph'].find((n) => n['@type'] === 'FAQPage');
    assert.deepEqual(faq.mainEntity.map((q) => q.name), p.faq.map(([q]) => q), p.slug);
    assert.ok(ld['@graph'].some((n) => n['@type'] === 'WebApplication'));
  }
});

test('sw precache and manifest', () => {
  const sw = readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  for (const m of ['tools', 'parse', 'search', 'presets', 'help'].map((x) => `./js/${x}.js`)
    .concat(['source', 'teams', 'shuffle', 'wheel', 'lottery', 'cards', 'lists'].map((x) => `./js/screens/${x}.js`))) {
    assert.ok(sw.includes(`'${m}'`), 'precache ' + m);
  }
  for (const p of PAGES.filter((x) => x.slug)) assert.ok(sw.includes(`'./${p.slug}/'`), 'precache page ' + p.slug);
  const man = JSON.parse(readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  assert.deepEqual(man.shortcuts.map((x) => x.name), ['Number', 'Dice', 'Coin', 'Wheel']);
  assert.equal(man.theme_color, '#0B0B0C');
});

test('source hygiene: no Math.random, innerHTML only in ui.icon, no old cyan', () => {
  const files = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const f = path.join(d, n); if (statSync(f).isDirectory()) walk(f); else if (f.endsWith('.js')) files.push(f); } };
  walk(path.join(ROOT, 'js'));
  let inner = 0;
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    assert.ok(!/Math\.random/.test(src), f);
    inner += (src.match(/innerHTML/g) || []).length;
    assert.ok(!/4DD0E1|00838F|00ACC1/i.test(src), f);
  }
  assert.equal(inner, 1);
  assert.ok(!/4DD0E1|00838F|00ACC1/i.test(readFileSync(path.join(ROOT, 'css/app.css'), 'utf8')));
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
  assert.equal(files.length, PAGES.length);
  for (const f of files) {
    const html = readFileSync(f, 'utf8');
    assert.ok(!/\{\{[A-Z_]+\}\}/.test(html), 'no unresolved placeholders: ' + f);
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) JSON.parse(m[1]);
    const canon = (html.match(/rel="canonical"/g) || []).length;
    if (empty) {
      assert.ok(!/googlesyndication|adsbygoogle|ad-slot/.test(html), 'no ads markup: ' + f);
      assert.equal(canon, 0);
    } else if (!/privacy/.test(f)) {
      assert.equal(canon, 1);
    }
  }
  if (empty) assert.ok(!existsSync(path.join(ROOT, 'ads.txt')));
});

console.log(`\n${passed} tests passed`);
