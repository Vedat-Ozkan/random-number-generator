// CACHE and the PAGES block are written by `node tools/build-pages.mjs`. Do not edit by hand.
const CACHE = 'random-44cbd2f7e0';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/router.js',
  './js/store.js',
  './js/rng.js',
  './js/feedback.js',
  './js/ui.js',
  './js/screens/home.js',
  './js/screens/number.js',
  './js/screens/list.js',
  './js/screens/list-edit.js',
  './js/screens/dice.js',
  './js/screens/coin.js',
  './js/screens/lots.js',
  './js/screens/settings.js',
  './js/screens/history.js',
  './js/config.js',
  './js/site.js',
  './js/ads.js',
  './js/tools.js',
  './js/parse.js',
  './js/search.js',
  './js/presets.js',
  './js/screens/source.js',
  './js/screens/teams.js',
  './js/screens/shuffle.js',
  './js/screens/wheel.js',
  './js/screens/lottery.js',
  './js/screens/cards.js',
  // BUILD:PAGES-START
  './random-number-generator/',
  './random-number-1-6/',
  './random-number-1-10/',
  './random-number-1-50/',
  './random-number-1-100/',
  './random-number-1-1000/',
  './lottery-number-generator/',
  './dice-roller/',
  './d4-dice-roller/',
  './d6-dice-roller/',
  './d8-dice-roller/',
  './d10-dice-roller/',
  './d12-dice-roller/',
  './d20-dice-roller/',
  './coin-flip/',
  './draw-a-card/',
  './random-name-picker/',
  './team-generator/',
  './shuffle-list/',
  './spin-the-wheel/',
  './draw-lots/',
  './yes-or-no/',
  './magic-8-ball/',
  './rock-paper-scissors/',
  './random-letter-generator/',
  './random-month-generator/',
  './random-day-of-the-week/',
  './privacy/',
  // BUILD:PAGES-END
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(navigate(req));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});

// Navigations: exact page from cache; canonicalize '/x' and '/x/index.html' to '/x/' by redirect
// (so relative assets resolve); network; offline + unknown page -> redirect to the app root.
async function navigate(req) {
  const u = new URL(req.url);
  const exact = await caches.match(req, { ignoreSearch: true });
  if (exact) return exact;
  const alt = u.pathname.endsWith('index.html')
    ? u.pathname.slice(0, -'index.html'.length)
    : u.pathname.endsWith('/') ? null : u.pathname + '/';
  if (alt && (await caches.match(new URL(alt, u.origin).href))) {
    return Response.redirect(alt + u.search + u.hash, 302);
  }
  try {
    return await fetch(req);
  } catch {
    return Response.redirect(new URL('./', self.registration.scope).href, 302);
  }
}
