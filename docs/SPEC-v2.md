# Random — v2 Specification (monetization + discoverability)

v2 is **additive** to `docs/SPEC.md` (v1). Everything in v1 still applies unless this document says otherwise. A reviewer may have changed v1 files after this spec was written, so apply every change below as a **delta on top of the current file contents**. Do not revert unrelated code.

v2 has three goals:
1. **Discoverability (the main work).** Add crawlable static landing pages, one per tool plus a few high-intent presets. Add real metadata, sitemap and robots.
2. **One small banner ad.** It must be unobtrusive and fully off when not configured.
3. **Tip jar.** A link to Ko-fi or Buy Me a Coffee.

Constraints that carry over from v1:
- No runtime dependencies and no build step on the host. The zero-dep Node scripts run locally, and their output is committed.
- All URLs are relative, so the site still works from a subdirectory.
- The whole app stays one codebase. Landing pages boot the same `js/app.js`.
- Distribution is web only. There is no app-store packaging.

---

## 1. File tree (new = ★, changed = ✎, generated and committed = ⚙)

```
★ js/config.js               THE config file the owner edits (site URL, AdSense ids, tip URL). No imports.
★ js/site.js                 Entry route + preset for landing pages, below-the-fold section toggling, FAB hide
★ js/ads.js                  Lazy AdSense loader, owner "no ads" flag helpers
★ tools/page-template.html   Single HTML template for every page (created from the current index.html)
★ tools/pages-data.mjs       Page data: slug, entry route, preset, title, description, copy, FAQ
★ tools/build-pages.mjs      Zero-dep generator: pages, sitemap, robots, ads.txt, sw.js precache + cache hash
★ tools/make-og.mjs          Zero-dep generator: og.png (1200×630)
★ tests/site.test.mjs        node:assert tests for parsePreset() and build idempotence
★ .nojekyll                  Empty file (GitHub Pages: skip Jekyll)
⚙ index.html                 NOW GENERATED (home page). Do not hand-edit after v2.
⚙ random-number-generator/index.html
⚙ random-number-1-10/index.html
⚙ random-number-1-100/index.html
⚙ coin-flip/index.html
⚙ dice-roller/index.html
⚙ random-name-picker/index.html
⚙ draw-lots/index.html
⚙ yes-or-no/index.html
⚙ privacy/index.html         Static privacy page (no app)
⚙ sitemap.xml                Only when SITE_URL is set
⚙ robots.txt                 Always
⚙ ads.txt                    Only when ADSENSE_CLIENT is set (deleted otherwise)
⚙ og.png                     Open Graph share image, 1200×630 PNG
✎ sw.js                      Generated PRECACHE block + generated CACHE name; multi-page navigation handling
✎ manifest.webmanifest       shortcuts, description, categories
✎ js/app.js                  VERSION 2.0.0, preset + default route, SW registration URL, init site/ads
✎ js/router.js               startRouter default path; export currentPath()
✎ js/screens/settings.js     Support row, Privacy link, hidden owner "no ads" toggle
✎ js/ui.js                   Add `heart` icon
✎ css/app.css                New "v2" section at the end: below-fold section, ad slot, footer, FAB hide
```

**Workflow rule (documented at the top of `js/config.js` and in every generated HTML file):** after you edit `js/config.js`, `tools/pages-data.mjs`, `tools/page-template.html`, or any precached file, run `node tools/build-pages.mjs` and commit the output. This one command replaces v1's manual `CACHE` bump.

---

## 2. Configuration: `js/config.js` (single source of truth)

```js
// Site configuration. This is the ONLY file you edit to turn on the canonical URL, ads and the tip jar.
// Empty string = feature OFF (no script loaded, no empty box, no layout space).
// After editing, run:  node tools/build-pages.mjs   and commit the result.
export const CONFIG = {
  SITE_URL: '',                 // e.g. 'https://example.com/'  (https, include a trailing '/'; include the sub-path if any)
  ADSENSE_CLIENT: '',           // e.g. 'ca-pub-1234567890123456'  (AdSense → Account → Account information)
  ADSENSE_SLOT: '',             // e.g. '1234567890'  (id of a FIXED-SIZE 320×100 display ad unit)
  TIP_URL: '',                  // e.g. 'https://ko-fi.com/yourname' or 'https://buymeacoffee.com/yourname'
  TIP_LABEL: 'Buy me a coffee',
  GOOGLE_SITE_VERIFICATION: '', // optional: Search Console "HTML tag" content token
};

// ---- Derived values. Do not edit below this line. ----
const s = (v) => (typeof v === 'string' ? v.trim() : '');
const url = s(CONFIG.SITE_URL);
export const SITE_URL = /^https:\/\/[^/\s]+(\/[^\s]*)?$/.test(url) ? (url.endsWith('/') ? url : url + '/') : '';
export const ADSENSE_CLIENT = /^ca-pub-\d{10,20}$/.test(s(CONFIG.ADSENSE_CLIENT)) ? s(CONFIG.ADSENSE_CLIENT) : '';
export const ADSENSE_SLOT = /^\d{5,20}$/.test(s(CONFIG.ADSENSE_SLOT)) ? s(CONFIG.ADSENSE_SLOT) : '';
export const ADS_ON = !!(ADSENSE_CLIENT && ADSENSE_SLOT);
export const TIP_URL = /^https:\/\/\S+$/.test(s(CONFIG.TIP_URL)) ? s(CONFIG.TIP_URL) : '';
export const TIP_LABEL = s(CONFIG.TIP_LABEL) || 'Buy me a coffee';
export const GSC_TOKEN = /^[\w-]{10,100}$/.test(s(CONFIG.GOOGLE_SITE_VERIFICATION)) ? s(CONFIG.GOOGLE_SITE_VERIFICATION) : '';
```

Rules:
- `config.js` must have **no imports and no DOM access**. The build script loads it through a `data:` URL import, and the browser imports it as a normal module.
- An invalid value counts as empty. The build script prints a warning for every non-empty value that fails validation.
- Which values are **baked into static files** at build time: `SITE_URL` (canonical, og:url, og:image, sitemap, robots, JSON-LD), `ADSENSE_CLIENT` (the `google-adsense-account` meta tag and ads.txt), `ADS_ON` (the ad slot markup), `TIP_URL` (the static footer link) and `GSC_TOKEN`.
- Which values are **read at runtime**: `ADS_ON`, `ADSENSE_CLIENT` and `ADSENSE_SLOT` (by `ads.js`), and `TIP_URL` (by Settings).
- Both sides read the same file, so they stay consistent as long as the build is re-run.

---

## 3. Landing pages and routing

### 3.1 Concept
Each landing page is a real HTML file at `/<slug>/index.html`. It contains three things:
- The full app shell: the same head, `css/app.css` and `js/app.js`. Every URL is prefixed with `../`.
- Two attributes on `<html>` that tell the app which screen to open and which values to preset.
- A **static "below" section** with the unique text, FAQ, an "Other tools" nav, the ad slot and the footer. It sits after `<main id="app">`, which keeps its v1 `min-height: 100dvh`. So on first paint the tool fills the screen and the text is below the fold. There is no layout shift, and crawlers still get real text.

```html
<html lang="en" data-theme="dark" data-entry="/number" data-preset='{"number":{"from":1,"to":100}}'>
```

- `data-entry` is the route shown when the URL has **no hash**. Home is `/`. Its value is `/number`, `/coin`, `/dice`, `/lots` or `/list/<id>`.
- `data-preset` is optional JSON. It is applied **only when `location.hash` is `''` or `'#'`**, which is a fresh landing. Once the user navigates inside the page, the hash takes over and v1 routing is unchanged. On a landing page, `#/` is the in-page Home and every v1 hash route works.

### 3.2 Router change (`js/router.js`)
- Change the signature to `startRouter(mountEl, routeTable, defaultPath = '/')`. In `resolve()`, replace `|| '/'` with `|| defaultPath`.
- If `defaultPath` does not match any route, the existing unknown-route logic runs (`replace('#/')`).
- Add `export function currentPath()`. It returns the same normalized path `resolve()` uses, with `defaultPath` applied. `site.js` uses it.
- Back-button behavior is unchanged. On a landing page with depth 0, back goes to `#/`, the in-page Home.

### 3.3 `js/site.js`
Top-level code must not touch the DOM (so node tests can import it). Exports:

- `getEntry()`: returns `document.documentElement.dataset.entry` if it matches `/^\/[a-z0-9\/-]*$/`, otherwise `'/'`.
- `parsePreset(json)`: a **pure** function. It returns a validated preset object or `null`, and never throws. Accepted shapes:
  - `{ number: { from, to } }`. Both must be integers with `|x| ≤ 1e9`. If `from > to`, swap them.
  - `{ list: { id, name, items } }`:
    - `id` must match `/^preset-[a-z0-9-]{1,40}$/`.
    - `name` must be a non-empty string. Truncate it to 60 characters.
    - `items` must be an array of strings. Trim each item, drop empty ones, truncate each to 200 characters, and keep at most 500.
    - Anything else makes the preset invalid (`null`).
- `applyPreset()`:
  - If the hash is not empty, do nothing.
  - Read `data-preset`, run `parsePreset`, then call `update()`:
    - **number**: if `from`/`to` differ from the stored values, set them, set `drawn = []`, and set `noRepeat = false` when `to - from + 1 > 100000`. Other number settings (count, sort, dupes) are untouched.
    - **list**: if no list with that `id` exists, push `{ id, name, items, noRepeat: false, drawn: [], pickCount: 1 }`. **Never overwrite an existing preset list.** This keeps the user's edits. If the user deleted it, visiting the page again re-creates it, which is intended.
- `initBelow()` handles the static below-the-fold section `#below`. It returns early if `#below` or `#app` is missing, as on the privacy page.
  - **Hide on other routes.** `beforeMount(() => html.toggleAttribute('data-off-entry', currentPath() !== getEntry()))`. The router calls `beforeMount` hooks on the initial mount too. This hides the text, ad and footer on every route except the page's own entry route. So the ad never appears on Settings, the list editor, or any in-page Home of a landing page.
  - **Keep the FAB off the text.** Add an `IntersectionObserver` on `#below` with `rootMargin: '0px 0px -120px 0px'`. It toggles `html[data-below]` while `#below` is intersecting. CSS then fades the FAB out (`opacity: 0; visibility: hidden; pointer-events: none`). The fixed FAB never sits on top of the article or the ad. Scrolling back up restores it. Space/Enter still work.

### 3.4 `js/app.js` changes
- `VERSION = '2.0.0'`.
- Import `{ getEntry, applyPreset, initBelow }` from `./site.js` and `{ initAds }` from `./ads.js`.
- Call these in order, **before** `startRouter`: `applyPreset()`, `initBelow()`. Then call `startRouter(el, ROUTES, getEntry())`, then `initAds()`.
- **SW registration must work from subfolders.** Change the call to `navigator.serviceWorker.register(new URL('../sw.js', import.meta.url))`. That resolves to `/sw.js` from `js/app.js`, whatever the page's folder. The default scope is the root folder, so the SW controls every page.

### 3.5 Pages (data in `tools/pages-data.mjs`)

| slug | entry | preset | nav label |
|---|---|---|---|
| `''` (home, `index.html`) | `/` | none | (not listed; the "All tools" link goes here) |
| `random-number-generator` | `/number` | none | Random number generator |
| `random-number-1-10` | `/number` | `{number:{from:1,to:10}}` | Random number 1–10 |
| `random-number-1-100` | `/number` | `{number:{from:1,to:100}}` | Random number 1–100 |
| `coin-flip` | `/coin` | none | Coin flip |
| `dice-roller` | `/dice` | none | Dice roller |
| `random-name-picker` | `/list/preset-names` | `{list:{id:'preset-names',name:'Names',items:['Alice','Bob','Charlie','Dana','Eli','Farah']}}` | Random name picker |
| `draw-lots` | `/lots` | none | Draw lots |
| `yes-or-no` | `/list/preset-yes-no` | `{list:{id:'preset-yes-no',name:'Yes or No',items:['Yes','No']}}` | Yes or no |
| `privacy` | — (`tool: false`) | — | (footer link only) |

Decisions:
- The page is `/random-name-picker/` rather than `/random-list-picker/` because "name picker" is the higher-intent query. The copy covers "list picker" too.
- Yes/No maps onto a list preset, and the list is then editable.
- Visiting a list page adds that list to the user's Home. This is intended and harmless.
- The build asserts that each list preset's `entry` equals `/list/<preset.list.id>`.

Data shape:
```js
export const SITE_NAME = 'Random';
export const PAGES = [
  { slug: 'coin-flip', entry: '/coin', preset: null, tool: true, nav: 'Coin flip',
    blurb: 'Fair heads or tails with a 3D flip and a tally.',
    title: '…', description: '…', h1: '…', intro: ['para 1', 'para 2'], faq: [['Q?', 'A.'], …] },
  …
];
```
All copy is **plain text**. The build HTML-escapes it. Paragraphs and answers are rendered as `<p>`, FAQs as `<h3>` + `<p>` (fully visible, not collapsed).

### 3.6 Page copy (use as written; light edits OK)
Common facts must stay true to v1 behavior:
- crypto.getRandomValues with rejection sampling.
- Works offline after the first visit and is installable.
- Data stays in local storage on the device.
- Number range ±1e9, up to 100 numbers per draw, No repeat for ranges up to 100,000.
- Lists hold up to 500 items, with up to 20 picked per draw.
- Dice: 1–6 dice. Lots: 2–30 lots, 1…N−1 winners. History keeps the last 20 results.

**Home (`''`)**
- title: `Random: Number Generator, Coin Flip, Dice & Name Picker`
- description: `Free random tools in one fast app: pick a number, flip a coin, roll dice, pick names from a list or draw lots. Works offline, no sign-up.`
- h1: `Random: simple, fair random tools`
- intro:
  1. "Random is a small, fast app for everyday random choices: pick a number in any range, choose a name from a list, roll up to six dice, flip a coin or draw lots. It runs in your browser, works offline after the first visit and can be installed to your home screen like an app."
  2. "Every result comes from your device's cryptographically secure random number generator, with rejection sampling so that no outcome is more likely than another."
- Also: a `<ul class="tool-links">` of every tool page (link + blurb), placed after the intro.
- FAQ:
  - "Is it really random?" → "It uses crypto.getRandomValues, the same secure generator browsers use for encryption keys. Rejection sampling removes the small bias that simpler methods have, so every allowed result is equally likely."
  - "Does it work offline?" → "Yes. After your first visit the whole app is stored on your device. To install it, use your browser's Install app or Add to Home Screen option."
  - "Where is my data stored?" → "Your lists, settings and history are saved only in your browser's local storage on this device. Nothing you enter is uploaded."

**random-number-generator**
- title: `Random Number Generator: Pick a Number in Any Range`
- description: `Pick random numbers in any range. Draw up to 100 at once, sort them, or use No repeat so each number comes up once. Free and works offline.`
- h1: `Random number generator`
- intro:
  1. "Set From and To, then tap the generate button or press Space. Any whole numbers from -1,000,000,000 to 1,000,000,000 work, and if From is larger than To they are swapped for you."
  2. "Open Parameters to draw up to 100 numbers at once, sort the results or allow duplicates. Turn on No repeat to draw every number in the range exactly once, like pulling numbered tickets from a hat. The counter shows how many are left, and the pool starts over when it runs out."
- FAQ:
  - "Can I generate numbers without repeats?" → "Yes. Turn on No repeat. It works for ranges of up to 100,000 numbers, and you can reset the pool at any time from the menu next to the counter."
  - "Is every number equally likely?" → "Yes. Results come from your device's secure random generator with rejection sampling, so no number is favored."
  - "Can I see earlier results?" → "Tap the clock icon to see your last 20 results. Tap one to copy it."

**random-number-1-10**
- title: `Random Number Generator 1-10: Pick a Number from 1 to 10`
- description: `Pick a random number from 1 to 10 with one tap. Use No repeat to go through all ten once. Free, fast and works offline.`
- h1: `Random number from 1 to 10`
- intro:
  1. "This page opens the number generator set to 1–10. Tap generate for a number. Each value from 1 to 10 has exactly a 10% chance."
  2. "Use it for pick-a-number games, deciding who goes first or quick ratings. You can change From and To at any time for a different range."
- FAQ:
  - "How do I pick 1 to 10 without repeats?" → "Turn on No repeat. You get each of the ten numbers once, in random order, and the counter shows how many have been drawn."
  - "Can I pick several numbers at once?" → "Yes. Open Parameters and set How many numbers. With duplicates off, they are all different."

**random-number-1-100**
- title: `Random Number Generator 1-100: Pick a Number from 1 to 100`
- description: `Get a random number from 1 to 100 instantly. Draw several at once, or use No repeat for raffles and bingo without duplicates. Works offline.`
- h1: `Random number from 1 to 100`
- intro:
  1. "This page opens the number generator set to 1–100. Each number has exactly a 1% chance."
  2. "It is handy for raffles with numbered tickets, classroom games, bingo-style calling and percentage rolls. With No repeat on, each number comes up only once until all 100 have been drawn."
- FAQ:
  - "Can I use it for a raffle?" → "Yes. Set To to your number of tickets, turn on No repeat and draw. History keeps the last 20 draws."
  - "How do I draw 5 different numbers?" → "Open Parameters and set How many numbers to 5. Duplicates are off by default, and Sort results puts them in order."

**coin-flip**
- title: `Coin Flip: Flip a Coin Online (Heads or Tails)`
- description: `Flip a coin online: a fair 50/50 heads or tails toss with a 3D animation and a running tally. Free, fast and works offline.`
- h1: `Flip a coin`
- intro:
  1. "Tap the coin or the flip button to toss it. The coin spins and lands on heads or tails, and the tally counts every result until you reset it."
  2. "Each flip is an independent 50/50 draw from your device's secure random generator, so earlier flips never influence the next one."
- FAQ:
  - "Is this coin flip fair?" → "Yes. Heads and tails each have exactly a 50% chance on every flip."
  - "Why did I get heads five times in a row?" → "Streaks are normal in fair random sequences. Any given five flips have a 1 in 32 chance of all being heads."
  - "Does it work without internet?" → "Yes, after your first visit."

**dice-roller**
- title: `Dice Roller: Roll 1 to 6 Dice Online`
- description: `Roll 1 to 6 dice online and see the total instantly, with a rolling animation and your last 20 rolls. Free and works offline.`
- h1: `Dice roller`
- intro:
  1. "Choose how many dice to roll with the − and + buttons, from 1 to 6, then tap the dice or the roll button. With more than one die, the total is shown under the dice."
  2. "Use it for board games when the dice go missing, dice games or any quick d6 roll. Each die is rolled independently, and every face has an equal 1 in 6 chance."
- FAQ:
  - "Can I roll a d20 or other dice?" → "This roller uses six-sided dice. For a d20, use the random number generator with a range of 1 to 20."
  - "How do I see previous rolls?" → "Tap the clock icon to see your last 20 rolls with totals."

**random-name-picker**
- title: `Random Name Picker: Pick a Random Name from a List`
- description: `Paste a list of names and pick one at random. Pick several at once or use No repeat so nobody is chosen twice. Lists stay on your device.`
- h1: `Random name picker`
- intro:
  1. "This page opens a sample list of names. To use your own, open the ⋮ menu, choose Edit list and paste your names one per line (up to 500). Then tap the pick button."
  2. "Pick up to 20 names at once for teams or prize draws. Turn on No repeat to go through everyone exactly once, which suits turn order, presentations and classroom questions. You can save as many lists as you like, and you will find them on the home screen."
- FAQ:
  - "Can I pick several winners at once?" → "Yes. Open Parameters and set How many to pick, up to 20. All the picks in one draw are different entries."
  - "Can the same name be picked twice?" → "Not within one draw. Across draws, turn on No repeat."
  - "Are my lists saved?" → "Yes, in your browser on this device only. Nothing is uploaded."

**draw-lots**
- title: `Draw Lots Online: Cast Lots and Find the Winner`
- description: `Draw lots online like drawing straws: set the number of lots and winners, then reveal them one by one. Fair, simple, works offline.`
- h1: `Draw lots`
- intro:
  1. "In Parameters, set the number of lots (2 to 30) and how many of them are winners. Each person taps a face-down lot to reveal it: a star means a winner and a dash means a blank."
  2. "It works like drawing straws. The winners are placed at random before anyone chooses, so the order in which people pick does not change their chances. Tap the new round button to shuffle again."
- FAQ:
  - "Does it matter who picks first?" → "No. With K winners among N lots, every lot has the same K in N chance."
  - "Can there be more than one winner?" → "Yes, any number from 1 up to one less than the number of lots."

**yes-or-no**
- title: `Yes or No Generator: Random Yes/No Answer`
- description: `Can't decide? Get a random yes or no answer with one tap. A fair 50/50 decision maker that works offline. Free, no sign-up.`
- h1: `Yes or no?`
- intro:
  1. "Ask your question, then tap the button to get a yes or a no. Both answers are equally likely."
  2. "The answers come from a list you can edit: add Maybe or Ask again later through the ⋮ menu, or try the Random answer list on the home screen."
- FAQ:
  - "Is it really 50/50?" → "Yes. Each tap picks Yes or No with equal chance."
  - "Can I get the same answer twice in a row?" → "Yes. Every tap is independent. Turn on No repeat if you want the two answers to alternate in random pairs."

**privacy** (`tool: false`, no app, no ad slot)
- title: `Privacy: Random`
- description: `How Random handles your data: lists and settings stay on your device. Explains ads and cookies when ads are shown.`
- h1: `Privacy`
- Always-present paragraphs:
  - "Random has no accounts and no analytics."
  - "Your lists, settings and history are stored only in your browser's local storage on this device, and you can erase them with Settings → Clear all data."
  - "The app files are cached on your device so that it works offline."
- **Only when `ADSENSE_CLIENT` is set**, the build appends:
  - "This site shows ads from Google AdSense. Google and its partners may use cookies or similar technologies to show ads and measure them, based on your visits to this and other websites. Visitors in the EEA, the UK and Switzerland are asked for consent through Google's consent message. You can manage ad personalization at https://adssettings.google.com. To learn more, see https://policies.google.com/technologies/partner-sites."
  - Render both URLs as links.

---

## 4. Template and build (`tools/page-template.html`, `tools/build-pages.mjs`)

### 4.1 Template
Create the template by copying the **current** `index.html`, including any reviewer fixes. Then turn it into this skeleton. From v2 on, `index.html` is output only.

```html
<!doctype html>
<!-- Generated by tools/build-pages.mjs from tools/page-template.html. Do not edit. -->
<html lang="en" data-theme="dark" data-entry="{{ENTRY}}"{{PRESET_ATTR}}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{{TITLE}}</title>
<meta name="description" content="{{DESCRIPTION}}">
{{SEO_META}}
<meta name="theme-color" content="#0F1416">
<link rel="manifest" href="{{BASE}}manifest.webmanifest">
<link rel="icon" href="{{BASE}}icons/icon.svg" type="image/svg+xml">
<link rel="icon" href="{{BASE}}icons/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="{{BASE}}icons/apple-touch-icon.png">
… (v1 mobile/apple meta tags unchanged) …
<script>
(v1 theme script, unchanged)
(v2 no-ads block, §5.4)
</script>
<link rel="stylesheet" href="{{BASE}}css/app.css">
{{APP_HEAD}}
</head>
<body>
{{APP_MAIN}}
<div id="below" class="below">
{{AD_SLOT}}
<article class="about">{{ARTICLE}}</article>
{{NAV}}
{{FOOTER}}
</div>
<div id="live" class="sr-only" aria-live="polite"></div>
</body>
</html>
```

Placeholders. The build fills each one with an already-escaped string, and **fails if any `{{…}}` is left** after substitution.

| Placeholder | Value |
|---|---|
| `BASE` | `''` for home, `'../'` for `/<slug>/` pages |
| `ENTRY` | page.entry (privacy: `/`) |
| `PRESET_ATTR` | ` data-preset="<escaped JSON>"` or `''` |
| `TITLE`, `DESCRIPTION` | escaped text |
| `SEO_META` | see §4.2 |
| `APP_HEAD` | tool pages: `<link rel="modulepreload" href="{{BASE}}js/…">` for every `./js/**/*.js` in PRECACHE except app.js, then `<script type="module" src="{{BASE}}js/app.js"></script>`. Privacy: `''` |
| `APP_MAIN` | tool pages: `<main id="app"><noscript><p class="noscript">Turn on JavaScript to use this tool.</p></noscript></main>`. Privacy: `''` |
| `AD_SLOT` | see §5.2 (only when `ADS_ON` and a tool page; else `''`) |
| `ARTICLE` | `<h1>` + intro `<p>`s (+ home tool list) + `<h2>Questions</h2>` + FAQ `<h3>`/`<p>` pairs |
| `NAV` | tool pages: `<nav class="other-tools" aria-label="Other tools"><h2>More random tools</h2><ul>` links to every other tool page (not self, not privacy) plus `All tools` (home) when not on home `</ul></nav>`. Privacy: `''` |
| `FOOTER` | `<footer class="site-footer"><a href="{{BASE}}">Home</a> · <a href="{{BASE}}privacy/">Privacy</a>[ · <a href="TIP_URL" target="_blank" rel="noopener">TIP_LABEL</a>]</footer>` (the tip part only when `TIP_URL`) |

All links between pages are relative (`{{BASE}}coin-flip/`) and end in `/`.

### 4.2 `SEO_META`
Each line is emitted only when its value is available:
```html
<link rel="canonical" href="SITE_URL + slug + '/'">                  (home: SITE_URL)          [SITE_URL]
<meta property="og:type" content="website">
<meta property="og:site_name" content="Random">
<meta property="og:title" content="TITLE">
<meta property="og:description" content="DESCRIPTION">
<meta property="og:url" content="CANONICAL">                                                  [SITE_URL]
<meta property="og:image" content="SITE_URL + 'og.png'">                                      [SITE_URL]
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">  [SITE_URL]
<meta property="og:image:alt" content="Random: number, list, dice, coin and lots tools">       [SITE_URL]
<meta name="twitter:card" content="summary_large_image">   (content "summary" without SITE_URL)
<meta name="google-adsense-account" content="ADSENSE_CLIENT">                                 [ADSENSE_CLIENT]
<meta name="google-site-verification" content="GSC_TOKEN">                                    [GSC_TOKEN]
<script type="application/ld+json">JSONLD</script>                                            [tool pages]
```

**JSON-LD** is `{"@context":"https://schema.org","@graph":[…]}`, serialized with `JSON.stringify(obj).replace(/</g,'\\u003c')`. The graph contains:
- **WebApplication**, with these fields:
  - `name`: the page h1, or "Random" on home
  - `url`: the canonical URL, only if SITE_URL is set
  - `description`
  - `applicationCategory: "UtilitiesApplication"`
  - `operatingSystem: "Any"`
  - `browserRequirements: "Requires JavaScript"`
  - `isAccessibleForFree: true`
  - `offers: {"@type":"Offer","price":"0","priceCurrency":"USD"}`
  - `image`: SITE_URL + 'og.png', only if SITE_URL is set
- **FAQPage**, built from `faq`: `mainEntity: [{ "@type":"Question", name, acceptedAnswer: { "@type":"Answer", text } }]`.
- **Home only: WebSite**, with `name: "Random"` and `url`, only if SITE_URL is set.

Never invent `aggregateRating` or review data. Note that Google shows FAQ rich results only for a few authoritative sites now. The markup is still valid and harmless. The real value is the visible FAQ text.

### 4.3 Build steps (`node tools/build-pages.mjs`, run from anywhere; paths are resolved from the script's location)
1. **Load config.** `const mod = await import('data:text/javascript;base64,' + Buffer.from(readFileSync('js/config.js')).toString('base64'))`. Print warnings for invalid non-empty values, and print what is enabled (for example `SITE_URL: off`).
2. **Load** `tools/pages-data.mjs` and the template, then **validate**:
   - slugs are unique and match `/^[a-z0-9-]*$/`
   - titles are unique and ≤ 65 characters; this is a warning
   - descriptions are unique, 50–160 characters; this is an **error**
   - every tool page has an h1, at least 2 intro paragraphs and at least 2 FAQs
   - list-preset entries are consistent (§3.5)
   - every preset passes `parsePreset`, imported from `js/site.js`
3. **Render** every page to `index.html` (home) or `<slug>/index.html`. Create the folder if needed. Write LF line endings. Output must be **deterministic**, with no dates or random values.
4. **Write the root files:**
   - `sitemap.xml`: urlset with one `<loc>` per page (home, tools, privacy) and no `lastmod`. If SITE_URL is empty, delete any existing sitemap.xml.
   - `robots.txt`:
     ```
     User-agent: *
     Allow: /
     Disallow: <path>tools/
     Disallow: <path>tests/
     Disallow: <path>docs/
     Sitemap: <SITE_URL>sitemap.xml      (only when SITE_URL)
     ```
     `<path>` is SITE_URL's pathname, or `/` when SITE_URL is empty.
   - `ads.txt`: `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0` + `\n`, where the pub id is ADSENSE_CLIENT with the `ca-` prefix removed. Write it when ADSENSE_CLIENT is set, and delete it otherwise.
5. **Patch `sw.js`:**
   - Replace the lines between `// BUILD:PAGES-START` and `// BUILD:PAGES-END`, which sit inside the PRECACHE array. Put one `'./<slug>/',` per generated page there, including privacy but not home, since home is already `'./'` and `'./index.html'`.
   - Then parse every `'./…'` literal in PRECACHE. Map `'./'` to `index.html` and any trailing `/` to `…/index.html`. **Fail** if any file is missing.
   - Compute sha256 over each path + `\0` + file bytes, in array order. Replace the line matching `/const CACHE = '[^']*';/` with `const CACHE = 'random-<first 10 hex chars>';`.
6. Print a summary: pages written, files deleted, cache name.

**Idempotence:** running the script twice in a row changes nothing the second time.

### 4.4 OG image (`node tools/make-og.mjs` → `og.png`)
This script is zero-dep, like `make-icons.mjs`. Copy that script's glyph, PNG and CRC helpers into this file. **Do not refactor `make-icons.mjs`.**

Draw 1200×630 RGB(A) with 3×3 supersampling. The layout is in pixel coordinates.
- **Background:** `#0F1416`. Add a 1200×8 accent bar at the bottom in `#00ACC1`.
- **App icon:** the v1 `any` icon geometry scaled from 512 to 300px, drawn at (110, 165). That is the rounded rect `#00ACC1` with the white glyph.
- **Wordmark "RANDOM":** white `#E1E8EA`, drawn with a 5×7 bitmap font.
  - Each "on" cell is a square of 18px with corner radius 4px, on a 20px pitch.
  - Letters are 100px wide with 28px between them, starting at (470, 190).
  - Glyph rows, top to bottom, where `1` = on:
  ```
  R: 11110 10001 10001 11110 10100 10010 10001
  A: 01110 10001 10001 11111 10001 10001 10001
  N: 10001 11001 10101 10011 10001 10001 10001
  D: 11110 10001 10001 10001 10001 10001 11110
  O: 01110 10001 10001 10001 10001 10001 01110
  M: 10001 11011 10101 10101 10001 10001 10001
  ```
- **Motif row** at y = 380, each motif 110×110:
  - A die at x = 470: `#7B1FA2`, radius 24, five white pips of radius 10 in the face-5 layout.
  - A coin at x = 610: a circle in `#FFB300`.
  - A result tile at x = 750: `#1976D2`, radius 26.
  - A result tile at x = 890: `#E64A19`, radius 26.

The image has no other text. The page title and description supply the words in share cards. Commit `og.png`. It is **not** precached.

---

## 5. Banner ad

### 5.1 Placement decision
There is exactly **one** slot, `#ad-slot`. It is the first child of `#below`, directly under the tool and outside `<main id="app">`.

Why this spot:
- It is static markup, so SPA route changes never re-render or re-request it. That means one `adsbygoogle.push` per page load, which is what AdSense expects.
- It is below the fold (the tool keeps `min-height: 100dvh`), so it is unobtrusive and cannot cause visible layout shift.
- It is never inside or over the result overlay or the generate flow. The overlay is fixed at z-index 50, above page content.
- It is never on Settings or the list editor. Those are off-entry routes, and `#below` is hidden there (§3.3).
- It is never on the privacy page.
- The FAB (z-index 60) stays above any ad, and it is faded out while `#below` is on screen, so the two never overlap.

Pages with a slot: home (under the home cards) and every tool landing page.

### 5.2 Markup (emitted by the build only when `ADS_ON`)
```html
<aside id="ad-slot" class="ad-slot" aria-label="Advertisement">
  <span class="ad-label">Advertisement</span>
  <ins class="adsbygoogle" style="display:inline-block;width:320px;height:100px"
       data-ad-client="ADSENSE_CLIENT" data-ad-slot="ADSENSE_SLOT"></ins>
</aside>
```
The unit is **fixed-size 320×100**, not responsive, so there is zero shift. Create it in AdSense as a Display ad with Fixed size 320×100.

### 5.3 CSS
```css
.ad-slot { display:flex; flex-direction:column; align-items:center; gap:4px; min-height:124px; padding:12px 16px 0; }
.ad-label { font-size:11px; color:var(--muted); letter-spacing:.04em; }
html[data-noads] .ad-slot,
.ad-slot:has(ins[data-ad-status="unfilled"]) { display:none; }
```
When ads are enabled, the height is reserved from first paint. When `data-noads` is set before paint, the slot takes no space at all.

### 5.4 Deciding before paint (inline head script, appended to the v1 theme script)
```js
try {
  var q = new URLSearchParams(location.search).get('noads');
  if (q === '1') localStorage.setItem('random:noads', '1');
  if (q === '0') localStorage.removeItem('random:noads');
  if (q !== null) history.replaceState(null, '', location.pathname + location.hash);
  if (localStorage.getItem('random:noads') === '1') document.documentElement.setAttribute('data-noads', '');
} catch (e) {}
if (!navigator.onLine || /^(localhost|127\.|\[::1\]$)/.test(location.hostname)) document.documentElement.setAttribute('data-noads', '');
```
Notes:
- Ads are always off on localhost, so the owner never generates invalid dev impressions.
- The flag uses its own key, `random:noads`. It is not in `random:state`, so "Clear all data" keeps it.

### 5.5 `js/ads.js`
- `isNoAds()` returns true when `localStorage['random:noads'] === '1'`, in try/catch.
- `setNoAds(on)` sets or removes the key and toggles `html[data-noads]`.
- `initAds()`:
  1. Return if `!ADS_ON`, if there is no `#ad-slot`, or if `html` has `data-noads`.
  2. `new IntersectionObserver(cb, { rootMargin: '300px' })` observes the slot. On the first intersection, disconnect, then:
     - If `!navigator.onLine`, set `data-noads` and return.
     - Otherwise append `<script async crossorigin="anonymous" src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<ADSENSE_CLIENT>">`.
     - Call `(window.adsbygoogle = window.adsbygoogle || []).push({})`.
     - If the script's `onerror` fires (ad blocker or network), set `data-noads` to collapse the box.
  3. A `display:none` slot (off-entry route) never intersects, so the ad is only requested when the slot is actually showing. Load is lazy: it happens after scrolling near the slot, never during boot.
- Never import or reference AdSense anywhere else. It is **not** in PRECACHE.

### 5.6 Service worker and ads
v1's fetch handler already returns early for cross-origin requests, so AdSense, the consent message and ad iframes go straight to the network. **Keep that early `return` before any `respondWith`.** The SW never caches or intercepts third-party requests.

### 5.7 Owner opt-out (no public "Show ads" toggle)
There is no Settings toggle, because it would let every visitor turn ads off and zero the revenue. The owner is the main user, so there is a hidden per-device switch instead:
- **Browser:** open the site once with `?noads=1`. `?noads=0` undoes it.
- **Installed PWA** (iOS home-screen apps have separate storage, so the URL trick does not reach them): in Settings, tap the version line 5 times within 3 seconds. This toggles `setNoAds` and shows the toast "Ads off on this device" or "Ads on on this device (after reload)". This only works when `ADS_ON`.

This also keeps the owner from generating their own impressions and clicks, which AdSense treats as invalid activity.

### 5.8 EU consent
- Use **Google's certified CMP**: AdSense → Privacy & messaging → European regulations (GDPR) message → Create and publish.
- The AdSense script shows that message automatically to EEA/UK/CH visitors. **No custom cookie banner and no code are needed.** A US state regulations message can also be enabled there with no code.
- The privacy page (§3.6) describes this.
- **Turn Auto ads OFF** for the site in AdSense. Otherwise Google injects extra ads anywhere, including over the tool, which breaks the placement rules above.
- **`ads.txt` must be served at the domain root.** The build writes it. See §8 about subdomains.

---

## 6. Tip jar
- **Settings** (`js/screens/settings.js`): when `TIP_URL` is set, add a card between the toggles card and "Clear all data". It holds one row that is an `<a class="row link-row" href=TIP_URL target="_blank" rel="noopener">`:
  - Left: the new `heart` icon, in primary color.
  - Middle: `row-text`, with `row-label` = TIP_LABEL and `row-hint` = "Support this free tool".
  - Reuse the switch-row structure and class names, with a min-height of 56px.
- **Footer:** the static tip link in every page footer (§4.1). It is the "subtle link" under Home and the tools.
- When `TIP_URL` is empty, neither link exists: no row, no separator, no text.
- Also in Settings: under the version line, add a small muted link "Privacy" with `href = new URL('../../privacy/', import.meta.url).href`.
- **`js/ui.js`:** add the `heart` icon, stroke style like the other icons:
  `<path d="M12 20.5s-7-4.3-9.2-8.3C1.2 9.1 3 5.5 6.6 5.5c2.1 0 3.6 1.1 5.4 3 1.8-1.9 3.3-3 5.4-3 3.6 0 5.4 3.6 3.8 6.7C19 16.2 12 20.5 12 20.5z"/>`

---

## 7. PWA, service worker, performance

### 7.1 `sw.js`
- **PRECACHE additions:** `'./js/config.js'`, `'./js/site.js'`, `'./js/ads.js'`, plus the generated `// BUILD:PAGES-START … // BUILD:PAGES-END` block.
- Never precache: `og.png`, `sitemap.xml`, `robots.txt`, `ads.txt`, `tools/`, `tests/`, `docs/`, or anything cross-origin.
- `CACHE` is now written by the build as a content hash (§4.3). Do not edit it by hand.
- **Navigation handling** changes because there are now multiple entry pages:
  ```js
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match(req, { ignoreSearch: true })              // '/coin-flip/' → its own precached page
        .then((r) => r || fetch(req))
        .catch(() => caches.match('./index.html')));         // offline + unknown page → home
    return;
  }
  ```
  - `ignoreSearch` lets `?noads=1` and utm-style URLs match.
  - Everything else stays as in v1: cache-first for same-origin assets, and cross-origin passthrough.

### 7.2 `manifest.webmanifest`
- Change `description` to "Random number generator, name picker, dice roller, coin flip and draw lots. Works offline."
- Add `"categories": ["utilities", "productivity"]`.
- Add shortcuts. The URLs are hash routes on the root app, so shortcuts land in the normal app, not a landing page:
  ```json
  "shortcuts": [
    { "name": "Number", "url": "./#/number", "icons": [{ "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" }] },
    { "name": "Coin",   "url": "./#/coin",   "icons": [ …same… ] },
    { "name": "Dice",   "url": "./#/dice",   "icons": [ …same… ] },
    { "name": "Cast lots", "url": "./#/lots", "icons": [ …same… ] }
  ]
  ```
- Leave `id`, `start_url` and `scope` unchanged. They are relative to the manifest at the root, so installing from any landing page installs the same root app.

### 7.3 Core Web Vitals
- **CLS 0.**
  - The tool fills the first viewport (`#app` min-height 100dvh). The below section starts after it.
  - The ad box has a fixed size and is decided before paint.
  - An unfilled ad or an ad-block collapse happens below the fold.
  - There are no web fonts (the system font stack is kept) and no images above the fold.
- **Fast first load.** `modulepreload` for every module flattens the import waterfall. There are no third-party requests until the user scrolls near the ad.
- **Repeat loads** are served from the SW cache.

### 7.4 CSS additions (`css/app.css`, new section `/* ===== v2: pages, ads, footer ===== */`)
- `.below`: `max-width: 560px; margin: 0 auto; padding: 8px 16px calc(env(safe-area-inset-bottom) + 32px); border-top: 1px solid var(--divider)`.
- `html[data-off-entry] .below { display: none; }`
- Article typography:
  - `.about h1` 26px/600
  - `.about h2` 19px/600, margin-top 28px
  - `.about h3` 16px/600, margin-top 16px
  - `.about p, .tool-links li` line-height 1.6
  - Links use `color: var(--primary)`.
- `.tool-links`, `.other-tools ul`: no bullets. Each link has a min-height of 44px, and the links are separated by dividers.
- `.site-footer`: centered, 14px, `color: var(--muted)`, padding 24px 0, links ≥ 44px tall (inline-block with padding).
- `.fab { transition: transform .12s, filter .12s, opacity .2s; }` and `html[data-below] .fab { opacity: 0; visibility: hidden; pointer-events: none; }`.
- `.noscript`: padding 24px, centered.
- `.link-row`: color inherit, no underline, whole row clickable.
- There must be no horizontal scroll at 320px, including the 320px ad (the slot's side padding is dropped under 352px: `@media (max-width: 351px) { .ad-slot { padding-inline: 0; } }`).

---

## 8. Hosting and launch

### 8.1 Recommendation
**Cloudflare Pages + your own domain** (about $10/year, bought at cost through Cloudflare Registrar):
- Hosting is free, with a global CDN and automatic HTTPS.
- Pages default to `Cache-Control: max-age=0, must-revalidate`, which suits the SW. No `_headers` file is needed.
- A domain you own is **required for AdSense in practice**. Google approves sites by root domain and needs `ads.txt` at that root. You cannot do that on `*.github.io` or `*.pages.dev`.

**GitHub Pages** (`user.github.io/random/`) is fine **if you skip ads**. Everything is relative, so it works under a sub-path. Two caveats: `robots.txt` and `ads.txt` under a sub-path are ignored by crawlers, and you submit the sitemap in Search Console by hand.

Cloudflare Pages setup:
- Connect the Git repo.
- Framework preset: **None**. Build command: **empty**. Build output directory: **`/`**.
- Then open **Custom domains** and add the domain.

GitHub Pages setup: Settings → Pages → Deploy from branch `main`, folder `/ (root)`. Optionally add a custom domain there. `.nojekyll` is included.

### 8.2 Post-deploy checklist
1. Set `SITE_URL` in `js/config.js`. Run `node tools/build-pages.mjs`, then commit and push.
2. Open `/`, `/coin-flip/` and `/random-number-1-100/`. Confirm each tool works, the SW installs, and the pages work offline after one visit. Run a mobile Lighthouse check: SEO 100, CLS 0.
3. On your own devices, visit `<site>/?noads=1` once. In the installed app, tap the version line 5 times.
4. **Google Search Console:**
   - Add a **Domain** property (DNS TXT record, one click with Cloudflare DNS). Or use a URL-prefix property with the HTML tag: set `GOOGLE_SITE_VERIFICATION` and rebuild.
   - Submit `sitemap.xml`.
   - Use URL Inspection → Request indexing for the home page and each tool page.
5. **Bing Webmaster Tools:** import the site from Search Console. This covers Bing, DuckDuckGo and Yahoo.
6. **AdSense:**
   - Sign up and add the root domain.
   - Set `ADSENSE_CLIENT` (the slot can stay empty for now). Rebuild and deploy: this adds the verification meta tag and `ads.txt`.
   - Click **Request review**. Approval usually takes days to weeks.
   - **Thin-content risk:** a single hash-routed app looks to reviewers like one nearly empty page and is often rejected as "low value content". The 8 landing pages with unique explanatory text and FAQs, internal links and a privacy page exist largely to pass this. If you are rejected, add more genuinely useful pages (for example a d20 or lottery-number preset) and re-apply.
   - After approval:
     - Create a **fixed 320×100** display unit and set `ADSENSE_SLOT`, then rebuild and deploy.
     - Turn **Auto ads OFF**.
     - Publish the **GDPR message** in Privacy & messaging.
     - Check that Sites shows `ads.txt` as "Authorized". This can take a day.
     - Never click your own ads.
7. **Tip jar:** create a Ko-fi or Buy Me a Coffee page, set `TIP_URL`, then rebuild and deploy.
8. **Links:** put the site link in the repo README and your profiles. Share it where it is genuinely useful. A few real backlinks matter more than anything else here.

**Expectations:** head terms such as "random number generator" and "flip a coin" are dominated by Google's own built-in widgets and long-established sites. Realistic wins are long-tail queries such as "random number 1-100 no repeat" and "draw lots online", plus people finding the site through shares. That fits "mainly for my own use".

---

## 9. Deliberately left out
- Analytics. Search Console gives query data with no tracking script.
- A custom cookie banner (Google's CMP covers it).
- A public "hide ads" setting.
- More than one ad slot, sticky/anchor ads and Auto ads.
- Responsive ad units (they cause layout shift).
- Ads inside the SPA's routes.
- i18n and localized pages.
- A blog or articles.
- Pre-rendering the tool UI into HTML (Google renders JS, and the static text covers crawlers that don't).
- `lastmod` in the sitemap.
- Fake ratings in JSON-LD.
- More presets (d20, lottery). These are the easy next step, since each is one data entry plus a rebuild.
- App stores and TWA.
- An SW update prompt (unchanged from v1).

---

## 10. Tests
`tests/site.test.mjs`, run with `node tests/site.test.mjs`:
- **`parsePreset`:**
  - It accepts both documented shapes and swaps `from > to`.
  - It returns `null` for malformed JSON, unknown keys only, non-integer or out-of-range bounds, bad list ids (`default-answer`, `preset-<script>`), and non-array items.
  - It trims, drops empty items and caps items at 500 × 200 characters.
- **Build idempotence:** run `tools/build-pages.mjs` twice through `child_process.execFileSync(process.execPath, …)`. Hash every generated file plus `sw.js` after each run, and assert the hashes are equal.
- **Generated output:**
  - With the committed (empty) config, no HTML file contains `googlesyndication` or `adsbygoogle`.
  - `ads.txt` does not exist.
  - Every tool page contains exactly one `rel="canonical"`, or zero when SITE_URL is empty.
  - Every JSON-LD block `JSON.parse`s.

`node tests/rng.test.mjs` must still pass.

---

## 11. Acceptance criteria

**Config & build**
- [ ] `js/config.js` is the only place ids and URLs are entered. It is documented at its top, and every value is empty by default.
- [ ] `node tools/build-pages.mjs` with the default config writes 10 HTML files (home + 8 tools + privacy) and `robots.txt`. It writes no `sitemap.xml` and no `ads.txt`, prints warnings or info for the disabled features, and a second run produces no changes.
- [ ] With a test config (`SITE_URL='https://example.com/'`, `ADSENSE_CLIENT='ca-pub-1234567890123456'`, `ADSENSE_SLOT='1234567890'`, `TIP_URL='https://ko-fi.com/test'`), the build produces:
  - canonical and og URLs on every page
  - a sitemap with 10 absolute URLs
  - robots.txt with a Sitemap line
  - `ads.txt` = `google.com, pub-1234567890123456, DIRECT, f08c47fec0942fa0`
  - the adsense meta tag
  - the ad slot on home and tool pages only (not on privacy)
  - a tip link in every footer
  - the privacy ads paragraph

  Restore the empty config and rebuild before committing, **unless the owner has supplied real values**.
- [ ] Invalid config values (for example `ADSENSE_CLIENT='pub-1'`) are treated as off, with a warning.
- [ ] `sw.js` CACHE changes when any precached file changes and stays the same otherwise. Every PRECACHE path exists.
- [ ] `node tools/make-og.mjs` writes `og.png`, and `file og.png` reports `1200 x 630`.

**Pages & routing**
- [ ] Each tool landing page opens its tool with no hash in the URL:
  - `/random-number-1-100/` shows From 1 / To 100.
  - `/yes-or-no/` shows a "Yes or No" list with Yes and No.
  - `/random-name-picker/` shows the sample "Names" list.
- [ ] Editing the preset list, then revisiting its page, keeps the edits. Changing From on `/random-number-1-10/` and reloading resets it to 1–10, which is expected.
- [ ] On a landing page, every v1 hash route works (`#/`, `#/settings`, `#/list/new`…). The below section (text, ad, footer) shows only on the page's entry route. Back from the tool goes to the in-page Home.
- [ ] The root `index.html` behaves exactly like v1 for all hash routes and shows the below section only on `#/`.
- [ ] Every page has a unique title and description (≤ 160 characters), an h1 in the article, 2+ intro paragraphs, 2+ FAQs, an "Other tools" nav linking to all other tool pages, and a footer with Home and Privacy.
- [ ] View-source of each tool page shows the text content without JS. Google Rich Results Test parses the WebApplication and FAQPage without errors.
- [ ] Manifest shortcuts open Number, Coin, Dice and Cast lots.

**Ads**
- [ ] With ads off (empty config, `?noads=1`, offline, or localhost), there is no request to `googlesyndication.com`, no `.ad-slot` space, and no "Advertisement" text.
- [ ] With ads on in production, the AdSense script loads only after scrolling near the slot, never at boot. The DevTools Network panel shows ad requests **not** served by the ServiceWorker, and no AdSense URL appears in any Cache Storage entry.
- [ ] The ad never appears on Settings, the list editor or privacy, never overlaps the result overlay, and the FAB is hidden whenever the below section is on screen.
- [ ] `?noads=1` sets `random:noads` and removes the query from the URL. `?noads=0` clears it. Tapping the Settings version 5 times toggles it, with a toast. "Clear all data" does not reset it.
- [ ] Lighthouse mobile on `/coin-flip/`: CLS = 0 with ads both on and off. SEO = 100. Best Practices has no console errors from app code.

**Tip jar**
- [ ] With TIP_URL set, Settings shows the "Buy me a coffee" row and the footer shows the link. Both open in a new tab with `rel="noopener"`. With TIP_URL empty, neither exists.

**PWA / regression**
- [ ] After visiting `/`, the offline reload works on `/` and on every landing page, including with `?noads=1` appended.
- [ ] An offline navigation to an unknown path shows home.
- [ ] One SW registration (scope `/`) controls every page, whether it was first registered from a landing page or from home.
- [ ] Every v1 acceptance criterion still passes. `node --check` passes on every JS/MJS file. There is no `Math.random` in `js/`. All tests pass.
