# Random — PWA Specification (v1)

A mobile-first, offline-capable random generator PWA. Five tools: **Number, List, Dice, Cast lots, Coin**, plus Settings. Vanilla HTML/CSS/JS with ES modules, **no dependencies, no build step**. Visual reference: the Android app "Random Number Generator" (UXAPPS): Material 3 look, dark teal/charcoal surfaces, a cyan accent, big rounded cards, and a result shown in a big colored square that pops in.

Dev server: `python3 -m http.server 8000` from the project root, then open `http://localhost:8000/`. Service workers only register on `localhost` or HTTPS. A LAN IP over plain http gets no SW, and that is expected.

---

## 1. File tree

```
index.html                 App shell: meta tags, manifest/icon links, <main id="app">, toast + live region, loads js/app.js as module
manifest.webmanifest       PWA manifest
sw.js                      Service worker: versioned precache, cache-first, navigation fallback to index.html
css/app.css                All styles: theme tokens, layout, components, animations, motion-off rules
js/app.js                  Bootstrap: load state, apply theme/motion, router, SW registration, global keyboard handling
js/router.js               Hash router: parse route, mount screen, call cleanup, back navigation helper
js/store.js                State: defaults, load/normalize/migrate, save, subscribe, history helpers, clearAll
js/rng.js                  Pure RNG functions (no DOM). Importable from node for tests
js/feedback.js             WebAudio synthesized sounds + navigator.vibrate haptics, honoring settings
js/ui.js                   DOM helper h(), icons map, topBar, FAB, result overlay, bottom sheet, popover menu, confirm dialog, toast, stepper, switch, copy-to-clipboard
js/screens/home.js         Home screen (tool cards, saved lists)
js/screens/number.js       Number tool
js/screens/list.js         List tool (use a saved list)
js/screens/list-edit.js    Create/edit list (name + one item per line)
js/screens/dice.js         Dice tool
js/screens/coin.js         Coin tool
js/screens/lots.js         Cast lots tool
js/screens/settings.js     Settings screen
js/screens/history.js      openHistorySheet(key, title): shared history bottom sheet (not a route)
icons/icon.svg             Vector app icon, also used as favicon (hand-written, same geometry as the PNGs)
icons/icon-192.png         Generated
icons/icon-512.png         Generated
icons/icon-maskable-512.png Generated (full-bleed, glyph inside the safe zone)
icons/apple-touch-icon.png Generated 180×180 (full-bleed, no transparency)
tools/make-icons.mjs       Node script, zero deps: rasterizes the icon and writes the PNGs with zlib
tests/rng.test.mjs         node:assert tests for js/rng.js and store normalize()
```

Commit the generated PNGs. `tools/` and `tests/` are **not** precached.

Each screen module exports `render(root, params) => cleanup | undefined`. `root` is an emptied `<main id="app">`. Cleanup removes global listeners and timers.

---

## 2. Routing & navigation

Hash routes:

| Hash | Screen |
|---|---|
| `#/` or empty | Home |
| `#/number` | Number |
| `#/list/new` | List editor, new list |
| `#/list/:id` | List tool |
| `#/list/:id/edit` | List editor, existing list |
| `#/dice` | Dice |
| `#/coin` | Coin |
| `#/lots` | Cast lots |
| `#/settings` | Settings |

- An unknown route calls `location.replace('#/')`. An unknown list id shows the toast "List not found" and then does `location.replace('#/')`.
- On `hashchange`, the router closes any open overlay, sheet or menu, runs the previous cleanup, clears `root`, renders the new screen, scrolls to the top, and moves focus to the screen's `<h1>` (which has `tabindex="-1"`).
- **Back button** (top-left arrow on every non-home screen): the router keeps an in-memory `navDepth`. Every in-app hash change made by user navigation increments it. Back calls `history.back()` when `navDepth > 0` (and decrements it), and otherwise calls `location.replace('#/')`. This way the Android system back gesture and the in-app back button behave the same, and a deep link never leaves the app on back.
- After saving a new list, navigate with `location.replace('#/list/<id>')` so back goes to Home and not to the empty editor.

---

## 3. Screens

### Common chrome
- **Top bar** (`ui.topBar`): height 56px plus `env(safe-area-inset-top)` padding. It has the back button, an `<h1>` title, and right-aligned action icon buttons. Tool screens have these actions, in order: **History** (clock icon), **Sound toggle** (volume on/off icon, `aria-pressed`, toggles the global `settings.sound`), and on List only **⋮** (menu).
- **FAB** (`ui.fab`): a 64×64 rounded square (radius 18px) in the primary color, with the cycle/refresh icon and `aria-label="Generate"` (or "Roll", "Flip", "New round"). It sits bottom-right at `right: max(16px, env(safe-area-inset-right)+16px)` and `bottom: env(safe-area-inset-bottom)+24px`. Its z-index is **above** the result overlay, so it stays tappable while a result is shown. Content has bottom padding so the FAB never covers controls.
- **Parameters pill**: a centered outlined pill button labeled "Parameters" (with a tune icon). It opens a bottom sheet.
- **No repeat card** (Number and List): a rounded surface card that is one row, laid out as `[switch] No repeat ........ 3 / 10 [⋮]`.
  - The switch has `role="switch"` and `aria-checked`, and the whole label area toggles it.
  - The counter is `drawn / total` and uses `tabular-nums`. When the switch is off, the counter shows "Off" in the muted color.
  - The ⋮ popover menu has one item, **Reset pool** (it clears drawn values and shows the toast "Pool reset"). It is disabled when the switch is off or when nothing has been drawn.
- Content column: `max-width: 560px`, centered, 16px side padding. There is no horizontal scroll at 320px width.

### 3.1 Home (`#/`)
- The top bar is titled "Random" (no back button) with a settings gear on the right, which links to `#/settings`.
- A vertical stack of large cards (min-height 88px, radius 24px, 12px gap), in this order: **NUMBER, LIST, DICE, CAST LOTS, COIN**. Each card has:
  - An outlined icon on the left in a 40px primary-tinted circle.
  - An uppercase label with letter-spacing .08em, weight 600.
  - A large faded watermark icon on the right: about 96px, opacity 0.08, clipped by the card's `overflow:hidden`, `aria-hidden`.
  - The whole card is an `<a href="#/number">` or similar.
- **The LIST card is different.** Its header row holds the label plus a round "+" icon button (`aria-label="New list"`, links to `#/list/new`). Below the header, each saved list is a row inside the card (divider between rows, min-height 48px) showing the list name (ellipsized), a muted "N items" count, and a ⋮ button. The row itself links to `#/list/:id`. The row's ⋮ menu has **Edit** (goes to `#/list/:id/edit`) and **Delete** (a confirm dialog: "Delete list "<name>"?" with Delete/Cancel buttons; on confirm, remove the list and its history). If no lists exist, the card shows a muted row, "No lists yet — tap + to create one".
- Tapping the ⋮ button must not trigger row navigation (`stopPropagation`/`preventDefault`).

### 3.2 Number (`#/number`)
- In the center are the **FROM** label (small, uppercase, muted) and a big editable value (font-size `clamp(48px, 16vw, 88px)`, weight 300), then **TO** with the same styling. The inputs are `<input type="number" step="1">` with spinners hidden via CSS and centered text. They have `aria-label="From"` and `aria-label="To"`.
  - On `change`/`blur`, parse with `Number()`, then `Math.trunc`. If the result is not finite or is outside **[-1,000,000,000, 1,000,000,000]**, revert to the last valid value and show the toast "Enter a whole number between -1e9 and 1e9".
  - Enter inside an input blurs it and does not generate.
  - Changing either bound to a new value resets the no-repeat pool (`drawn = []`).
  - `from > to` is allowed while editing. At generate time the values are swapped, persisted, and reflected in the inputs.
- Next comes the **No repeat card** (total = `to - from + 1`), then the **Parameters** pill.
- **Parameters sheet**:
  - **How many numbers**: a stepper from 1 to 100, default 1.
  - **Sort results**: a switch, default off. When on, results are sorted ascending.
  - **Allow duplicates**: a switch, default off. It only matters when count > 1 and No repeat is off. When No repeat is on, it is disabled with the hint "Not available with No repeat".
  - Changes save immediately. A "Done" button closes the sheet.
- **Generate** runs from the FAB, from Space/Enter, or from a tap on the overlay card. The algorithm is in §5.2. Show the result in the **result overlay** (§3.8), play the click sound, vibrate, update the counter, and add a history entry with the text of the numbers joined by ", " (e.g. `7` or `3, 8, 12`).
- **No repeat** can be turned on only when `total <= 100000`. Otherwise the switch stays off with the toast "No repeat supports ranges up to 100,000 numbers".

### 3.3 List (`#/list/:id`)
- The title is the list name. The top bar also has a ⋮ menu with **Edit list** (goes to `/edit`) and **Delete list** (confirm, then `location.replace('#/')`).
- The body shows the items as centered rows (min-height 48px) with 1px dividers. Rendering uses `textContent` only.
  - When No repeat is on, drawn items are shown dimmed (opacity .4) with strikethrough.
  - Items picked by the last pick get the class `.picked` (primary color, weight 600) until the next pick.
  - Long lists scroll. The No repeat card and the Parameters pill come **after** the list, and the FAB stays fixed.
- If the list is empty, show the muted text "This list is empty" and an "Edit list" button. The FAB is disabled (`aria-disabled="true"`, dimmed), and generate is a no-op that shows the toast "Add items first".
- **Parameters sheet**: **How many to pick** is a stepper from 1 to `min(20, items.length)` (min 1). Picks within one batch are always distinct indices.
- **Generate**: the algorithm is in §5.3. The overlay shows the picked items, one per line. History text is the items joined by ", ".
- Duplicate item texts are allowed and treated as separate entries, identified by index.

### 3.4 List editor (`#/list/new`, `#/list/:id/edit`)
- The title is "New list" or "Edit list". Fields:
  - **Name**: a text input, maxlength 60, autofocus on a new list.
  - **Items**: a `<textarea>` with rows 10, placeholder "One item per line", `autocapitalize="sentences"`. Below it a live muted counter, "N items".
- The bottom action row has **Cancel** (back) and **Save** (a primary filled button).
- Save does the following:
  - Split on `\n`, trim each line, drop empty lines, and truncate each item to 200 chars. Max 500 items (silently truncate).
  - An empty name defaults to "Untitled list". The name is trimmed.
  - A new list gets `id = crypto.randomUUID?.() ?? Date.now().toString(36) + random suffix` and `noRepeat: false, drawn: [], pickCount: 1`.
  - Editing sets `drawn = []` **only if the item array changed**, and clamps `pickCount`.
- Rename is part of the editor. No separate rename flow.

### 3.5 Dice (`#/dice`)
- The center area is a flex-wrap, centered group of dice. Each die is a rounded square (radius 22%) filled with a palette color by die index (§6), with white pips drawn by a 3×3 CSS grid of `<span class="pip">` elements shown per face:

  | Face | Pips at cells (row-major 0–8) |
  |---|---|
  | 1 | 4 |
  | 2 | 0, 8 |
  | 3 | 0, 4, 8 |
  | 4 | 0, 2, 6, 8 |
  | 5 | 0, 2, 4, 6, 8 |
  | 6 | 0, 2, 3, 5, 6, 8 |

- Die size is 112px for 1–2 dice, 96px for 3–4, and 80px for 5–6.
- Each die has `role="img"` with `aria-label="Die showing 4"`.
- Below the dice sits a **Total: N** line (only when count > 1), then a **stepper** "− 3 dice +" (range 1–6, default 2, persisted). Changing the count re-renders the dice showing 1s until the next roll. Values persist.
- **Roll** runs from the FAB, Space/Enter, or a tap on the dice area. For each die, `randInt(1,6)`. Animation when motion is on: 500ms during which each die gets a `.rolling` wobble keyframe and shows random faces every 70ms, then settles on the final values. During the roll play 4 click sounds 70ms apart, and vibrate 20ms at the end. There is no overlay. History text is `"3 + 5 + 1 = 9"`, or `"4"` for one die.
- The final result is announced in the live region: "Rolled 3, 5, 1. Total 9".

### 3.6 Coin (`#/coin`)
- A 200px (`min(56vw, 240px)`) circle coin with two faces made with `backface-visibility: hidden`:
  - Front is **HEADS**: primary color, with a large "H" and the label.
  - Back is **TAILS**: `rotateY(180deg)`, secondary amber `#FFB300` with dark text, with a large "T" and the label.
- Below the coin: the last result text "Heads" or "Tails" (`aria-live`), and a tally row: "Heads 4 · Tails 6" (persisted).
- The ⋮ menu is not in the top bar. Instead, a small text button "Reset tally" under the tally row (confirm not needed).
- **Flip** runs from the FAB, Space/Enter, or a tap on the coin. `result = randInt(0,1) ? 'tails' : 'heads'`.
  - Animation when motion is on: keep a cumulative rotation `rot`. Set `rot += 1800 + (target face differs from current ? 180 : 0)` rounded so the end is `0 mod 360` for heads and `180 mod 360` for tails. Transition `transform 900ms cubic-bezier(.2,.7,.2,1)`, plus a small translateY arc keyframe. Update the tally and text on `transitionend`, or after a 950ms timeout fallback.
  - When motion is off, apply the final state instantly.
  - Ignore flip input while a flip is in progress.
  - Sound is the "ting" (§7). Vibrate 20ms. History text: "Heads" or "Tails".

### 3.7 Cast lots (`#/lots`)
- Concept: N face-down lots, K of them are winners, and the user taps lots to reveal them.
- **Parameters sheet**:
  - **Number of lots**: a stepper from 2 to 30, default 6.
  - **Winning lots**: a stepper from 1 to N−1, default 1. It is re-clamped when N changes.
  - Changing either one starts a new round.
- **Grid**: CSS grid with `repeat(auto-fill, minmax(72px, 1fr))` and 10px gap. Each lot is a `<button>` (aspect-ratio 3/4, radius 14px) numbered 1..N. It has two faces with a flip (rotateY 180°, 400ms):
  - **Hidden**: surface-variant background with a big "?".
  - **Winner**: primary background with a star icon and "WIN".
  - **Blank**: muted outline with "—".
  - `aria-label` is "Lot 3, hidden", "Lot 3, winner", or "Lot 3, blank".
- New round: `winners = sampleDistinct(0, N-1, K)` stored as a Set. All lots start hidden.
- Tapping a hidden lot reveals it: click sound. A winner gets vibrate `[30,40,30]`, a blank gets vibrate 15. A revealed lot is `disabled`.
- Status line (`aria-live`): "Revealed 3 / 8 · Winners found 1 / 2". When all winners are found, append " · All winners found" (text only, no auto-action).
- The FAB (`aria-label="New round"`, cycle icon) and Space/Enter start a new round. With motion on, lots flip back face-down (300ms) before being reassigned.
- History: each reveal adds "Lot 3: winner" or "Lot 3: blank".
- Round state (winners, revealed) is **in-memory only**. N and K persist.

### 3.8 Result overlay (Number & List)
- A fixed full-screen backdrop, `rgba(0,0,0,.55)`, fading in over 150ms. It is `role="dialog"` with `aria-modal="true"` and `aria-label="Result"`.
- The centered **result card** is `width: min(72vw, 360px)`, `aspect-ratio: 1`, `border-radius: 28px`, with the background set to a random palette color (§6) that is never the same as the previous one. It uses white text and `tabular-nums`.
  - **Pop-in**: `scale(.6)` to `scale(1)` over 260ms `cubic-bezier(.34,1.56,.64,1)`, with opacity 0 to 1.
  - **Font sizing** by content: one short value (≤ 4 chars) uses `clamp(64px, 22vw, 140px)`. Otherwise shrink by total text length: ≤ 12 chars 48px, ≤ 40 chars 32px, else 22px. Multi-value results are shown as a centered flex-wrap of values with a 0.5em gap. List picks are one per line. The card scrolls internally (`overflow:auto`) if needed. Use `overflow-wrap: anywhere`.
- Below the card: a small "Copy" icon button, which copies the result text and shows the toast "Copied".
- Interactions:
  - **Tap on the card**, the FAB, or Space/Enter generates again. The overlay stays open, and the card re-pops with a new color.
  - **Tap on the backdrop** or Escape dismisses it.
  - Android back while it is open is not intercepted; the route stays the same because no history entry is pushed.
- Focus moves to the card (`tabindex="0"`) on open and returns to the FAB on close.
- The result text is also written to the global `aria-live="polite"` region.
- When motion is off, the overlay appears without animation.

### 3.9 History sheet (`openHistorySheet(key, title)`)
- A bottom sheet (§4) titled "History". It shows up to 20 entries, newest first. Each row shows the entry text (ellipsized to 2 lines) and a muted time (`HH:MM:SS`, local). Tapping a row copies its text and shows the toast "Copied".
- Footer buttons: **Copy all** (all texts joined by `\n`, newest first) and **Clear** (clears this key; no confirm).
- The empty state is "No results yet".
- History keys: `number`, `list:<id>`, `dice`, `coin`, `lots`.

### 3.10 Settings (`#/settings`)
- **Theme**: a segmented control with System / Light / Dark (radio group semantics). It applies immediately.
- **Sound**: a switch, default on.
- **Vibration**: a switch, default on. If `!('vibrate' in navigator)`, the switch is still shown with the hint "Not supported on this device".
- **Animations**: a switch, default on. Hint: "Also off when your system asks to reduce motion".
- **Clear all data**: a danger text button. It opens a confirm ("Delete all lists, history and settings?"), then removes the storage key and calls `location.reload()`. It does not touch the SW cache.
- Footer: muted "Random v1.0.0". The version constant lives in `js/app.js`.

---

## 4. Shared UI components (`js/ui.js`)

- `h(tag, props, ...children)`: creates an element. `props` supports `class`, `attrs`, `on: {event: fn}`, `text`, and `style`. String children become text nodes. **User-provided text must never go through `innerHTML`.** The only `innerHTML` use allowed is for static icon SVG strings from the `icons` map.
- `icons`: an object of 24×24 inline SVG strings (stroke `currentColor`, stroke-width 2, fill none unless it is a filled glyph). Required icons: `back, settings, refresh (two circular arrows), volumeOn, volumeOff, more (vertical dots), plus, history (clock with arrow), tune, number ("123" or hash), list, dice, lots (ticket), coin, close, copy, trash, edit, star, minus`. Hand-drawn simple paths are fine.
- **Bottom sheet**: built on a native `<dialog>` opened with `showModal()`, which gives Escape, inert background, and focus handling.
  - It is anchored to the bottom, full width up to 560px, with top radius 24px, a drag-handle visual, and padding-bottom `env(safe-area-inset-bottom)+16px`.
  - A backdrop click closes it (check whether `event.target === dialog`).
  - When motion is on it slides up over 200ms.
- **Popover menu**: an absolutely positioned `<div role="menu">` anchored under the trigger button and kept within the viewport. Items are `role="menuitem"` buttons. It closes on outside pointerdown, Escape, item activation, or route change. Only one menu is open at a time.
- **Confirm dialog**: a centered `<dialog>` with a message and Cancel / confirm buttons. It returns a `Promise<boolean>`. A destructive confirm button uses the danger color.
- **Toast**: a single element fixed bottom-center above the FAB (`bottom: env(safe-area-inset-bottom)+104px`), `role="status"`, lasting 2500ms. A new toast replaces the current one.
- **Live region**: a visually hidden `<div id="live" aria-live="polite">` in `index.html`. `ui.announce(text)` clears it and then sets it on the next frame.
- **Stepper**: the pattern `[−] value [+]`. Buttons are 44×44 with `aria-label` "Decrease …" / "Increase …". The value is `aria-live="polite"`. Buttons are disabled at the bounds.
- **Switch**: `<button role="switch" aria-checked>` with a visual track and thumb, sized 52×32. The whole row is clickable.
- `copyText(text)`: use `navigator.clipboard.writeText` when available. Otherwise fall back to a hidden textarea plus `document.execCommand('copy')`. Toast "Copied" on success, or "Copy failed" otherwise.

---

## 5. State & algorithms

### 5.1 Persistence (`js/store.js`)
- Everything is stored in **one localStorage key**, `random:state`, as JSON:

```js
const DEFAULTS = {
  version: 1,
  settings: { theme: 'system', sound: true, vibration: true, animations: true },
  number:   { from: 1, to: 10, noRepeat: false, drawn: [], count: 1, sort: false, allowDupes: false },
  lists:    [ { id: 'default-answer', name: 'Random answer',
                items: ['Yes', 'No', 'Maybe', 'Ask again later'],
                noRepeat: false, drawn: [], pickCount: 1 } ],   // drawn = item indices
  dice:     { count: 2, values: [1, 1] },
  coin:     { heads: 0, tails: 0, last: null },                // last: 'heads'|'tails'|null
  lots:     { n: 6, k: 1 },
  history:  {}   // { [key]: [{ t: epochMs, text: string }] } newest first, max 20
};
```

- `load()` works like this:
  1. `try { raw = JSON.parse(localStorage.getItem(KEY)) } catch { raw = null }`. localStorage access is also wrapped in try/catch, because private mode or a storage failure must fall back to in-memory defaults.
  2. `normalize(raw)` is **pure and exported** so tests can call it. It starts from `structuredClone(DEFAULTS)`, overlays each known section field by field when the type matches, clamps numeric fields to their valid ranges, filters `drawn` to valid unique values in range, drops malformed lists and history entries, and trims history to 20. If `raw.version` is missing or less than the current version, run the `MIGRATIONS[v]` functions in order (there are none for v1, but the array exists). An unknown future version falls back to defaults.
  3. The `lists` array stays as saved (it can be empty). Only a *missing* `lists` key seeds the default list.
- `save()`: `localStorage.setItem(KEY, JSON.stringify(state))` inside try/catch (on failure, toast "Storage full — data not saved" once). It is called right after each mutation. Mutations are small, so no debouncing is needed.
- Helpers: `getState()`, `update(fn)` (mutates, then saves, then notifies subscribers), `subscribe(fn)`, `addHistory(key, text)` (unshift, then slice to 20), `clearHistory(key)`, `deleteList(id)` (also deletes `history['list:'+id]`), `clearAll()`.

### 5.2 RNG (`js/rng.js`, pure, no DOM)
- The source is `crypto.getRandomValues` only. **Never use `Math.random`.** (`globalThis.crypto` exists in Node 19+ so tests work.)

```js
export function randUint32() { return crypto.getRandomValues(new Uint32Array(1))[0]; }

// Unbiased inclusive integer in [min, max]; requires max - min + 1 <= 2**32.
export function randInt(min, max) {
  const range = max - min + 1;
  if (range === 1) return min;
  const limit = Math.floor(2 ** 32 / range) * range;   // largest multiple of range
  let r;
  do { r = randUint32(); } while (r >= limit);           // rejection sampling
  return min + (r % range);
}
```

- The bounds `±1e9` guarantee range ≤ 2,000,000,001 < 2³², so this is safe.
- `shuffle(arr)`: in-place Fisher–Yates using `randInt(0, i)`.
- `sampleDistinct(min, max, k, exclude = new Set())`: returns `k` distinct integers in `[min,max]` that are not in `exclude`, in draw order. Let `available = size - |exclude ∩ range|`. If `k > available`, throw a `RangeError`; callers cap first.
  - If `|exclude| + k <= size / 2`: rejection-sample with a Set.
  - Otherwise, enumerate the candidates (safe, because this branch implies `size <= 2 * (|exclude| + k)` and both are bounded, at most about 200,200), then take the first `k` of a partial Fisher–Yates.
- `sampleWithReplacement(min, max, k)`: `k` independent `randInt` calls.

**Number generate** (`count` = parameter, `size = to - from + 1`):
- No repeat **on**:
  - `remaining = size - drawn.length`.
  - If `remaining === 0`: reset `drawn = []`, show the toast "All numbers drawn — pool reset", and continue.
  - `k = min(count, remaining)`. If `k < count`, show the toast "Only k left in pool".
  - `res = sampleDistinct(from, to, k, new Set(drawn))`, then `drawn.push(...res)`.
- No repeat **off**:
  - If `allowDupes`: `res = sampleWithReplacement(from, to, count)`.
  - Otherwise: `k = min(count, size)` and `res = sampleDistinct(from, to, k)`. If capped, show the toast "Range has only size numbers".
- If `sort`, sort `res` ascending (numeric compare).

**List generate** (`n = items.length`, indices `0..n-1`) follows the same logic, with `from=0, to=n-1`, `count=pickCount`, `allowDupes=false`, and `drawn` holding indices. Toasts: "All items drawn — pool reset" and "Only k left in pool". Results keep draw order (no sort).

### 5.3 Edge cases (must handle)
- `from === to` always yields that value. With No repeat on, the pool is `0/1` then `1/1`, and the next generate auto-resets.
- `from > to`: swap at generate time (§3.2).
- Empty or non-numeric input: revert to the last valid value.
- A huge range (e.g. -1e9..1e9) works for non-repeat-mode generation. No repeat is refused when size > 100,000.
- An empty list disables generation. A list shrunk by editing resets `drawn`.
- Corrupt or foreign JSON in storage: fall back to defaults and never throw on boot.
- Rapid repeated generate taps are fine: each tap produces a new result synchronously, and animations restart. Coin ignores taps while it is flipping.

---

## 6. Visual design

**Theme tokens** are CSS custom properties on `:root`, selected by `html[data-theme="dark"|"light"]`. JS resolves `system` through `matchMedia('(prefers-color-scheme: dark)')` and listens for changes.

| Token | Dark | Light |
|---|---|---|
| `--bg` | `#0F1416` | `#F3F8F9` |
| `--surface` (cards) | `#1A2327` | `#FFFFFF` |
| `--surface-2` (chips, hidden lots, inputs) | `#243136` | `#E2EFF1` |
| `--primary` | `#4DD0E1` | `#00838F` |
| `--on-primary` | `#00363D` | `#FFFFFF` |
| `--text` | `#E1E8EA` | `#131B1D` |
| `--muted` | `#93A3A8` | `#5A6B70` |
| `--divider` | `#2C3A40` | `#D5E3E6` |
| `--danger` | `#FF8A80` | `#C62828` |

- **Result/dice palette**: vivid colors that keep white text at ≥ 3:1 contrast (large text): `['#7B1FA2', '#C2185B', '#D32F2F', '#E64A19', '#00796B', '#388E3C', '#1976D2', '#303F9F', '#6A4FB6', '#0097A7']`. Dice use `palette[(i*3) % 10]` so neighbors differ.
- **Font**: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Numbers use `font-variant-numeric: tabular-nums`.
- **Update `<meta name="theme-color">`** to `--bg` of the resolved theme whenever the theme changes.
- **Mobile rules**:
  - `html, body { height: 100% }` and the app uses `min-height: 100dvh`.
  - `-webkit-tap-highlight-color: transparent`.
  - `button, a, [role=switch] { touch-action: manipulation }`.
  - Every interactive target is ≥ 44×44px.
  - Controls get `user-select: none`, but list items in the list screen and history rows stay selectable.
  - Visible `:focus-visible` rings (2px primary outline, offset 2px).
  - `overscroll-behavior-y: none` on body.
  - Safe-area insets are applied to the top bar, the FAB, the sheets, and the toast.
- **Motion**: `app.js` sets `html[data-motion="off"]` when `!settings.animations` or when `matchMedia('(prefers-reduced-motion: reduce)').matches` (and it listens for changes). CSS under `[data-motion="off"]` sets `animation: none !important; transition: none !important`. JS checks `motionOn()` to skip the timed sequences (dice flicker, coin wait, lots flip-back).

---

## 7. Feedback (`js/feedback.js`)

- **Audio**: create one lazy `AudioContext` on the first call. Call `ctx.resume()` if it is suspended, which is allowed because every call comes from a user gesture. Every function is a no-op when `!settings.sound` or when AudioContext is unavailable. Wrap it all in try/catch.
  - `click()`: triangle oscillator, frequency 1400 falling to 500 Hz (exponentialRamp) over 45ms. Gain 0.18 falling to 0.0001 over 60ms. Stop at +70ms.
  - `ting()`: sine at 1760 Hz plus a second sine at 2640 Hz (gain ×0.4). Gain 0.15 falling to 0.0001 over 350ms.
  - `rollClicks(n=4, gap=70)`: schedule `n` clicks at `ctx.currentTime + i*gap/1000` with slight random pitch (from `randInt`, ±10%).
- **Haptics**: `vibrate(pattern)` calls `navigator.vibrate?.(pattern)` only when `settings.vibration` is on. Wrap it in try/catch. iOS has no vibrate, which is fine.
- Mapping:
  - Number/List generate: `click()` + `vibrate(15)`.
  - Dice: `rollClicks()` + `vibrate(20)` at settle.
  - Coin: `ting()` at land + `vibrate(20)`.
  - Lots reveal: `click()`, then `vibrate([30,40,30])` for a winner or `vibrate(15)` for a blank.

---

## 8. Keyboard (desktop)

The handler is global in `app.js` on `keydown`:
- **Space / Enter**: when the current screen registered a primary action and the event target is not an `input`, `textarea`, `select`, `button`, `a`, or `[role=switch]`, and no sheet or menu is open, call `preventDefault()` and run the primary action. The overlay card counts as a valid target; Enter or Space on it generates again. Screens register their action with `setPrimaryAction(fn)`, which is cleared on route change.
- **Escape**: closes the popover menu, else the result overlay. Sheets and dialogs close themselves natively.
- Ignore key repeat (`e.repeat`).

---

## 9. PWA

### 9.1 `index.html` head (required)
```html
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Random</title>
<meta name="description" content="Random number, list, dice, coin and lots generator">
<meta name="theme-color" content="#0F1416">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="icon" href="icons/icon-192.png" sizes="192x192" type="image/png">
<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Random">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="stylesheet" href="css/app.css">
<script type="module" src="js/app.js"></script>
```
- Do not disable user zoom.
- **All URLs are relative** (no leading `/`) so the app works from a subdirectory such as GitHub Pages.
- To avoid a flash of the wrong theme, a tiny inline `<script>` in the head reads `random:state` in a try block and sets `data-theme` before the CSS paints. This is the only inline script.

### 9.2 `manifest.webmanifest`
```json
{
  "name": "Random",
  "short_name": "Random",
  "description": "Random number, list, dice, coin and lots generator",
  "id": "./",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0F1416",
  "theme_color": "#0F1416",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```
`python3 -m http.server` serves `.webmanifest` as `application/manifest+json` on recent Python versions. Chrome accepts it either way.

### 9.3 Service worker (`sw.js`)
- `const CACHE = 'random-v1';` **Bump this string whenever any precached file changes.** That is the whole versioning strategy.
- `PRECACHE` is an explicit array of every shipped file: `'./'`, `'./index.html'`, `'./manifest.webmanifest'`, `'./css/app.css'`, every `./js/**/*.js`, and every file in `./icons/`.
- **install**: `caches.open(CACHE).then(c => c.addAll(PRECACHE))`, then `self.skipWaiting()`.
- **activate**: delete every cache whose name is not `CACHE`, then `self.clients.claim()`.
- **fetch**: only handle `GET` requests to the same origin.
  - For `request.mode === 'navigate'`, respond with `caches.match('./index.html')`, falling back to `fetch(request)`.
  - For everything else, cache-first: `caches.match(request, { ignoreSearch: true })` or `fetch(request)`. Do not cache runtime responses (everything is precached).
- Registration in `app.js`: `if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));`. There is no update prompt. A new version activates immediately and is used on the next load.

### 9.4 Icons (`tools/make-icons.mjs`, zero dependencies)
- Run with `node tools/make-icons.mjs` from the root. It writes the four PNGs into `icons/`.
- **Geometry**, defined in a 512×512 design space with y pointing down and angles in degrees measured clockwise from +x:
  - **Background**: color `#00ACC1`.
    - `any` icons: rounded rect covering the full 0..512 with corner radius 112, and transparent outside.
    - `maskable` and `apple-touch`: a full-bleed square, no transparency.
  - **Glyph** (white `#FFFFFF`): two arcs of a ring centered at (256,256), radius R=120, stroke width 36 (inner radius 102, outer 138):
    - Arc A spans angles 200°→330°.
    - Arc B spans 20°→150°.
    - Each arc ends in an arrowhead at its clockwise end (330° and 150°). The arrowhead is a triangle with its base centered on the ring at that angle, oriented radially, base width 92 (from radius 74 to 166). Its apex is 64 units ahead along the clockwise tangent direction, i.e. `P(θ) + 64·(−sin θ, cos θ)` where `P(θ) = (256 + R cos θ, 256 + R sin θ)`.
  - Maskable and apple-touch scale the glyph by 0.8 about the center so it fits the 40%-radius safe zone.
- **Rasterize** at the target size by mapping each pixel to design space (`scale = 512/size`), using a 4×4 supersample per pixel for anti-aliasing.
  - Coverage tests: rounded rect via corner-circle test; ring via `102 ≤ dist ≤ 138` plus an angle-in-span test (normalize to [0,360)); triangle via the three edge sign tests.
  - Composite white glyph over the background. Alpha is the background coverage.
- **PNG encoding**: 8-bit RGBA (color type 6). Each scanline is prefixed with filter byte 0. The data is `zlib.deflateSync`. Chunks are `IHDR`, `IDAT`, and `IEND`, each with a CRC-32 (use `zlib.crc32` if it exists, otherwise a 256-entry table implementation). Include the PNG signature `89 50 4E 47 0D 0A 1A 0A`.
- **Outputs**:
  - `icon-192.png` (any)
  - `icon-512.png` (any)
  - `icon-maskable-512.png` (maskable)
  - `apple-touch-icon.png` (180, full-bleed)
- **`icons/icon.svg`**: written by hand with the same geometry, using a `<rect rx="112">`, two `<path>` arcs with `stroke-width="36"` and `fill="none"`, and two `<polygon>` arrowheads. It is used as the favicon.

---

## 10. Tests (`tests/rng.test.mjs`, run `node tests/rng.test.mjs`)
- `randInt(a,b)` stays within bounds over 100k draws for (1,10), (-5,5), (0,0), and (-1e9,1e9).
- Distribution sanity: 60k draws of `randInt(1,6)`, where each face count is within ±5% of 10k.
- `sampleDistinct` returns distinct values and respects `exclude` in both branches (sparse: (1,1e6,10); dense: (1,10,8, exclude {1,2})). Throws when `k > available`.
- Draw an entire no-repeat pool of size 10 one at a time. The result must be a permutation of 1..10.
- `normalize(null)` deep-equals DEFAULTS. `normalize({garbage})` does not throw. Out-of-range `from` is clamped. `drawn` values out of range are filtered.

---

## 11. Deliberately left out
Decimal/float ranges; weighted list items; list import/export and sharing; cloud sync; i18n (English only); SW update prompt; persisting the cast-lots round across reloads; custom sounds or audio files; landscape-specific layouts; a separate rename dialog (it is part of the editor); history for more than 20 entries per tool.

---

## 12. Acceptance criteria

**Boot & PWA**
- [ ] `python3 -m http.server` from the root, then `http://localhost:8000/` loads Home with no console errors, in both Chrome and Firefox.
- [ ] Every path in `sw.js` `PRECACHE` returns 200 (checked with curl).
- [ ] The manifest is valid (name, short_name, start_url, scope, display standalone, theme/background colors, 192 + 512 `any` icons, a 512 `maskable` icon). The PNGs are real PNGs with the stated dimensions (`file icons/*.png`).
- [ ] After the first load, DevTools "Offline" plus reload still works on every route.
- [ ] The Chrome install prompt is available on Android. The iOS meta tags and apple-touch-icon are present.
- [ ] Changing `CACHE` and reloading twice removes the old cache.

**Navigation**
- [ ] Every route in §2 renders. Unknown routes go to Home. Back works from every screen, including on a deep link.
- [ ] Home shows the 5 cards in order, with the saved lists under LIST, "+" creating a list, and a row ⋮ offering Edit/Delete (with confirm).

**Number**
- [ ] The default range is 1–10. Generate shows the overlay with a random vivid color, a value within range, and pop-in animation.
- [ ] Tap card → new result and new color. Tap backdrop or Esc → close. The FAB works while the overlay is open.
- [ ] `from > to` is swapped on generate. Invalid input reverts. Values outside ±1e9 are rejected.
- [ ] No repeat on 1–10: 10 generates give 10 distinct values and the counter reads 10/10. The 11th generate resets with a toast. ⋮ → Reset pool sets the counter to 0/10.
- [ ] Changing from/to resets the pool. No repeat is refused for a range > 100,000.
- [ ] Parameters: count 5 shows 5 values. Sort orders them. With allow duplicates off, values are distinct. Count > remaining in no-repeat mode is capped with a toast.

**List**
- [ ] The default "Random answer" list exists on first run. You can create, edit (name and items), and delete a list, and all of it persists across reloads.
- [ ] Blank or whitespace lines are dropped. User text containing `<b>x</b>` or `<img src=x onerror=alert(1)>` renders literally.
- [ ] No repeat dims or strikes drawn items and the counter is correct. The pick count is limited to the item count. An empty list disables generation.

**Dice / Coin / Lots**
- [ ] Dice count 1–6 via the stepper, with correct pip layouts for 1–6, per-die colors, a total, and a roll animation. Everything persists.
- [ ] The coin flips with a 3D animation and lands on the face that matches the text. The tally persists, and Reset tally works.
- [ ] Lots: N and K from Parameters, exactly K winners per round, tap-to-reveal, a correct status line, and FAB = new round.

**QoL**
- [ ] History (last 20, newest first) works for number, each list, dice, coin, and lots. Tap a row to copy, and Copy all and Clear both work.
- [ ] The sound toggle in the top bar and the Settings switch stay in sync. Sounds are synthesized, and there are no audio files in the repo.
- [ ] Vibration fires on Android when enabled and never when disabled.
- [ ] Space/Enter triggers the primary action on each tool, and is not triggered while typing in inputs.
- [ ] The Theme setting (System/Light/Dark) applies instantly, persists, and has no wrong-theme flash on reload. Theme-color meta updates.
- [ ] Animations off (or OS reduce-motion) → no animations, and results appear instantly.
- [ ] Clear all data resets to defaults.

**Quality**
- [ ] No `Math.random` anywhere in `js/`. The RNG uses `crypto.getRandomValues` with rejection sampling.
- [ ] `node tests/rng.test.mjs` passes. `node --check` passes for every JS file.
- [ ] No horizontal scroll at 320px width. Touch targets are ≥ 44px. Safe-area insets are respected in standalone mode on a notched iPhone.
- [ ] Buttons with only an icon have an `aria-label`. Results are announced via the live region. Focus is visible.
- [ ] Corrupt `random:state` (e.g. `"{"`) does not break boot.
