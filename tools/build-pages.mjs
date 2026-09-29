// Zero-dep generator: HTML pages, sitemap, robots, ads.txt, sw.js precache + cache hash.
// Run from anywhere:  node tools/build-pages.mjs
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const at = (...p) => path.join(ROOT, ...p);
const read = (p) => readFileSync(at(p), 'utf8');
const warnings = [];
const errors = [];
const warn = (m) => { warnings.push(m); console.warn('warning:', m); };
const fail = (m) => errors.push(m);

/* ---------- 1. config ---------- */
const cfgSrc = readFileSync(at('js/config.js'));
const cfg = await import('data:text/javascript;base64,' + cfgSrc.toString('base64'));
const RAW = cfg.CONFIG;
const derivedFor = { SITE_URL: 'SITE_URL', ADSENSE_CLIENT: 'ADSENSE_CLIENT', ADSENSE_SLOT: 'ADSENSE_SLOT', TIP_URL: 'TIP_URL', GOOGLE_SITE_VERIFICATION: 'GSC_TOKEN' };
for (const [key, derived] of Object.entries(derivedFor)) {
  const v = typeof RAW[key] === 'string' ? RAW[key].trim() : '';
  if (v && !cfg[derived]) warn(`config ${key} is invalid and is treated as OFF: ${JSON.stringify(v)}`);
}
const { SITE_URL, ADSENSE_CLIENT, ADS_ON, TIP_URL, TIP_LABEL, GSC_TOKEN } = cfg;
console.log(`SITE_URL: ${SITE_URL || 'off'} | ADSENSE: ${ADS_ON ? 'on' : ADSENSE_CLIENT ? 'client only (no slot)' : 'off'} | TIP_URL: ${TIP_URL || 'off'} | GSC: ${GSC_TOKEN ? 'on' : 'off'}`);

/* ---------- 2. data, template, validation ---------- */
const { PAGES, GROUPS, SITE_NAME, ADS_PRIVACY } = await import(pathToFileURL(at('tools/pages-data.mjs')).href);
const { parsePreset } = await import(pathToFileURL(at('js/site.js')).href);
const groupIds = new Set(GROUPS.map(([id]) => id));
const template = read('tools/page-template.html');

const seen = { slug: new Set(), title: new Set(), description: new Set() };
for (const p of PAGES) {
  if (!/^[a-z0-9-]*$/.test(p.slug)) fail(`bad slug "${p.slug}"`);
  if (seen.slug.has(p.slug)) fail(`duplicate slug "${p.slug}"`);
  seen.slug.add(p.slug);
  if (p.title.length > 65) warn(`title too long (${p.title.length}): ${p.slug || 'home'}`);
  if (seen.title.has(p.title)) fail(`duplicate title: ${p.title}`);
  seen.title.add(p.title);
  if (p.description.length < 50 || p.description.length > 160) fail(`description length ${p.description.length} (50-160): ${p.slug || 'home'}`);
  if (seen.description.has(p.description)) fail(`duplicate description: ${p.slug || 'home'}`);
  seen.description.add(p.description);
  if (p.tool) {
    if (!p.h1) fail(`no h1: ${p.slug}`);
    if (!p.intro || p.intro.length < 2) fail(`needs 2+ intro paragraphs: ${p.slug || 'home'}`);
    if (!p.faq || p.faq.length < 2) fail(`needs 2+ FAQs: ${p.slug || 'home'}`);
    if (p.slug) {
      if (!p.nav) fail(`no nav: ${p.slug}`);
      if (!groupIds.has(p.group)) fail(`missing or invalid group: ${p.slug}`);
    }
  }
  if (p.preset) {
    if (!parsePreset(p.preset)) fail(`invalid preset: ${p.slug}`);
    if (p.preset.list && p.entry !== `/list/${p.preset.list.id}`) fail(`list preset entry mismatch: ${p.slug}`);
    const presetTool = Object.keys(p.preset)[0];
    if (!['number', 'list'].includes(presetTool) && p.entry !== '/' + presetTool) fail(`tool preset entry mismatch: ${p.slug}`);
  }
}
if (errors.length) { errors.forEach((e) => console.error('error:', e)); process.exit(1); }

/* ---------- helpers ---------- */
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const swSrc = read('sw.js');
const jsModules = [...swSrc.matchAll(/'(\.\/js\/[^']+\.js)'/g)].map((m) => m[1]).filter((m) => m !== './js/app.js');
const linkify = (text) => esc(text).replace(/https:\/\/[\w./-]+[\w/-]/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
const pageHref = (base, p) => base + (p.slug ? p.slug + '/' : '');
const canonicalOf = (p) => SITE_URL + (p.slug ? p.slug + '/' : '');

function jsonLd(p) {
  const graph = [];
  const app = {
    '@type': 'WebApplication', name: p.slug ? p.h1 : SITE_NAME,
    ...(SITE_URL ? { url: canonicalOf(p) } : {}),
    description: p.description, applicationCategory: 'UtilitiesApplication', operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript', isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    ...(SITE_URL ? { image: SITE_URL + 'og.png' } : {}),
  };
  graph.push(app);
  graph.push({
    '@type': 'FAQPage',
    mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  });
  if (!p.slug && SITE_URL) graph.push({ '@type': 'WebSite', name: SITE_NAME, alternateName: ['Random Tools', 'Random Number Generator'], url: SITE_URL });
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

function seoMeta(p) {
  const l = [];
  const canon = p.slug || SITE_URL ? canonicalOf(p) : '';
  if (SITE_URL) l.push(`<link rel="canonical" href="${esc(canon)}">`);
  l.push('<meta property="og:type" content="website">');
  l.push(`<meta property="og:site_name" content="${SITE_NAME}">`);
  l.push(`<meta property="og:title" content="${esc(p.title)}">`);
  l.push(`<meta property="og:description" content="${esc(p.description)}">`);
  if (SITE_URL) {
    l.push(`<meta property="og:url" content="${esc(canon)}">`);
    l.push(`<meta property="og:image" content="${esc(SITE_URL + 'og.png')}">`);
    l.push('<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">');
    l.push('<meta property="og:image:alt" content="Random: number, dice, coin, list, wheel and team tools">');
  }
  l.push(`<meta name="twitter:card" content="${SITE_URL ? 'summary_large_image' : 'summary'}">`);
  if (ADSENSE_CLIENT) l.push(`<meta name="google-adsense-account" content="${esc(ADSENSE_CLIENT)}">`);
  if (GSC_TOKEN) l.push(`<meta name="google-site-verification" content="${esc(GSC_TOKEN)}">`);
  if (p.tool) l.push(`<script type="application/ld+json">${jsonLd(p)}</script>`);
  return l.join('\n');
}

const TIP_HTML = TIP_URL ? ` · <a href="${esc(TIP_URL)}" target="_blank" rel="noopener">${esc(TIP_LABEL)}</a>` : '';

// Static help dialog: the page's SEO copy plus crawlable links to the other tools.
function help(p, base) {
  const out = ['<dialog id="help" class="sheet help-sheet" aria-labelledby="help-h1">', '<div class="sheet-body">',
    '<div class="sheet-handle" aria-hidden="true"></div>', '<article class="help-doc">', `<h1 id="help-h1" tabindex="-1">${esc(p.h1)}</h1>`];
  p.intro.forEach((t) => out.push(`<p>${esc(t)}</p>`));
  out.push('<h2>Questions</h2>');
  p.faq.forEach(([q, a]) => out.push(`<h3>${esc(q)}</h3>`, `<p>${esc(a)}</p>`));
  out.push('<nav class="help-links" aria-label="Other tools">', `<h2>${p.slug ? 'Other tools' : 'All tools'}</h2>`, '<ul>');
  for (const [id] of GROUPS) {
    PAGES.filter((x) => x.tool && x.slug && x.group === id && x !== p)
      .forEach((x) => out.push(`<li><a href="${pageHref(base, x)}">${esc(x.nav)}</a></li>`));
  }
  if (p.slug) out.push(`<li><a href="${base}">All tools</a></li>`);
  out.push('</ul>', '</nav>', `<p class="help-foot"><a href="${base}privacy/">Privacy</a>${TIP_HTML}</p>`, '</article>',
    '<form method="dialog" class="sheet-actions"><button class="btn filled">Done</button></form>', '</div>', '</dialog>');
  return out.join('\n');
}

const BACK_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7"/></svg>';

// Privacy (p.tool === false): a static full-height page; only .doc may scroll.
function docPage(p) {
  const paras = p.intro.map((t) => `<p>${esc(t)}</p>`);
  if (ADSENSE_CLIENT) paras.push(`<p>${linkify(ADS_PRIVACY)}</p>`);
  return `<main class="doc-page">
<header class="topbar"><a class="icon-btn topbar-back" href="../" aria-label="Home"><span class="icon">${BACK_ICON}</span></a><h1>${esc(p.h1)}</h1></header>
<div class="doc scroll-region">
${paras.join('\n')}
</div>
</main>`;
}

const AD_SLOT = ADS_ON
  ? `<aside id="ad-slot" class="ad-dock" aria-label="Advertisement">
  <ins class="adsbygoogle" style="display:inline-block;width:320px;height:50px"
       data-ad-client="${esc(ADSENSE_CLIENT)}" data-ad-slot="${esc(cfg.ADSENSE_SLOT)}"></ins>
</aside>`
  : '';

function render(p) {
  const base = p.slug ? '../' : '';
  const vals = {
    BASE: base,
    ENTRY: esc(p.entry),
    PRESET_ATTR: p.preset ? ` data-preset="${esc(JSON.stringify(p.preset))}"` : '',
    TITLE: esc(p.title),
    DESCRIPTION: esc(p.description),
    SEO_META: seoMeta(p),
    APP_HEAD: p.tool
      ? jsModules.map((m) => `<link rel="modulepreload" href="${base}${m.slice(2)}">`).join('\n') + `\n<script type="module" src="${base}js/app.js"></script>`
      : '',
    APP_MAIN: p.tool ? '<main id="app"><noscript><p class="noscript">Turn on JavaScript to use this tool.</p></noscript></main>' : docPage(p),
    AD_SLOT: p.tool ? AD_SLOT : '',
    HELP: p.tool ? help(p, base) : '',
  };
  // Function replacer: values may contain "$" sequences.
  const html = template.replace(/\{\{([A-Z_]+)\}\}/g, (m, k) => (k in vals ? vals[k] : m));
  const left = html.match(/\{\{[A-Z_]+\}\}/);
  if (left) { console.error(`error: unresolved placeholder ${left[0]} in ${p.slug || 'home'}`); process.exit(1); }
  return html.replace(/\r\n/g, '\n');
}

/* ---------- 3. write pages ---------- */
const written = [];
function write(rel, content) {
  const file = at(rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
  written.push(rel);
}
for (const p of PAGES) write(p.slug ? `${p.slug}/index.html` : 'index.html', render(p));

/* ---------- 4. root files ---------- */
const deleted = [];
function remove(rel) { if (existsSync(at(rel))) { rmSync(at(rel)); deleted.push(rel); } }

if (SITE_URL) {
  const urls = PAGES.map((p) => `  <url><loc>${esc(canonicalOf(p))}</loc></url>`).join('\n');
  write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`);
} else remove('sitemap.xml');

const sitePath = SITE_URL ? new URL(SITE_URL).pathname : '/';
write('robots.txt', ['User-agent: *', 'Allow: /', `Disallow: ${sitePath}tools/`, `Disallow: ${sitePath}tests/`, `Disallow: ${sitePath}docs/`,
  ...(SITE_URL ? [`Sitemap: ${SITE_URL}sitemap.xml`] : [])].join('\n') + '\n');

if (ADSENSE_CLIENT) write('ads.txt', `google.com, pub-${ADSENSE_CLIENT.replace(/^ca-pub-/, '')}, DIRECT, f08c47fec0942fa0\n`);
else remove('ads.txt');

/* ---------- 5. sw.js ---------- */
const pageEntries = PAGES.filter((p) => p.slug).map((p) => `  './${p.slug}/',`).join('\n');
let sw = swSrc.replace(/(\/\/ BUILD:PAGES-START)[\s\S]*?(\n\s*\/\/ BUILD:PAGES-END)/, (m, a, b) => `${a}\n${pageEntries}${b}`);
if (!swSrc.includes('BUILD:PAGES-START') || !swSrc.includes('BUILD:PAGES-END')) { console.error('error: sw.js has no BUILD:PAGES markers'); process.exit(1); }

const precache = sw.match(/const PRECACHE = \[([\s\S]*?)\];/)[1];
const paths = [...precache.matchAll(/'(\.\/[^']*)'/g)].map((m) => m[1]);
const hash = createHash('sha256');
for (const p of paths) {
  let rel = p.slice(2);
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  if (!existsSync(at(rel))) { console.error(`error: PRECACHE file missing: ${p} (${rel})`); process.exit(1); }
  hash.update(p + '\0');
  hash.update(readFileSync(at(rel)));
}
const cacheName = 'random-' + hash.digest('hex').slice(0, 10);
sw = sw.replace(/const CACHE = '[^']*';/, `const CACHE = '${cacheName}';`);
writeFileSync(at('sw.js'), sw);

console.log(`pages written: ${PAGES.length}; root files: ${written.length - PAGES.length}; deleted: ${deleted.join(', ') || 'none'}; cache: ${cacheName}; warnings: ${warnings.length}`);
