# Random — v4 Specification (essential motion, help "?", no-scroll screens)

v4 is a focused revision on top of the current v3 working tree. Everything in SPEC.md, SPEC-v2.md and SPEC-v3.md still applies unless this document changes it. `VERSION` becomes `'4.0.0'`.

The user's feedback after trying v3:

> "spin the wheel no animation? fix that. also i see all tools and more random tools on same screen? weird. and we don't need explanations of things, only the tools, with a small ? icon at the top right for each tool with some more description, if the user wants to click. i don't want any page to be long enough to be scrollable like that, use parallel agents to test"

The four changes:
1. **Essential motion (§2).** The wheel spin, coin flip and dice roll always animate unless the user turns Animations off in Settings. When the system asks for reduced motion they get a shorter, gentler version.
2. **No explanatory content on pages (§3).** The whole below-the-fold section goes away. A "?" button on every tool screen opens a help sheet instead. The SEO copy moves into a static help `<dialog>`.
3. **No page scroll (§4).** Every screen fits the viewport as a full-height flex column. Long content scrolls only inside bounded regions, sheets or the result overlay.
4. **Ads (§5).** The ad moves to a reserved 320×50 dock at the bottom of Home. It loads after the first interaction.

---

## 1. File tree (new = ★, changed = ✎, generated = ⚙)

```
js/help.js              ★ Help copy for every in-app screen, openHelp(key), helpButton(key)
js/screens/lists.js     ★ #/lists: saved lists, ready-made lists, and a "New list" FAB
js/app.js               ✎ 3-state motion, /lists route, removes initBelow and the scroll listener, VERSION 4.0.0
js/ui.js                ✎ motionLevel()/decorMotion(), help icon, fitTiles(), in-flow FAB; removes scrollToResult; setBackgroundInert without #below
js/site.js              ✎ removes initBelow; adds data-home toggling
js/ads.js               ✎ Home dock, interaction trigger
js/presets.js           ✎ top bar actions [history, ⋮, ?]; Sound moves into ⋮; one-row preset bar
js/tools.js             ✎ List tool route '/lists'
js/search.js            ✎ the List tool entry links to #/lists
js/config.js            ✎ comment only: ad unit is 320×50
js/screens/home.js      ✎ tile grid and a bounded Saved region
js/screens/source.js    ✎ becomes a summary row plus an "Items" sheet
js/screens/{number,list,list-edit,dice,coin,lots,teams,shuffle,wheel,lottery,cards,settings}.js  ✎ layout and motion (§4, §2)
css/app.css             ✎ layout primitives, tiles, help, dock; removes .below/.about/.other-tools/.site-footer rules
tools/page-template.html ✎ no #below; {{HELP}} dialog; ad dock after <main>; data-home in the inline script
tools/build-pages.mjs   ✎ help() replaces article()/nav()/footer(); privacy doc page; 320×50 ad markup
tools/pages-data.mjs    ✎ small copy edits only (§3.6)
sw.js                   ✎⚙ PRECACHE adds ./js/help.js and ./js/screens/lists.js
tests/site.test.mjs     ✎ (§7)
README.md               ✎ ad unit size 320×50; test line unchanged
*/index.html, index.html, sw.js CACHE   ⚙ regenerated
```

---

## 2. Essential motion

### 2.1 Why the wheel did not spin
There are two independent causes:
1. `app.js` sets `data-motion="off"` when `prefers-reduced-motion: reduce` matches. `wheel.js` then takes the instant path. The user's OS very likely has reduced motion on.
2. Even when the JS path animates, `[data-motion="off"] * { transition: none !important }` overrides the inline `svg.style.transition`. `transitionend` then never fires, and the 4.6 s fallback timer finishes after a frozen wheel.

Minor fragility: the spin depends on a CSS transition, a forced reflow and `transitionend`. The fix below uses the Web Animations API (WAAPI). The CSS `animation`/`transition` rules do not affect WAAPI, it has no reflow ordering issue, and `anim.finished` replaces `transitionend`.

### 2.2 Motion levels
`<html data-motion>` takes one of three values. `applyMotion()` in app.js sets it:

| value | when | effect |
|---|---|---|
| `off` | `settings.animations === false` | no motion at all |
| `reduced` | animations on and `prefers-reduced-motion: reduce` | decorative motion off; essential motion short and gentle |
| `on` | otherwise | everything as v3 |

CSS: the existing kill rule applies to **both** `[data-motion="off"]` and `[data-motion="reduced"]` (`animation: none !important; transition: none !important`, plus the `:active` transform rules). Decorative motion therefore still follows reduced motion with no per-rule work. This covers sheets, reveals, press scale, switch thumbs, lots flips, dice wobble and the coin arc.

ui.js replaces `motionOn()` with two functions:
- `motionLevel()` returns `'on' | 'reduced' | 'off'`. Use it only for essential motion.
- `decorMotion()` returns `motionLevel() === 'on'`. Every current `motionOn()` caller that is decorative switches to it: teams/shuffle/cards reveal classes, the lots flip-back delay and the dice settle animation.

Remove `motionOn` so that no caller is missed.

### 2.3 Essential animations (WAAPI, never CSS transitions)

| tool | `on` | `reduced` | `off` |
|---|---|---|---|
| Wheel | 4400 ms, 6 full turns + delta, `cubic-bezier(.12,.72,.14,1)` | 1800 ms, 2 turns + delta, `cubic-bezier(.25,.6,.3,1)`, no overshoot | instant |
| Coin | 900 ms `rotateY`, 5 turns + delta, plus the CSS `.arc` hop (decorative) | 600 ms `rotateY`, 2 turns + delta, no hop | instant |
| Dice | 500 ms: wobble (CSS, decorative) + face cycling every 70 ms, then `.settle` | 400 ms face cycling only (no transform), no settle animation | instant |

Wheel spin algorithm (the result is still chosen by `weightedIndex` before any motion):
```js
const prev = rotation;
rotation += 360 * turns + delta;              // turns = 6 | 2
svg.style.transform = `rotate(${rotation}deg)`; // commit the end state first
if (level === 'off' || !svg.animate) return finish();
anim = svg.animate([{ transform: `rotate(${prev}deg)` }, { transform: `rotate(${rotation}deg)` }],
                   { duration, easing });
anim.finished.then(finish, () => {});        // cancel() rejects: ignore
timer = setTimeout(finish, duration + 300);  // safety net (hidden tab, etc.)
```
- `finishNow()`, called on rebuild and cleanup, calls `anim?.cancel()` and then `finish()`. The transform is already at the end state.
- `rebuild()` sets `svg.style.transform = 'rotate(0deg)'` and no longer touches `style.transition`.
- Remove all `svg.style.transition` code and the `transitionend` listener.
- `finish` is idempotent (the `done` flag stays).
- `.wheel { will-change: transform }` stays.

Coin: the same pattern on `.coin`. `coinEl.animate([{transform: rotateY(prev)}, {transform: rotateY(rot)}], …)`, finishing through `anim.finished` plus a timeout of `duration + 150`. Remove the `transitionend` listener and `setRot(…, true)`. The `.arc` class is added only when `decorMotion()`.

Dice: `roll()` branches on `motionLevel()`. `'off'` settles immediately. Otherwise it runs the 70 ms interval for 500 or 400 ms. The `rolling` class is only added when `decorMotion()`.

### 2.4 Settings → Animations
The row stays a switch labelled "Animations". Its hint depends on the state:
- OS reduce on: "Your device asks for less motion: spins and flips are shorter. Turn off to stop all motion."
- Otherwise: "Turn off to stop all motion, including spins and flips."

The hint updates live when the media query changes while Settings is open. Subscribe on `matchMedia` and unsubscribe on cleanup.

---

## 3. Help "?" replaces the below-the-fold section

### 3.1 What is removed
Remove all of these on every page:
- The `#below` wrapper, `.about` article, `.tool-groups` "All tools" list, `nav.other-tools` "More random tools", `footer.site-footer` and the old `.ad-slot` position.
- `initBelow`, `data-off-entry`, `data-below`, `data-scrolled` and the window scroll listener in app.js.
- Their CSS.

Every page, including landing pages and the root, shows only the app.

### 3.2 Top bar
Tool screens (the `toolChrome` users, plus List): **[history] [⋮] [?]**. The "?" is the rightmost icon (the user asked for it at the top right).
- `soundToggle()` leaves the bar. The ⋮ menu gains a first item "Sound: On" / "Sound: Off" that toggles `settings.sound` and shows a toast "Sound on"/"Sound off". Settings keeps its Sound switch.
- The List editor: [?]. `#/lists`: [?]. Home: [settings] [?]. Settings: no "?".
- `helpButton(key)` is an `icon-btn` with `aria-label="Help"`, `aria-haspopup="dialog"` and a new `help` icon (a circle with "?", 1.5 stroke, same style as the others).

### 3.3 `openHelp(key)` (js/help.js)
1. If `currentPath() === getEntry()` and `#help` (the static dialog, §3.4) exists: `dlg.scrollTop = 0; dlg.showModal()`. The page-specific SEO copy is the help.
2. Otherwise, build a sheet with `openSheet({ title, body })` from `HELP[key]`.

Both variants end with the **help foot**: a small line `Privacy · <TIP_LABEL>`.
- Privacy links to the site's `privacy/` (via `new URL('../privacy/', import.meta.url)` in JS, or `{{BASE}}privacy/` statically).
- The tip link is present only when `TIP_URL` is set.
- Both use `target="_blank" rel="noopener"` for the tip only.

The static dialog closes on Done, on Esc (native) and on a backdrop click. help.js attaches the backdrop listener once. `closeAllOverlays()` already closes every `dialog[open]`. The static dialog is **never removed** from the DOM.

Keys and routes:

| key | used on |
|---|---|
| `home` | `/` |
| tool id | each tool route (including `/p/:id`) |
| `list` | `/list/:id` |
| `listEdit` | the editor routes |
| `lists` | `/lists` |

### 3.4 Static help dialog (landing pages, SEO)
build-pages.mjs `help(p, base)` replaces `article()`, `nav()` and `footer()`. It is emitted for every `p.tool` page as `{{HELP}}`:

```html
<dialog id="help" class="sheet help-sheet" aria-labelledby="help-h1">
 <div class="sheet-body">
  <div class="sheet-handle" aria-hidden="true"></div>
  <article class="help-doc">
   <h1 id="help-h1">{h1}</h1>
   <p>{intro[0]}</p><p>{intro[1]}</p>…
   <h2>Questions</h2>
   <h3>{q}</h3><p>{a}</p>…
   <nav class="help-links" aria-label="Other tools">
    <h2>Other tools</h2>          <!-- root page: "All tools" -->
    <ul><li><a href="{base}{slug}/">{nav}</a></li>…</ul>
   </nav>
   <p class="help-foot"><a href="{base}privacy/">Privacy</a>[ · <a href="{TIP_URL}" target="_blank" rel="noopener">{TIP_LABEL}</a>]</p>
  </article>
  <form method="dialog" class="sheet-actions"><button class="btn filled">Done</button></form>
 </div>
</dialog>
```

- **Links**: every slug tool page in GROUPS order, excluding the page itself. Slug pages also get a final `<li><a href="../">All tools</a></li>`.
- **Layout**: links render as a compact wrapped list of small chips (no group headings) to keep the dialog short. This is the crawlable internal-link path. Google parses links and text in closed `<dialog>` content.
- **Home tiles stay hash links** (`#/number`). This is deliberate: full-page navigation would reset the SPA back stack and reload on every tap. Crawlers already get the full link graph from the dialog on every page.
- The dialog `h1` is the page's h1 for SEO. The app's top-bar title stays an `h1` too. Only one is in the accessibility tree at a time (a closed dialog is not rendered).
- **No-JS**: the template adds `<noscript><style>#help{display:block;position:static;max-height:none}</style></noscript>` so that the copy is readable without JS.
- Unchanged: `jsonLd()`, `seoMeta()`, titles, meta, canonical, OG, sitemap and robots. The build validation still requires h1, 2+ intro paragraphs, 2+ FAQs, nav and group. `blurb` is no longer rendered: drop its validation and leave the data.

### 3.5 Privacy page (`p.tool === false`)
`{{APP_MAIN}}` becomes a static full-height page:
```html
<main class="doc-page">
 <header class="topbar"><a class="icon-btn topbar-back" href="../" aria-label="Home">{back svg}</a><h1>Privacy</h1></header>
 <div class="doc scroll-region"><p>…intro…</p>[<p>ADS_PRIVACY linkified</p>]</div>
</main>
```
There is no help dialog, no ad dock and no app script. `.doc` may scroll internally (the ads paragraph can overflow at 320×568). The page itself must not scroll.

### 3.6 In-app help copy (`HELP` in js/help.js)
Shape: `{ title, intro, steps: string[], faq: [q, a][] }`. The sheet renders:
- the title as the sheet h2,
- the intro `<p>`,
- an `<ol class="help-steps">`,
- when present, `<h3>Questions</h3>` followed by h3/p pairs,
- the help foot.

Copy (light edits OK):
- **home** "Random": "Fair random tools that work offline." Steps:
  - "Tap a tool to start."
  - "Search finds tools, presets and lists: try d20 or coin."
  - "Save any tool's setup from its ⋮ menu; it appears under Saved."

  FAQ:
  - "Is it really random?" → "Yes. Results come from crypto.getRandomValues with rejection sampling, so every outcome is equally likely."
  - "Where is my data?" → "Only on this device, in your browser's storage."
- **number** "Number": "Pick whole numbers in any range." Steps:
  - "Set From and To (up to ±1,000,000,000)."
  - "Parameters: how many (up to 100), sort, duplicates."
  - "No repeat draws each number once until the pool runs out."

  FAQ: "Earlier results?" → "Tap the clock icon for the last 20."
- **list**: the title is the list name. "Pick items from this list." Steps:
  - "Tap Generate."
  - "Parameters sets how many to pick (up to 20)."
  - "No repeat goes through every item once. Edit the list from ⋮."

  FAQ: "Can some items be more likely?" → "Yes: add *3 after an item in the editor."
- **listEdit** "Editing a list": steps:
  - "One item per line, up to 500."
  - "Paste adds items split on commas, tabs or new lines."
  - "Add *3 to an item to make it 3× as likely."
- **lists** "Lists": steps:
  - "Tap a list to pick from it."
  - "New list creates one; ⋮ on a row renames, edits or deletes it."
  - "Ready-made lists are saved the first time you open them."
- **dice** "Dice": steps:
  - "Tap Roll or the dice."
  - "Tap the notation chip (like 2d6+3) for sides and modifier."
  - "The stepper sets 1–12 dice."

  FAQ: "Which dice?" → "d2 to d100, a modifier from −99 to +99."
- **coin** "Coin": steps:
  - "Tap Flip or the coin."
  - "The tally shows heads, tails and streaks; Reset tally clears it."

  FAQ: "Is it 50/50?" → "Yes, exactly."
- **lots** "Cast lots": steps:
  - "Tap a lot to reveal it; a star marks a winner."
  - "Parameters sets 2–30 lots and the number of winners."
  - "New round hides new winners."
- **teams** "Teams": steps:
  - "Tap the names row to paste names or choose a saved list."
  - "Split into a number of teams or by group size."
  - "Tap Split; team sizes differ by at most one."
- **shuffle** "Shuffle": steps:
  - "Tap the items row to add items or choose a saved list."
  - "Tap Shuffle; every order is equally likely."
- **wheel** "Wheel": steps:
  - "Tap the items row to edit the wheel (up to 100 items)."
  - "Add *3 to an item for a 3× bigger slice."
  - "Tap Spin; the result is chosen fairly before the wheel moves."

  FAQ: "Why is the spin shorter sometimes?" → "Your device asks for less motion. Settings → Animations turns motion off entirely."
- **lottery** "Lottery": steps:
  - "Pick a format chip, or set your own in Parameters."
  - "Draw up to 10 lines, with bonus balls from the same or a separate pool."

  FAQ: "Does it improve my odds?" → "No. Random picks don't change your odds. Play responsibly."
- **cards** "Cards": steps:
  - "Tap Draw; Parameters sets 1–10 cards and jokers."
  - "No repeat (deck) deals from one deck until you reshuffle."

pages-data.mjs copy edit: the magic-8-ball intro "try the Random answer list on the home screen" becomes "…in Lists". Nothing else changes: "on the home screen" for presets and lists stays true, because Home now has a Saved region.

---

## 4. No page scroll

### 4.1 Target
Every route fits the viewport with **no document scroll** at 360×640 and 390×844/412×915. At 320×568 it fits by compacting, never by scrolling. This holds in light and dark, in the default state, after a result and with the preset bar showing.
- Sheets, dialogs, the result overlay and the elements marked `.scroll-region` may scroll internally.
- Settings is the only screen whose `.content` is a `.scroll-region`. It must still fit without scrolling at ≥ 360×640.
- Out of scope: on-screen keyboard open (the browser may pan the visual viewport) and landscape phones (`.content` then scrolls internally as a safety net, §4.2).

### 4.2 Layout primitives (css/app.css)
```css
html, body { height: 100%; }
body { height: 100vh; height: 100dvh; display: flex; flex-direction: column; }
#app { flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column; }   /* was min-height:100dvh */
.topbar { flex: none; position: relative; }   /* not sticky; hairline removed */
.content { flex: 1 1 0; min-height: 0; overflow-x: clip; overflow-y: auto;      /* safety net only */
           padding: var(--sp-2) var(--sp-5) var(--sp-2); }
.scroll-region { flex: 1 1 0; min-height: 88px; overflow-y: auto; overscroll-behavior: contain; }
.fit-box { flex: 1 1 0; min-height: 0; container-type: size; display: grid; place-items: center; overflow: clip; padding: 8px; }
.fab { position: relative; flex: none; align-self: center; z-index: 60;
       margin: var(--sp-2) 0 calc(env(safe-area-inset-bottom) + 16px); transform: none; }
.fab:active { transform: scale(.97); }       /* update the data-motion :active rules to match */
@media (max-height: 600px) { /* compact: --sp-* one step smaller in .content, --fs-display 64px, big-input smaller */ }
```

Notes on the primitives:
- **FAB**: it is now in flow as the last child of `#app`, so the content can never sit under it. It keeps `z-index: 60` above the fixed result overlay (z 50), since `#app` creates no stacking context: do not give `#app` a transform, opacity or z-index.
- **Result overlay**: its bottom padding stays, so the card clears the FAB.
- **Toast**: stays fixed.
- **Screens without a FAB** (Home, Settings, List editor) add `padding-bottom: calc(env(safe-area-inset-bottom) + var(--sp-4))` to `.content`.
- **`fit-box`**: its children size themselves with `min(100cqw, 100cqh, <max>)`. This is how the wheel, coin and dice visuals shrink to the space available.
- **Reserved result space**: when an inline result appears, the tool visual must not resize. Inline result lines and the `.inline-actions` row reserve their space from the start with `visibility: hidden` instead of `hidden` (wheel, lottery, cards, teams, shuffle).
- **`scrollToResult`**: remove it. A new result instead sets its region's `scrollTop = 0`.
- Delete `.center-area { min-height: 200px }` and set it to `min-height: 0`.

`ui.js fitTiles(box, n, { aspect, gap, min, max })` returns `{ cols, size }`. It picks the largest tile width in `[min, max]` such that `rows × (size × aspect) + gaps ≤ box.clientHeight` and `cols × size + gaps ≤ box.clientWidth`, by trying `cols = 1..n`. If none fits at `min`, it uses `min` and the box scrolls (only then: the box gets `.scroll-region`). Callers re-run it from a `ResizeObserver` and set `--tile`/`--cols` on the box. Disconnect the observer on cleanup.

### 4.3 Per screen (content order, top to bottom)

- **Home**:
  - **Top bar**: a compact bar (not `.large`, 52 px) with the title "Random" and [settings] [?].
  - **Search**: 44 px.
  - **Tile grid**: one grid of all 10 tools in `TOOLS` order, `repeat(5, 1fr)`, gap 6–8 px, with no "Tools"/"More tools" labels. A tile is an `<a class="tool-tile" href="#{route}">`: the 32 px icon tile above a 12 px/16 px label that may wrap to 2 lines (min-height 76 px, radius `--r-md`, `--surface-1`). The List tile goes to `#/lists`.
  - **Saved region**:
    - It has a section label "Saved" and a `.scroll-region` that fills the rest.
    - Groups follow `TOOLS` order: a 32 px group header (small tile icon + tool label, muted), then that tool's child rows (presets, and saved lists under List) using the v3 `childRow` (48 px, ⋮ Rename/Edit/Delete). This keeps presets "under their tool".
    - The v3 5-item collapse is removed, since the region scrolls.
    - Empty state: one muted line "Presets and lists you save appear here".
  - **Search results** replace the grid and the Saved region with one `.scroll-region`.

  Why this design and not a Saved tab: saved items stay visible without an extra tap, and the 2-row grid (≈170 px) leaves ≥ 200 px for Saved even at 320×568 with the ad dock.
- **Lists** (`#/lists`, new): top bar "Lists" [?]. A `.scroll-region` with:
  - "Your lists": the childRows, or the hint "No lists yet".
  - "Ready-made": the `BUILTIN_LISTS` not yet saved, as rows linking to `#/list/<id>`.

  The FAB is "New list" (plus icon) and goes to `#/list/new`. Search's List entry and `TOOLS.list.route` become `/lists`. List presets stay `presets: false`.
- **Number**:
  - The preset bar, then the From/To `.center-area` (`flex:1`).
  - The No-repeat card.
  - The Parameters pill.
  - The result opens in the overlay (100 values scroll inside the card, as today).
- **List**:
  - `.items` becomes a `.scroll-region`.
  - Below it sit the No-repeat card and the Parameters pill (pinned).
- **List editor**:
  - Name field.
  - Items caption row with Paste.
  - A textarea with `flex: 1 1 0; min-height: 96px; resize: none`.
  - The tip/count row.
  - Cancel/Save.
- **Dice**:
  - The preset bar.
  - A `.fit-box` holding `.dice-area`, which uses `fitTiles` (aspect 1, min 40, max from v3 `dieSize(n)`, gap 16 or 10 when compact). `--die` is set from the result.
  - The notation chip and total.
  - The stepper.
- **Coin**:
  - A `.fit-box` with `.coin-stage { width: min(100cqw, 100cqh, 240px) }`. Its bottom margin is removed. The hop is a transform, so it never affects layout.
  - Below it, flex:none: result, stats, streak, then Reset tally.
- **Lots**: status line, a `.lots-grid` box (`flex:1`) sized by `fitTiles` (aspect 4/3 portrait, min 40, max 96, gap 8), then the Parameters pill. 30 lots must fit at 320×568.
- **Teams**:
  - The preset bar.
  - The **source row** (§4.4).
  - The settings card (segmented and stepper, as today).
  - A `.scroll-region` holding `.teams-grid`, with the placeholder "Tap Split to make teams" (muted, centered) before the first split.
  - The foot row.
- **Shuffle**:
  - The preset bar.
  - The source row.
  - A `.scroll-region` with `ol.shuffle-out`, with the placeholder "Tap Shuffle for a random order".
  - The foot row.
- **Wheel**:
  - The preset bar.
  - The source row.
  - A `.fit-box` with `.wheel-stage { width: min(100cqw, 100cqh, 360px) }`.
  - A result line (reserved 36 px, single line with ellipsis; the full text is in the copy/share and history).
  - The foot row.

  "Showing the first 100 items" moves into the source row's subtitle.
- **Lottery**:
  - The preset bar.
  - The format chips as one non-wrapping row (`overflow-x: auto`, no page horizontal scroll, `scrollbar-width: none`).
  - A `.scroll-region` with the lines, plus the "Play responsibly" note after the last line.
  - The foot row.
- **Cards**:
  - The preset bar.
  - The No-repeat card.
  - A `.scroll-region` `.hand`.
  - The foot row.
- **Foot row** (Teams, Shuffle, Wheel, Lottery, Cards): a single 44 px row. `.inline-actions` (Copy, Share; reserved) sits on the left. The Parameters pill (Lottery, Cards) sits on the right.
- **Preset bar** (all tools): one 44 px row with the ellipsized text "Changed from "X"", then [Update] [Revert]. "Save as new" leaves the bar; the ⋮ menu already offers "Save as new preset…".
- **Settings**:
  - Top bar, then `.content.settings.scroll-region`.
  - Theme card, then a card with Sound, Vibration and Animations (§2.4), then the tip card (if any).
  - A final row that holds Clear all data (left) and Privacy (right), both 44 px.
  - The version line.

  Compact at max-height 600 px.

### 4.4 Source row (source.js)
`sourceCard` becomes `sourceSummary({ tool, noun, onChange })`. It returns `{ el, getItems, focus, cleanup }`, the same API, where `focus()` now opens the sheet.
- **Row**: `.card.source-row`, 56 px, clickable as a whole (`role="button"`, `aria-haspopup="dialog"`).
  - Title (Paste): "8 names" / "6 items". With a list: "List: Party names".
  - Subtitle: "Tap to edit", or with a list "12 items". For the wheel over 100: "120 items · first 100 shown".
  - Right side: an "Edit" text button.
  - Fewer than 2 items: the title reads "Add at least 2 names/items" in the accent colour.
- **Sheet** "Items" (`openSheet`) holds the v3 content unchanged: the segmented Paste | Saved list control, the textarea (rows 8), Paste/Clear and the count, the list select with "Edit list", and the missing-list hint.
  - Edits apply live (debounced 250 ms) as today, so the wheel redraws behind the sheet.
  - On close: `flush()`, repaint the row, `onChange()`.
- A preset URL with `?edit=1` opens the sheet on mount.

---

## 5. Ads

- **Placement**: a reserved dock at the bottom of **Home only**, and only when `ADS_ON` is true and `data-noads` is not set.
  - It never appears on tool screens, so it can never overlap a result or the FAB.
  - It is never in the help dialog.
- **Markup**: build-pages emits it on every tool page right after `</main>` as `{{AD_SLOT}}`:
  ```html
  <aside id="ad-slot" class="ad-dock" aria-label="Advertisement">
   <ins class="adsbygoogle" style="display:inline-block;width:320px;height:50px" data-ad-client="…" data-ad-slot="…"></ins>
  </aside>
  ```
  - `.ad-dock`: `flex: none; height: calc(58px + env(safe-area-inset-bottom)); padding: 4px 0 env(safe-area-inset-bottom); display: flex; justify-content: center; border-top: hairline; background: var(--bg)`.
  - It shows only when `html[data-home]:not([data-noads])`. Otherwise it is `display:none`.
  - The `:has(ins[data-ad-status="unfilled"])` collapse rule stays. It only grows the Saved region, and nothing above it moves.
  - There is no visible "Advertisement" label (it is not required, and it costs height). The `aria-label` stays.
- **`data-home` without shift**:
  - The inline head script sets `data-home` before first paint when `data-entry === '/'` and the hash is empty, `#` or `#/`.
  - site.js registers `beforeMount(() => html.toggleAttribute('data-home', currentPath() === '/'))`.
  - Home's layout is measured with the dock present, so there is no CLS.
- **Lazy load** (ads.js): never at boot. Load once, when both of these hold:
  - the user has interacted at least once (`pointerdown`/`touchstart`/`keydown`);
  - the dock is displayed (`slot.offsetHeight > 0`).

  Re-check on the first interaction and after every route change (`hashchange` → `requestAnimationFrame`). The offline check, `onerror` → `data-noads` and the `?noads=1` / 5-tap owner flag are unchanged.
- **Config**: `js/config.js` and README say "a FIXED-SIZE 320×50 display ad unit". `ADS_PRIVACY` still appears on the privacy page when `ADSENSE_CLIENT` is set.

---

## 6. Other details
- `setBackgroundInert` targets only `#app` children except `.fab`, since `#below` is gone.
- `router.mount` keeps `window.scrollTo(0, 0)` (harmless).
- The app.js keyboard handler (Space/Enter) already ignores `dialog[open]`, which covers the static help too.
- Help-sheet styles: `.help-doc h1` 22px/600; `h2` `--fs-title`; `h3` `--fs-body`/600; `p` `--fs-sub`/1.55 `--text-2`. `.help-links ul` is a flex-wrap of 32 px chips (`--surface-2`, `--fs-footnote`). `.help-foot` is `--fs-footnote`, centered, with links ≥ 44 px tall.
- **Deliberately left out**:
  - real `<a href>` landing-page links on Home tiles (§3.4);
  - a Saved tab on Home;
  - a visible label on the ad;
  - ads anywhere except the Home dock;
  - handling of the landscape and keyboard-open layouts beyond the `.content` safety net;
  - JS-generated "Other tools" links in in-app help sheets (crawlers only read the static dialog).

---

## 7. Unit tests (`tests/site.test.mjs`)
Replace the "grouped nav" test with a **help dialog** test. For every `p.tool` page, the HTML:
- contains exactly one `<dialog id="help"`;
- contains `id="help-h1">{esc(h1)}</h1>`, every escaped intro paragraph and every escaped FAQ question inside the dialog;
- contains `<nav class="help-links"` with no self link; slug pages include `href="../">All tools`; the root page links to every slug page;
- contains `class="help-foot"` with a `privacy/` link;
- contains none of `id="below"`, `class="about"`, `other-tools`, `site-footer`.

The privacy page contains `class="doc-page"` and no `id="help"`.

Also:
- The PRECACHE includes `./js/help.js` and `./js/screens/lists.js`.
- The JSON-LD FAQPage questions equal `p.faq` questions for each page.
- With the committed empty config there is no `ad-slot` markup.
- Keep: parsePreset tests, 29 pages, source hygiene (still exactly 1 `innerHTML`: the static help markup is built by the build script, not by `innerHTML` at runtime), build idempotence and generated-output checks.

`tests/rng.test.mjs` and `tests/v3.test.mjs` must still pass. If a v3 test asserts the List tool's search href, update it to `#/lists`.

---

## 8. Parallel test plan (browser reviewers)

**Setup (every slice)**:
- Run `node tools/build-pages.mjs && node tests/rng.test.mjs && node tests/site.test.mjs && node tests/v3.test.mjs` first.
- Serve the repo root with `python3 -m http.server 8080` at `http://localhost:8080/`.
- Use Playwright/Chromium with `hasTouch: true, isMobile: true, deviceScaleFactor: 2`.
- **Viewports**: 320×568, 360×640, 390×844 and 412×915. Run each viewport in `colorScheme: 'light'` and `'dark'`, with `reducedMotion: 'no-preference'` unless a check says otherwise.
- Start from a clean `localStorage` unless the check seeds state.

**NOSCROLL(page)**: run it after every navigation, after every result and after closing every sheet. It passes when all of these hold:
```js
() => {
  const se = document.scrollingElement, vh = innerHeight, vw = innerWidth;
  const docOk = se.scrollHeight <= vh + 1 && se.scrollWidth <= vw + 1;
  const overflowing = [...document.querySelectorAll('#app .content, #app .topbar, .doc-page')]
    .filter(el => !el.classList.contains('scroll-region') && el.scrollHeight > el.clientHeight + 1)
    .map(el => el.className);
  const top = document.querySelector('#app .topbar, .doc-page .topbar')?.getBoundingClientRect().bottom ?? 0;
  const fab = document.querySelector('#app > .fab')?.getBoundingClientRect();
  const floor = fab ? fab.top : vh;
  const clipped = [...document.querySelectorAll('#app .content :is(button,a,input,select,textarea,[role=switch])')]
    .filter(el => el.offsetParent && !el.closest('.scroll-region, .fit-box'))
    .filter(el => { const r = el.getBoundingClientRect(); return r.top < top - 1 || r.bottom > floor + 1; })
    .map(el => el.outerHTML.slice(0, 80));
  const tiny = [...document.querySelectorAll('#app .scroll-region')].filter(el => el.offsetParent && el.clientHeight < 88).length;
  return { ok: docOk && !overflowing.length && !clipped.length && (!fab || fab.bottom <= vh) && !tiny, docOk, overflowing, clipped, tiny };
}
```
**HELP(page, text)**: click `button[aria-label="Help"]`. Expect:
- a `dialog[open]` that is visible;
- its text contains `text`;
- the help foot contains a Privacy link;
- the dialog's own `scrollHeight` may exceed its height, but NOSCROLL still passes;
- Esc closes it and focus returns to the "?" button.

Each slice also saves screenshots of every state at 360×640 in light and dark, for a visual pass: no overlapping, no cut-off text, the "?" visible at the top right.

### Slice A: Home, search, presets, Lists, Settings
1. **Home default** passes NOSCROLL at all 8 combos:
   - 10 tiles are visible and none are clipped.
   - The Saved empty line is visible.
   - The top bar has [settings][?] with "?" rightmost.
   - No "Tools"/"More tools" labels are shown, and there is no text below the app.
2. **Seeded state** (12 presets across number/dice/wheel/lottery plus 3 lists): NOSCROLL passes.
   - `.scroll-region` scrollHeight > clientHeight.
   - Presets are grouped under the right tool headers in TOOLS order.
   - Row ⋮ → Rename/Edit/Delete works.
3. **Search**: type `d` → the results replace the grid and Saved. NOSCROLL passes; the results region scrolls internally.
   - `d20` + Enter opens Dice at d20.
   - Escape clears the search.
   - `/` focuses the search.
   - `zzz` shows the empty state.
4. **Lists** (`#/lists` via the List tile): "Your lists" and "Ready-made" are shown and NOSCROLL passes.
   - The "New list" FAB opens the editor.
   - Opening a ready-made list saves it.
   - HELP(`Lists`).
5. **Settings**: NOSCROLL passes, and at 360×640 and above `.content.scrollHeight <= clientHeight + 1`, even though it is a scroll-region. Also check:
   - The Animations hint text changes with `reducedMotion: 'reduce'` (live when emulation toggles).
   - Privacy and Clear all data are reachable.
   - The tip card is absent with the empty config.
6. HELP(`Fair random tools`) on Home via the in-app help.
7. On `/` (the root page, entry route), "?" opens the static `#help` with the text "Random: simple, fair random tools".

### Slice B: Number, List (+ editor), Dice, Coin, Lots
For each tool, NOSCROLL passes at all 8 combos in the default state, after a result and with the preset bar dirty (save a preset, then change a setting).
1. **Number**:
   - 1–10 → generate: the overlay shows and NOSCROLL passes.
   - count 100 with duplicates allowed over 1–1000: the overlay card scrolls internally and the page does not.
   - With No repeat on, the counter updates.
2. **List** `#/list/preset-letters` (26 items): `.items` scrolls internally, and the No-repeat card and Parameters pill are visible. Pick 20 opens the overlay.
3. **Editor**: paste 500 lines. The textarea scrolls internally, Save is visible without page scroll, and saving works.
4. **Dice**:
   - 1d6, 6d6 and 12d20 fit, with every die ≥ 40 px and none clipped.
   - Notation-chip sheet: `2d6+3` applies.
   - Motion `on`: during a roll `.die.rolling` exists and the faces change.
   - `reducedMotion: 'reduce'`: faces change at least twice within 400 ms, and there is no `rolling` class.
   - Settings Animations off: faces are set instantly.
5. **Coin**:
   - Motion `on`: `coinEl.getAnimations().length === 1` right after Flip, and it finishes in ≈900 ms.
   - `reduce`: there is 1 animation of ≈600 ms and `.coin-stage` does not get `.arc`.
   - Animations off: 0 animations.
   - In every mode the result text and tally are correct afterwards.
6. **Lots**: n = 2, 6 and 30. All lots are visible without scroll, each ≥ 40 px wide, at 320×568. Reveal and new round work.
7. For each tool:
   - HELP(tool intro text).
   - The ⋮ menu contains "Sound: On"; toggling it flips `settings.sound`.
   - The top bar has [history][⋮][?].

### Slice C: Teams, Shuffle, Wheel, Lottery, Cards
For each tool, NOSCROLL passes at all 8 combos in the default state and after a result.
1. **Teams**:
   - The source row reads "8 names"; tapping it opens the Items sheet.
   - Paste 50 names → close; the row reads "50 names".
   - Split into 2: the teams region scrolls internally and the page does not.
   - Group size mode works.
   - With a saved list as source, the row reads "List: …".
   - `?edit=1` on a preset opens the sheet.
2. **Shuffle**: with 100 items, the result `ol` scrolls internally. Copy and Share are visible in the foot row.
3. **Wheel**, essential motion:
   - (a) Motion `on`: right after Spin, `svg.getAnimations().length === 1` and the effect duration is 4400. At +1 s the computed transform differs from the start. The result appears at 4.4–4.8 s.
   - (b) `reducedMotion: 'reduce'`: one animation with duration 1800, and the transform changes mid-spin. **This is the user's bug.**
   - (c) Settings Animations off: 0 animations, and the result appears immediately.
   - (d) The wheel stage size is identical before and after the result appears.
   - (e) 2 items and 120 items (the subtitle says "first 100 shown").
   - (f) Editing items mid-spin finishes the spin cleanly.
   - (g) The landed segment under the pointer matches the result text (sample 20 spins in `off` mode by reading segment angles).
4. **Lottery**:
   - 10 lines of 5/69 + 1/26: the lines region scrolls internally.
   - The chips row scrolls horizontally without `document.scrollingElement.scrollWidth > innerWidth`.
   - The "Play responsibly" note is inside the region.
5. **Cards**: 10 cards + jokers: the hand region scrolls internally. No-repeat counting and reshuffle work.
6. For each tool, HELP(tool text), and the top bar has [history][⋮][?].

### Slice D: cross-cutting (site, SEO, SW, ads, build)
1. **Every landing page** (all 28 slug pages + `/`): load the page and check:
   - NOSCROLL passes at 320×568 and 360×640, light and dark.
   - There is no visible text outside `#app`: `document.body.innerText` minus `#app` innerText is empty.
   - "?" opens the static `#help` whose `h1` equals `p.h1`, and it contains every FAQ question and a "Other tools"/"All tools" link list with no self link.
2. **Off-entry**: on `/dice-roller/`, navigate to `#/coin` → "?" opens the JS Coin help (not the static D-roller copy). Back to `#/dice`: static again.
3. **Privacy** `/privacy/`: NOSCROLL passes at all viewports, the back link goes Home, and there is no `#help` and no app script.
4. **JSON-LD**: on every page each `ld+json` block parses. The graph has `WebApplication` and `FAQPage`, whose questions equal pages-data. `<title>` equals `p.title`, and `meta[name=description]` equals `p.description`. The og tags are present. (v3 is not committed, so the check compares against pages-data rather than a git diff.)
5. **Offline/SW** (localhost): load `/`, wait for `navigator.serviceWorker.controller`, then `context.setOffline(true)`.
   - Reload `/`, `/spin-the-wheel/` and `/privacy/`, and visit every route including `#/lists`: all render.
   - `caches` contains `./js/help.js` and `./js/screens/lists.js`.
6. **Ads with the sample config**: work in a scratch copy of the repo (never edit the real config).
   - Set `SITE_URL:'https://random.test/'`, `ADSENSE_CLIENT:'ca-pub-1234567890123456'`, `ADSENSE_SLOT:'1234567890'` and `TIP_URL:'https://ko-fi.com/test'`.
   - Build twice: the outputs are identical.
   - `ads.txt`, `sitemap.xml` and canonicals are present.
   - Every tool page has `#ad-slot.ad-dock` directly after `</main>` with a 320×50 `ins`.
   - Privacy shows the ads paragraph, and the help foot shows the tip link.
   - Serve the copy with Chromium `--host-resolver-rules="MAP random.test 127.0.0.1"` at `http://random.test:8080/`, and route `**/pagead2.googlesyndication.com/**` to abort while recording requests. Then check:
     - On load: no ad request; the dock is visible on Home at 50 + 8 px; NOSCROLL passes on Home at all viewports with the dock.
     - A `PerformanceObserver('layout-shift', buffered)` sum is 0 after load and after the first tap.
     - The first `pointerdown` on Home → exactly one script request.
     - Fresh load at `#/number`, tap → no request. Navigate to Home → one request.
     - `#/number`, `#/wheel`: the dock is `display:none`.
     - `?noads=1` → no dock and no request. `?noads=0` restores it.
7. **Build idempotence and unit tests**: all three test files pass, and running `node tools/build-pages.mjs` twice leaves `git status` unchanged.

---

## 9. Acceptance criteria
- [ ] Wheel spins visibly with OS reduced motion on (≈1.8 s, 2 turns) and with it off (4.4 s). It is instant only when Settings → Animations is off. It uses WAAPI; no `transitionend` or inline `transition` remains in wheel.js or coin.js.
- [ ] Coin flip and dice roll follow the same three levels (§2.3). Decorative motion (sheets, reveals, press, arc, wobble, lots flip) is off under reduced motion.
- [ ] The Settings Animations hint explains the override and reflects the OS setting live.
- [ ] No page has `#below`, an article, FAQ, "All tools", "More random tools" or a footer visible. Home shows no "Tools/More tools" split.
- [ ] Every tool screen, the List editor, `#/lists` and Home have a "?" at the top right that opens concise help with a Privacy (· tip) foot. Sound lives in the ⋮ menu.
- [ ] On each landing page's entry route, "?" opens the static `#help` dialog containing that page's h1, intro, FAQ and the crawlable other-tools links. JSON-LD, titles, meta, canonical and sitemap are unchanged.
- [ ] NOSCROLL passes on every route, every landing page and privacy, at 320×568, 360×640, 390×844 and 412×915, light and dark, in the default state, after a result and with the preset bar shown.
- [ ] Long content (teams, shuffle, lottery lines, cards, list items, 100 numbers, Saved, search results, help, editor textarea) scrolls only inside its own region, sheet or overlay.
- [ ] 30 lots and 12 dice fit at 320×568 with no scroll and tiles ≥ 40 px.
- [ ] The Home tile grid (5×2) and the Saved region grouped by tool; the List tile opens `#/lists`.
- [ ] Ads: off with the empty config (no markup). With the sample config, a 320×50 dock on Home only, loaded only after an interaction while Home is shown, CLS 0, and `?noads=1` honoured.
- [ ] SW precache includes the new modules; offline works; the build is idempotent; all unit tests pass.
