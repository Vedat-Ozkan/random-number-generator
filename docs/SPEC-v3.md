# Random — v3 Specification (presets, more tools, search, premium redesign)

v3 is **additive** to `docs/SPEC.md` (v1) and `docs/SPEC-v2.md` (v2). Everything in them still applies unless this document says otherwise. Apply every change below as a **delta on top of the current file contents**. Reviewers have fixed things since the specs were written, so do not revert unrelated code.

v3 has five goals:
1. **Saved presets** for every configurable tool. They appear on Home as child rows under their tool.
2. **Five new tools** in a "More tools" section: Teams, Shuffle, Wheel, Lottery, Cards.
3. **More landing pages**: d4–d20, magic 8-ball, rock paper scissors, letter, month, weekday, number 1–6/1–50/1–1000, and one page per new tool.
4. **QoL**: weighted list items, dice notation with sides and a modifier, coin stats, share links, and import from the clipboard.
5. **Search** at the top of Home, plus a **premium minimalist visual redesign** of the whole app (§9). The redesign covers every v1/v2 screen as well as the new v3 screens.

Constraints carried over, all binding:
- Vanilla ES modules. No dependencies and no build step on the host. The zero-dep Node scripts run locally, and their output is committed.
- Randomness comes only from `crypto.getRandomValues` through `js/rng.js`. **No `Math.random`** anywhere in `js/`.
- **No `innerHTML` with user text.** The only `innerHTML` is still the static icon SVG in `ui.icon()`. Build SVG for the wheel with `document.createElementNS` and put its labels in with `textContent`.
- Generated HTML comes only from `tools/build-pages.mjs`. The SW PRECACHE and the cache hash are kept in sync by that build.
- Site config stays in `js/config.js`. Ads and tip-jar behaviour are unchanged.
- All URLs stay relative.

---

## 1. File tree (new = ★, changed = ✎, generated = ⚙)

```
★ js/tools.js               PURE (no DOM, no store): tool registry, config schemas + defaults, cleanConfig/extract/apply,
                            share params, preset summaries, BUILTIN_LISTS, search SHORTCUTS
★ js/parse.js               PURE: parseItems, parseWeighted, splitImport, parseDice, formatDice
★ js/search.js              PURE: normalize text, buildIndex(state), search(index, query)
★ js/presets.js             DOM: initTool(), toolChrome() (⋮ menu, preset bar), save/rename/delete flows, share()
★ js/screens/source.js      DOM: shared "items source" card (Paste | Saved list) for Teams/Shuffle/Wheel
★ js/screens/teams.js       Team / group splitter
★ js/screens/shuffle.js     Shuffle a list
★ js/screens/wheel.js       Spinner wheel (SVG)
★ js/screens/lottery.js     Lottery numbers
★ js/screens/cards.js       Card draw
★ tests/v3.test.mjs         Parsers, rng additions, tools registry, share params, search ranking, store migration
✎ js/store.js               VERSION 2 + migration, presets, new tool sections, dice sides/modifier, coin streaks, helpers
✎ js/rng.js                 drawWeighted, splitTeams, drawLottery; draw() gains resetNote
✎ js/router.js              hashQuery(), stripHashQuery(), remount()
✎ js/app.js                 VERSION 3.0.0, new routes, scrolled flag, theme-color fallback
✎ js/site.js                parsePreset/applyPreset accept tool presets (dice, lottery, …)
✎ js/ui.js                  1.5px icon set + new icons, promptDialog, segmented, chips, noRepeatCard options,
                            showResult caption/onShare (no random colors), labelled FAB, new PALETTE
✎ js/screens/home.js        Search, grouped lists, preset child rows, "More tools", Show all
✎ js/screens/number.js      Presets, share, render(root, params)
✎ js/screens/dice.js        Sides, modifier, notation, number faces, 1–12 dice, presets, share
✎ js/screens/lots.js        Presets, share
✎ js/screens/coin.js        Stats (%, streaks), share
✎ js/screens/list.js        Weighted items, builtin auto-create, share list
✎ js/screens/list-edit.js   Paste from clipboard, weight hint, prefill from link; parseItems moves to parse.js
✎ css/app.css               Rewritten token layer + component restyle (§9), v3 components
✎ tools/pages-data.mjs      19 new pages, groups, copy updates, list presets from BUILTIN_LISTS
✎ tools/build-pages.mjs     Grouped nav/tool list, new validations
✎ tools/make-icons.mjs      New brand colors / two-tone glyph (§9.9)
✎ tools/make-og.mjs         New brand colors (§9.9)
✎ icons/icon.svg            Matches the new icon
✎ sw.js                     New modules in PRECACHE (the build handles pages + hash)
✎ manifest.webmanifest      Colors, description, shortcuts
✎ tests/site.test.mjs       Page count from PAGES, new parsePreset shapes
✎ README.md                 Tool list line + test command
⚙ index.html, */index.html, sitemap.xml (when SITE_URL), robots.txt, icons/*.png, og.png, sw.js
```

Run `node tools/make-icons.mjs && node tools/make-og.mjs && node tools/build-pages.mjs` after implementing, and commit everything.

---

## 2. Data model

### 2.1 Tool registry (`js/tools.js`, pure)

`tools.js` imports only `./parse.js`. It must not touch `document`, `localStorage` or the store. The store, site.js, search.js, pages-data.mjs and the tests all import it.

```js
export const TOOLS = [            // Home order; section 'main' | 'more'
  { id: 'number',  label: 'Number',    icon: 'number',  route: '/number',  section: 'main', presets: true },
  { id: 'list',    label: 'List',      icon: 'list',    route: null,       section: 'main', presets: false },
  { id: 'dice',    label: 'Dice',      icon: 'dice',    route: '/dice',    section: 'main', presets: true },
  { id: 'lots',    label: 'Cast lots', icon: 'lots',    route: '/lots',    section: 'main', presets: true },
  { id: 'coin',    label: 'Coin',      icon: 'coin',    route: '/coin',    section: 'main', presets: false },
  { id: 'teams',   label: 'Teams',     icon: 'teams',   route: '/teams',   section: 'more', presets: true },
  { id: 'shuffle', label: 'Shuffle',   icon: 'shuffle', route: '/shuffle', section: 'more', presets: true },
  { id: 'wheel',   label: 'Wheel',     icon: 'wheel',   route: '/wheel',   section: 'more', presets: true },
  { id: 'lottery', label: 'Lottery',   icon: 'lottery', route: '/lottery', section: 'more', presets: true },
  { id: 'cards',   label: 'Cards',     icon: 'cards',   route: '/cards',   section: 'more', presets: true },
];
export const CONFIG_TOOLS = TOOLS.filter((t) => t.presets).map((t) => t.id);
```

**Coin has no presets.** It has no settings, so there is nothing meaningful to save. **List has no presets**: a saved list *is* its preset (§3.8).

**Schemas.** Each field is `[type, ...args, default]`. Field order is fixed and used for stable comparison.

| tool | field | type | range / values | default |
|---|---|---|---|---|
| number | from | int | −1e9…1e9 | 1 |
| | to | int | −1e9…1e9 | 10 |
| | count | int | 1…100 | 1 |
| | sort | bool | | false |
| | allowDupes | bool | | false |
| | noRepeat | bool | | false |
| dice | count | int | 1…12 | 2 |
| | sides | int | 2…100 | 6 |
| | modifier | int | −99…99 | 0 |
| lots | n | int | 2…30 | 6 |
| | k | int | 1…29 | 1 |
| teams | source | enum | 'paste','list' | 'paste' |
| | listId | id | `/^[\w-]{0,64}$/` | '' |
| | text | text | ≤ 10,000 chars | SAMPLE_NAMES |
| | mode | enum | 'teams','size' | 'teams' |
| | n | int | 2…50 | 2 |
| shuffle | source, listId, text | as teams | | text = SAMPLE_NAMES |
| wheel | source, listId, text | as teams | | text = SAMPLE_WHEEL |
| lottery | n | int | 2…99 | 49 |
| | k | int | 1…10 | 6 |
| | bonusK | int | 0…3 | 0 |
| | bonusN | int | 1…99 | 10 |
| | bonusSame | bool | | false |
| | lines | int | 1…10 | 1 |
| cards | count | int | 1…10 | 1 |
| | jokers | bool | | false |
| | noRepeat | bool | | true |

`SAMPLE_NAMES = 'Alice\nBob\nCharlie\nDana\nEli\nFarah\nGus\nHana'`, `SAMPLE_WHEEL = 'Pizza\nBurgers\nSushi\nTacos\nPasta\nSalad'`.

`text` values: normalize `\r\n` to `\n`, then cut to 10,000 characters. Line count and item limits apply when items are parsed (§4.1).

**Functions** (all pure):
- `CONFIG_DEFAULTS[tool]`: an object built from the schema defaults.
- `cleanConfig(tool, raw, { lenient = false } = {})`: returns a config object with exactly the schema keys, in schema order, or `null`.
  - The input must be a plain object. Unknown keys are ignored, and a missing key takes its default.
  - **Strict** (default): a present key with the wrong type or out of range makes the result `null`. Integers must be `Number.isInteger`.
  - **Lenient**: an invalid value falls back to the default. It never returns `null` for an object input.
  - Afterwards, the cross-field `fix` always runs, and it clamps rather than rejects:
    - number: swap when `from > to`. Set `noRepeat = false` when `to − from + 1 > 100000`.
    - lots: `k = min(k, n − 1)`.
    - lottery: `k = min(k, n)`. If `bonusSame`, then `bonusK = min(bonusK, n − k)`; otherwise `bonusK = min(bonusK, bonusN)`.
- `extractConfig(tool, section)`: builds the config from a store working section. It is `cleanConfig(tool, section, { lenient: true })`. For list-source tools it also sets `text = ''` when `source === 'list'` and `listId = ''` when `source === 'paste'`. Use this for comparing and saving.
- `configKey(tool, config)`: `JSON.stringify` of the cleaned config (key order is fixed). Two configs are equal when their keys are equal.
- `applyConfig(tool, section, config)`: mutates a working section to match the config. It returns `true` if anything changed. Pool resets:
  - number: if `from` or `to` changed, set `drawn = []`.
  - dice: if `count` or `sides` changed, set `values = Array(count).fill(1)`.
  - cards: if `jokers` changed, set `drawn = []`.
  - list-source tools: always set `source`. When the source is `'list'`, set `listId` and **leave `text` untouched**, which keeps the user's pasted text. When it is `'paste'`, set `text`.
- `summary(tool, config, lists)`: the muted one-line description used for preset rows and search:
  - number: `1–12`, plus ` · 3 numbers` when count > 1, plus ` · no repeat`.
  - dice: `formatDice(config)`, e.g. `2d6+3`.
  - lots: `6 lots · 1 winner`, or `2 winners` when k > 1.
  - teams: `3 teams` or `groups of 4`, then ` · 12 names` for pasted text, or ` · <list name>` (or `· list missing`) for a saved list.
  - shuffle and wheel: `12 items`, or the list name.
  - lottery: `6/49`, `5/69 + 1/26`, then ` · 3 lines` when lines > 1.
  - cards: `1 card`, then ` · jokers`, then ` · deck` when noRepeat.
- `toParams(tool, config, lists)` and `fromParams(tool, searchParams)`: see §7.
- `BUILTIN_LISTS`: see §10.2. `SHORTCUTS`: see §8.3.

### 2.2 Store (`js/store.js`): state version 1 → 2

```js
const VERSION = 2;
export const DEFAULTS = {
  version: 2,
  settings: { … unchanged … },
  number:   { … unchanged … },
  lists:    [ … unchanged default list … ],
  dice:     { count: 2, sides: 6, modifier: 0, values: [1, 1] },
  coin:     { heads: 0, tails: 0, last: null, run: 0, best: 0, bestFace: null },
  lots:     { n: 6, k: 1 },
  teams:    { ...CONFIG_DEFAULTS.teams },
  shuffle:  { ...CONFIG_DEFAULTS.shuffle },
  wheel:    { ...CONFIG_DEFAULTS.wheel },
  lottery:  { ...CONFIG_DEFAULTS.lottery },
  cards:    { ...CONFIG_DEFAULTS.cards, drawn: [] },   // drawn = card indices 0..51 (0..53 with jokers)
  presets:  [],   // [{ id, tool, name, config, t }]  ordered by creation (append)
  history:  {},
};
const MIGRATIONS = [
  (raw) => raw,                         // 0 -> 1 (unchanged)
  (raw) => ({ ...raw, version: 2 }),    // 1 -> 2: new sections are filled from defaults by normalize()
];
```

`normalize()` additions. It must accept both v1 and v2 input, and every existing test must still pass:
- **dice**:
  - `count` is clamped to 1–12.
  - `sides` is clamped to 2–100, default 6. Missing in v1 data, so it becomes 6.
  - `modifier` is clamped to −99…99, default 0.
  - `values` has length `count`, each value clamped to 1…sides.
- **coin**:
  - `run` and `best` are ints ≥ 0.
  - `bestFace` is `'heads'`, `'tails'` or `null`.
  - If `last` is null, force `run = 0`.
- **teams, shuffle, wheel, lottery**: `cleanConfig(tool, raw[tool], { lenient: true })` when `raw[tool]` is an object. Otherwise use the defaults.
- **cards**: lenient `cleanConfig` plus `drawn = cleanDrawn(raw.cards.drawn, 0, jokers ? 53 : 51)`.
- **presets**: when `raw.presets` is an array, keep entries that pass all of these checks, in order:
  - `id` is a string matching `/^[\w-]{1,64}$/` and is unique.
  - `tool` is in `CONFIG_TOOLS`.
  - `name` is a string, trimmed, non-empty and sliced to 60 characters.
  - `config` is an object. Store it as `cleanConfig(tool, config, { lenient: true })`.
  - `t` is a finite number (default 0).
  - Then enforce the limits (§3.6): drop entries beyond 20 per tool and beyond 100 in total, keeping the earliest.
- Anything else is dropped. Unknown top-level keys are dropped, as before.

**New helpers** (each does one `update()`):
- `addPreset(tool, name, config) → id | null`. It returns `null` when a limit is hit. The id is `crypto.randomUUID?.() ?? Date.now().toString(36) + randInt(0, 2**31).toString(36)`, and `t = Date.now()`.
- `updatePreset(id, config)`, `renamePreset(id, name)`, `deletePreset(id)`.
- `getPreset(id)`.
- `renameList(id, name)`.
- `ensureBuiltinList(id)`: if `BUILTIN_LISTS[id]` exists and no list has that id, push `{ id, name, items, noRepeat: false, drawn: [], pickCount: 1 }`. Returns the list or `null`.

`deleteList` does **not** delete presets that reference the list. Those presets show "list missing" (§6.1).

**Downgrade note.** An old cached v2 app that boots with `version: 2` data falls back to defaults (as v1 designed). New code activates on the next load through `skipWaiting` and `clients.claim`, so this only happens when an old tab is open at the same time. This is accepted (§14).

---

## 3. Saved presets

### 3.1 Behaviour model (decision)
A tool has **one working state**: its store section, exactly as in v1. A preset is a **named snapshot of the config fields** (§2.1). It never includes pools, results or dice values.
- **Opening a preset** (`#/<tool>/p/<id>`) copies its config into the working state with `applyConfig`. This only happens **if the config differs**, so reopening the same preset keeps its no-repeat pool. The screen then renders from the working state, like any other visit.
- **Edits are never saved to the preset automatically.** Every change edits the working state. While a preset route is open, the screen compares `configKey(extractConfig(section))` against the preset's config after **every store update** (`subscribe`). When they differ, the **preset bar** appears (§3.4).
- After leaving, the plain tool route (`#/number`) shows the last working state, which may be the preset's settings. That is intended: it is "the last settings you used".
- History stays per tool (`number`, `dice`, …). There is no per-preset history.

This is the least-risk design. There is no second copy of state, so v1 logic (pools, swaps, clamps) is reused unchanged.

### 3.2 Routes

| Hash | Screen |
|---|---|
| `#/number/p/:id`, `#/dice/p/:id`, `#/lots/p/:id` | Existing tool with preset |
| `#/teams`, `#/teams/p/:id` | Teams |
| `#/shuffle`, `#/shuffle/p/:id` | Shuffle |
| `#/wheel`, `#/wheel/p/:id` | Wheel |
| `#/lottery`, `#/lottery/p/:id` | Lottery |
| `#/cards`, `#/cards/p/:id` | Cards |

Optional hash query, read by `hashQuery()`:
- `?edit=1` on a preset route opens the Parameters sheet on mount. List-source tools focus the items textarea instead.
- Config params on a plain tool route come from share links (§7).

Router additions (`js/router.js`):
- `hashQuery()` returns `new URLSearchParams(location.hash.split('?')[1] || '')`.
- `stripHashQuery()` runs `history.replaceState(history.state, '', '#' + currentPath())`. It does not fire `hashchange`, and it keeps `d`.
- `remount()` re-runs `mount()` for the current route.

Every screen's `render(root, params)` receives `{ id }` on `/p/` routes and `{}` otherwise.

### 3.3 `js/presets.js`

```js
// Call first in render(). Returns null if it redirected.
export function initTool(tool, params) → { preset: object|null, edit: boolean } | null
```
It works in this order:
1. If `params.id` is set: `p = getPreset(id)`. If it is missing or `p.tool !== tool`, show the toast "Preset not found", call `replace('#' + route)` and return `null`. Otherwise run `applyConfig` inside `update()` when the configs differ.
2. Else, if `hashQuery()` contains **any schema key** of this tool: `cfg = fromParams(tool, q)`. If valid, apply it the same way. If invalid, show the toast "This link has invalid settings". Either way, call `stripHashQuery()`.
3. `edit = hashQuery().get('edit') === '1'`. If a query is present, strip it.

```js
export function toolChrome({ tool, preset, title, historyKey, shareText }) → { title, actions, bar, cleanup }
```
- `title` is the preset name on a preset route, otherwise the tool title.
- `actions` is `[historyButton, soundToggle(), menuButton]`. The ⋮ menu (`aria-label="Tool options"`) contains:

| Item | Plain route | Preset route |
|---|---|---|
| Save as preset… | ✓ (presets tools only) | label "Save as new preset…" |
| Rename preset… | – | ✓ |
| Delete preset | – | ✓ (danger) |
| Share… | ✓ | ✓ |

  Coin shows only "Share…".
- `bar` is the preset bar element (§3.4). It is an empty hidden node on plain routes.
- `shareText()` is supplied by the screen. It returns the last result line or `''`.
- `cleanup` unsubscribes the dirty watcher.

### 3.4 Preset bar (dirty state)
- It is placed as the **first child of `.content`**, hidden when clean. `hidden` is toggled, and the space is not reserved (it is fine for it to push content down, because it appears only after a user edit).
- Layout is two rows:
  - Row 1: the text `Changed from "<name>"`, set with textContent, 14px, `--text-2`, ellipsized.
  - Row 2: buttons **Update**, **Save as new** and **Revert**, right-aligned, `.btn.sm`.
- **Update**: `updatePreset(id, extractConfig(...))`, toast "Preset updated". The bar hides, because it is clean again.
- **Save as new**: `promptDialog` with the default `<name> 2`, then `addPreset`, toast "Preset saved", then `replace('#/<tool>/p/<newId>')`.
- **Revert**: `update(s => applyConfig(tool, s[tool], preset.config))`, then `remount()`, which rebuilds the inputs from the working state.
- The text line has `aria-live="polite"`, so becoming dirty is announced once.

### 3.5 Save / rename / delete flows
- **Save as preset…** (plain route):
  1. Check the limits (§3.6). At a limit, show the toast "Preset limit reached (20 per tool)" or "(100 total)".
  2. `promptDialog({ title: 'Save preset', label: 'Name', value: summary(...), confirmLabel: 'Save' })`.
  3. `addPreset`, toast "Preset saved", then `replace('#/<tool>/p/<id>')`. Replace means back returns to wherever the user came from.
- **Rename preset…**: `promptDialog` prefilled with the name, then `renamePreset`, then update the top-bar `<h1>` text in place.
- **Delete preset**: `confirmDialog({ message: 'Delete preset "<name>"?' })`, then `deletePreset`, toast "Preset deleted", then `replace('#' + route)`. The working state is kept.
- **Home child row ⋮**: **Rename** (prompt), **Edit** (navigates to `#/<tool>/p/<id>?edit=1`) and **Delete** (confirm, then repaint the rows).

`promptDialog` (new in `ui.js`):
- It is a `<dialog class="confirm">` containing a `<form method="dialog">` with a title `<h2>`, a labelled `<input type="text" maxlength=60>` (autofocused, text selected), Cancel, and a confirm button.
- The confirm button is disabled while the trimmed value is empty. Enter submits.
- It returns `Promise<string | null>` with the trimmed name, or `null` on cancel.

### 3.6 Limits and ordering
- At most **20 presets per tool** and **100 in total**. Preset names are ≤ 60 characters. `text` in any preset is ≤ 10,000 characters.
- Order is **creation order**: new presets are appended, the same as lists. There is no manual reordering (§14).
- Duplicate names are allowed.

### 3.7 Storage budget
- Worst case for presets is 100 × ~10 KB, which is about 1 MB. With lists (500 × 200 characters each) the practical total stays well under the ~5 MB localStorage quota.
- On a quota error, the existing "Storage full — data not saved" toast fires once. Nothing else changes.
- List-source tools commit textarea edits to the store with a **250 ms debounce**, so a long paste does not write on every keystroke. The pending write is flushed on cleanup.

### 3.8 Saved lists stay as they are (decision)
Saved lists do **not** fold into the preset system. They already carry data (up to 500 items), per-list pools and per-list history keys (`list:<id>`), and v2 landing pages and preset ids (`preset-names`, `preset-yes-no`) depend on them. Folding them in would mean a data migration with real risk for zero user-visible gain, since a list already behaves as a named preset under LIST.

v3 only adds these to lists:
- **Rename** in the Home row ⋮ menu. The menu becomes Rename / Edit / Delete, the same pattern as presets.
- Weighted items (§4.1), share list (§7.3), import from the clipboard (§4.3), and builtin auto-create (§10.2).
- The new list-based tools (Teams, Shuffle, Wheel) can use a saved list as their source.

---

## 4. Parsers (`js/parse.js`, pure)

### 4.1 Items and weights
- `parseItems(text)`: moved from `list-edit.js` with identical behaviour. It splits on `\n`, trims each line, drops empty lines, cuts each to 200 characters and keeps at most 500. `list-edit.js` imports it from here.
- `parseWeighted(line) → { text, weight }`. The grammar is applied to the trimmed line:
  1. **Escape**: if the line matches `/^(.*\S)\s\\([*xX]\d{1,3})$/`, the result is `{ text: m[1] + ' ' + m[2], weight: 1 }`. A backslash before the marker removes itself, and the suffix stays literal. For example, `Size \x3` becomes the text `Size x3` with weight 1.
  2. **Weight**: if the line matches `/^(.*\S)\s[*xX](\d{1,3})$/` and `1 ≤ Number(m[2]) ≤ 100`, the result is `{ text: m[1], weight: Number(m[2]) }`.
  3. Otherwise the result is `{ text: line, weight: 1 }`. This covers `Pizza*3` (no space), `Pizza * 3`, `*3` alone, `Pizza x0` and `Pizza x101`, which are all literal.
  - Exactly one whitespace character comes before the marker, and there is **no space between the marker and the digits**.
- `parseList(text)` returns `parseItems(text).map(parseWeighted)`.

**Where weights apply:**
- **List** tool picks and **Wheel** segments use them: probability and segment angle are proportional to the weight.
- **Teams** and **Shuffle** strip the suffix and ignore the weight, so the display text is `text`.
- Stored list items stay **raw** (`"Pizza *3"`), so the list schema is unchanged. Weights are parsed at use time.

**No-repeat interaction (decision):** the pool is still per entry (index), and the counter total is the number of entries. The weight only changes how likely each *remaining* entry is to be drawn next. Once an entry is drawn it is out until the pool resets, whatever its weight. This keeps the v1 counter and reset semantics exact.

**List display:** each row shows `text`. When weight > 1 it also shows a muted badge `×3` (`aria-label="weight 3"`). The result overlay and history use `text`.

### 4.2 Dice notation
`parseDice(str) → { count, sides, modifier } | null`:
- Preprocess: trim, replace `−` (U+2212) with `-`, and remove all whitespace.
- Match `/^(\d{1,2})?[dD](\d{1,3})(?:([+-])(\d{1,2}))?$/`.
- `count` defaults to 1. Valid ranges: count 1–12, sides 2–100, modifier −99…99. Anything outside them, or any other shape (`2d6+1d4`, `d`, `0d6`, `13d6`, `2d1`, `2d101`, `2d6+100`), returns `null`.

`formatDice({ count, sides, modifier })` gives `(count > 1 ? count : '') + 'd' + sides + (modifier > 0 ? '+' + modifier : modifier < 0 ? String(modifier) : '')`. Examples: `2d6+3`, `d20`, `3d8-2`.

### 4.3 Import from the clipboard
`splitImport(text)`:
- If the text contains `\n`, split on `/\r?\n/`.
- Otherwise split on `/[,;\t]/`.
- Trim each part, drop empty ones, and return an array of strings.

UI: a **Paste** button (clipboard icon + "Paste", `.btn.sm.tonal`) sits next to the items field in the list editor and in the source card (§6.1). On click:
1. `navigator.clipboard?.readText?.()`. On failure or when missing, show the toast "Can't read the clipboard — paste with your keyboard instead" and stop.
2. Take `splitImport(text)`, cut each item to 200 characters, and **append** the items as lines to the textarea (with a separating `\n` when it is non-empty).
3. Respect the 500 cap. Show the toast "Added N items", or "Added N items (limit 500)" when truncated.
4. Fire an `input` event so the counters and debounced save run.

Pasting with the keyboard is unchanged: plain text is inserted, with no auto-splitting.

---

## 5. Changes to existing tools

All of them use `initTool` and `toolChrome` (§3.3). Coin uses `toolChrome` only (for Share).

### 5.1 Number
- `render(root, params)`: `initTool('number', params)`, then build the UI as before. The top bar uses `chrome.title` and `chrome.actions`. `chrome.bar` goes at the top of `.content`.
- `shareText` is `"Number <from>–<to>: <last result>"`, or `''` before the first generate.
- `showResult` now gets `caption: 'Number'` (or the preset name) and `onShare`.
- `?edit=1` opens Parameters on mount.

### 5.2 List
- `find()` falls back to `ensureBuiltinList(id)` when `id` is in `BUILTIN_LISTS`. So `#/list/preset-magic-8-ball` always works. The same applies in `list-edit.js`.
- **Generate**:
  - If any item has weight > 1, use `drawWeighted({ weights, count, noRepeat, drawn })` (§5.7).
  - Otherwise use the existing `draw()`, so v1 behaviour is identical.
  - Results and history use the parsed `text`.
- The ⋮ menu adds **Share list…** between Edit list and Delete list (§7.3).
- The overlay gets `caption: <list name>` and `onShare`.

### 5.3 List editor
- The Items caption row gets the **Paste** button (§4.3).
- Under the counter, a muted hint: "Tip: add *3 to an item to make it 3× as likely."
- **Prefill from a link**: on `#/list/new?name=…&items=…`:
  - `name` is trimmed and sliced to 60.
  - `items` is split on `\n`, then passed through `parseItems`.
  - Fill the fields, `stripHashQuery()`, and show the toast "List loaded from link — tap Save to keep it". Nothing is saved until Save.
  - `?items` longer than 20,000 characters is ignored, with the toast "This link has invalid settings".

### 5.4 Dice
State: `count` 1–12, `sides`, `modifier`, `values`.
- **Faces**:
  - `sides === 6` uses the v1 pips.
  - Otherwise the die shows the **number** centered: display font, weight 600, font-size 42% of the die, tabular.
  - `aria-label` is `"d20 showing 17"`, or `"Die showing 4"` for d6.
- **Die size** by count: 1–2 → 112px, 3–4 → 96px, 5–6 → 80px, 7–12 → 64px.
- **Under the dice**:
  - A **notation chip** button showing `formatDice(config)`, e.g. "2d6+3". It opens Parameters.
  - Then the **total line**. It is shown when `count > 1` or `modifier ≠ 0`:
    - The total is `Total 12` (20px, weight 600).
    - A breakdown line follows: `4 + 5` plus ` + 3` or ` − 2` for the modifier (14px, `--text-2`).
  - Then the count stepper, range 1–12. Its label is `"3 dice"` or `"1 die"`.
- **Parameters sheet**:
  - **Notation**: a text field, placeholder `e.g. 2d6+3`, `inputmode="text"`, `autocapitalize="off"`. It applies on Enter or change through `parseDice`.
    - Valid: `update(s => applyConfig('dice', s.dice, parsed))`, then rebuild the dice and sync the other controls.
    - Invalid: revert the field and show the toast "Use a format like 2d6+3 (1–12 dice, d2–d100, ±99)".
  - **Sides**: chips `d4 d6 d8 d10 d12 d20 d100` (`aria-pressed`). When the sides are not one of these, no chip is pressed.
  - **Modifier**: a stepper, −99…99. The format is `+3`, `0` or `−2`.
- **Roll**:
  - Values are `randInt(1, sides)`. The flicker uses `randInt(1, sides)` too.
  - History text is `"<notation>: <v1 + v2 …> = <total>"`, e.g. `2d6+3: 4 + 5 + 3 = 12`.
  - With one die and no modifier it is `"d20: 17"`, or plain `"4"` for d6.
  - The announcement is `"Rolled 4, 5. Plus 3. Total 12"`.
- `shareText` is `"Dice <notation>: <total>"`.

### 5.5 Coin: stats
- `finish()` also updates the streaks: `run = (last === result ? run + 1 : 1)`, then `last = result`, then `if (run > best) { best = run; bestFace = result }`.
- The stats block replaces the old tally line:
  - Line 1: `Heads 4 · 40%` and `Tails 6 · 60%`, shown as two stat columns (§9.7). The percent is `Math.round(100 * h / (h + t))`. When the total is 0, show `—`.
  - Line 2 (`--text-2`, 14px): `Streak 3 tails · Longest 5 heads`. It is hidden while total = 0.
- **Reset tally** also resets `run`, `best` and `bestFace`.
- `shareText` is `"Coin: Heads"`.

### 5.6 Cast lots
Presets and Share only. `shareText` is the last reveal line.

### 5.7 `js/rng.js` additions (pure)
- `draw({ …, resetNote })`: the optional `resetNote` replaces the default "All <label> drawn — pool reset" text.
- `weightedIndex(weights, excludeSet)`: the total is `W = Σ weights[i]` over non-excluded indices, with integers ≥ 1. Draw `r = randInt(0, W − 1)` and walk the cumulative sums. Throws if `W === 0`.
- `drawWeighted({ weights, count, noRepeat, drawn = [] })`: the same contract and notes as `draw()`, but each pick is `weightedIndex` without replacement within the batch (the chosen index is added to the exclude set).
  - With `noRepeat`, previously drawn indices are excluded, and it auto-resets when all are drawn.
  - Returns `{ values, drawn, notes }`.
- `splitTeams(names, mode, n)`:
  - `T = mode === 'teams' ? min(n, names.length) : ceil(names.length / n)`.
  - `shuffle` a copy of the names, then deal them round-robin into T arrays.
  - Returns an array of arrays. Sizes differ by at most 1. In size mode every team has ≤ n members.
- `drawLottery({ n, k, bonusK, bonusN, bonusSame })`:
  - `main = sampleDistinct(1, n, k)` sorted ascending.
  - `bonus` is `[]` when bonusK = 0. Otherwise, with `bonusSame`, it is `sampleDistinct(1, n, bonusK, new Set(main))`; without it, `sampleDistinct(1, bonusN, bonusK)`. Sorted ascending.
  - Returns `{ main, bonus }`.

---

## 6. New tools ("More tools")

Common to all five:
- A `toolChrome` top bar and preset support.
- A labelled FAB (§9.6) that runs the primary action. Space/Enter also run it through `setPrimaryAction`.
- A history key equal to the tool id. History text is capped at 1,000 characters with `…`.
- Results are shown **inline** (not in the overlay), and the result block is announced through `announce()`.
- After an action, if the result block's top is below the viewport, call `resultEl.scrollIntoView({ block: 'nearest', behavior: motionOn() ? 'smooth' : 'auto' })`.
- Copy and Share are small `.btn.sm.tonal` buttons under the result. They are shown after the first result.

### 6.1 Shared source card (`js/screens/source.js`)
Used by Teams, Shuffle and Wheel. `sourceCard({ tool, onChange }) → { el, getItems(), focus(), cleanup }`.
- **Segmented control** "Paste | Saved list" (`ui.segmented`, radiogroup). "Saved list" is disabled (`aria-disabled`, hint "No saved lists yet") when there are no lists.
- **Paste mode**:
  - A `<textarea class="field textarea">` (rows 6, placeholder "One per line", `aria-label="Items"`) bound to `section.text`, with the 250 ms debounced commit.
  - Below it, a row with a muted count "N items" on the left and the **Paste** button (§4.3) and a **Clear** button on the right. Clear empties the text with no confirm.
- **Saved list mode**:
  - A native `<select class="field">` (`aria-label="Saved list"`) with one `<option>` per list, text `"<name> (N)"` set via textContent, bound to `listId`.
  - Next to it, an "Edit list" link to `#/list/<id>/edit`.
  - If `listId` does not exist (deleted), preselect nothing, add a disabled first option "Choose a list", and show the muted hint "The saved list was deleted".
- `getItems()` returns `parseList(text)` in paste mode, or `parseList(list.items.join('\n'))` in list mode. It returns `[]` when the list is missing.

### 6.2 Teams (`#/teams`, FAB "Split", history `teams`)
- **Layout**: source card, then the settings card, then the result.
- **Settings card**:
  - `segmented` "Teams | Group size" bound to `mode`.
  - A stepper bound to `n` (2–50). Its label is "Number of teams" in teams mode or "People per group" in size mode, and the value format is `"3 teams"` / `"4 per group"`.
- **Split**:
  - `names = getItems().map(i => i.text)`. If there are fewer than 2, show the toast "Add at least 2 names" and stop.
  - In teams mode, when `n > names.length`, cap it and show the toast "Only N names — made N teams".
  - `teams = splitTeams(names, mode, n)`.
- **Result**:
  - A grid `repeat(auto-fill, minmax(150px, 1fr))` of team cards.
  - Each card has a header ("Team 1" plus a muted count, and a 8px dot in `PALETTE[i % 10]`) and a `<ul>` of names (textContent).
  - Each card is a `<section aria-labelledby>` with an `<h2>` header.
- **Copy text** is `"Team 1: A, B, C\nTeam 2: D, E"`. History uses the same text joined by ` · `. The announcement is "Split into 3 teams".
- `shareText` is the copy text.

### 6.3 Shuffle (`#/shuffle`, FAB "Shuffle", history `shuffle`)
- **Layout**: source card, then the result.
- **Shuffle**:
  - `items = getItems().map(i => i.text)`. If there are fewer than 2, show the toast "Add at least 2 items" and stop.
  - `shuffle(copy)`.
- **Result**: an `<ol class="shuffle-out">`. Each `<li>` has a tabular index number in `--text-2` and the text.
- **Copy text** is `"1. Bob\n2. Alice …"`. The announcement is "Shuffled 12 items".
- The ordering is not persisted. It is in memory until a re-render.

### 6.4 Wheel (`#/wheel`, FAB "Spin", history `wheel`)
- **Layout**: the wheel stage (center), the result line, then the source card.
- **Items**: `getItems()`.
  - With more than 100, use the first 100 and show a muted note "Showing the first 100 items".
  - With fewer than 2, draw a neutral placeholder circle with the text "Add at least 2 items", and the FAB is disabled.
- **Stage**: `width: min(84vw, 360px)`, square, `position: relative`. It contains:
  - `<svg class="wheel" viewBox="-110 -110 220 220" role="img" aria-label="Wheel with N segments">`. This is the element that rotates, through CSS `transform: rotate(Rdeg)` on the svg itself (HTML box, center origin).
  - `.wheel-pointer`: an absolutely positioned triangle at the top center, pointing down, fixed (it does not rotate).
  - `.wheel-hub`: a 22% circle in the center, fixed, decorative.
- **Geometry**:
  - Segment angles are proportional to the weight: `w_i / W · 360`. The start angle `a_i` is measured **clockwise from 12 o'clock**.
  - A point at angle θ and radius r is `(r·sin θ, −r·cos θ)`.
  - Each segment is a `<path d="M0 0 L p(a_i) A 100 100 0 <large> 1 p(a_{i+1}) Z">`, with `large = width > 180 ? 1 : 0`.
  - Fill is `PALETTE[i % 10]`. If `n > 1` and the last and first colors would be equal (`(n − 1) % 10 === 0`), the last segment uses `PALETTE[5]`.
  - Segments have a 0.6-unit stroke in `var(--surface-1)` as a gap line.
- **Labels**: `<text>` with `textContent = truncate(text, 16)` (appending `…`), `fill="#fff"`, `text-anchor="end"`, `dominant-baseline="middle"`, `transform="rotate(c − 90) translate(92 0)"`, where c is the segment's center angle.
  - `font-size = clamp(5, width_deg * 0.35, 11)`, weight 600.
  - **The label is omitted when the segment width is < 5.5°** ("too dense"). Every segment keeps its color.
- **Spin**:
  1. Ignore input while spinning.
  2. `i = weightedIndex(weights)`, chosen **first** by crypto RNG.
  3. The target angle is `t = a_i + width_i · (0.15 + 0.7 · randInt(0, 1000) / 1000)`.
  4. `delta = ((−t − R) mod 360 + 360) mod 360`, then `R += 360 · 6 + delta`.
  5. Motion on: `svg.style.transition = 'transform 4400ms cubic-bezier(.12,.72,.14,1)'`, set the transform, and finish on `transitionend` (for transform) or after a 4,600 ms timeout fallback. Play `click()` at the start.
  6. Motion off (animations off or reduced motion): set R with `transition: none` and finish immediately.
  7. **Finish**: set the result line to the item text (display font, 28px, weight 600, `aria-live="polite"`). Then `ting()`, `vibrate(20)`, `addHistory('wheel', text)`, and announce "Landed on <text>".
- R is in memory only and starts at 0. On cleanup, finish any in-flight spin.
- `shareText` is `"Wheel: <text>"`.

### 6.5 Lottery (`#/lottery`, FAB "Draw", history `lottery`)
- **Format chips** (quick fill, not saved presets): `6/49`, `6/59`, `5/69 + 1/26`, `5/70 + 1/25`, `5/50 + 2/12`, `7/35`. Each sets `{ n, k, bonusK, bonusN, bonusSame: false }`. A chip has `aria-pressed` when the config matches.
- **Parameters sheet** has steppers for:
  - Main pool 1–N (2–99)
  - Numbers to pick (1–min(10, N))
  - Bonus balls (0–3)
  - Bonus pool 1–M (1–99), disabled when bonusK = 0 or "same pool" is on
  - Lines (1–10)
  
  It also has a switch "Bonus from the main pool". Every change goes through `cleanConfig` (fix), and the stepper ranges are re-synced.
- **Draw**: `lines ×` `drawLottery(config)`.
- **Result**: one row per line. Each row has:
  - An optional "Line 2" label (`--text-2`, 13px).
  - Main balls: 40px circles, `var(--text)` background, `var(--bg)` numerals.
  - A thin `+` in `--text-2`.
  - Bonus balls: `--accent` background, `--on-accent` numerals.
  - `role="img"`, `aria-label="Line 1: 5, 12, 23, 34, 41, 49. Bonus 7"`.
- History and copy per line: `"5 12 23 34 41 49 + 7"`. Lines are joined by `\n` for copy and ` | ` for history.
- A muted footnote under the result: "Random picks don't change your odds. Play responsibly."

### 6.6 Cards (`#/cards`, FAB "Draw", history `cards`)
- **Deck**: indices 0–51, where `suit = SUITS[Math.floor(i / 13)]` and `rank = RANKS[i % 13]`.
  - `SUITS = [['♠','spades',black], ['♥','hearts',red], ['♦','diamonds',red], ['♣','clubs',black]]`.
  - `RANKS = A 2 3 4 5 6 7 8 9 10 J Q K` (names Ace, Two … Ten, Jack, Queen, King).
  - With jokers: 52 is the red Joker and 53 is the black Joker.
  - Always append **U+FE0E** after suit glyphs so iOS does not render them as emoji.
- **Controls**:
  - `noRepeatCard({ label: 'No repeat (deck)', format: ({ drawn, total }) => `${total − drawn} left`, resetLabel: 'Reshuffle', resetToast: 'Deck reshuffled' })`.
  - The Parameters sheet has "Cards per draw" (1–10) and a switch "Include 2 jokers". Changing jokers resets `drawn`.
- **Draw**: `draw({ min: 0, max: total − 1, count, noRepeat, drawn, label: 'cards', resetNote: 'Deck empty — reshuffled' })`. Persist `drawn`.
- **Result**: the drawn cards are shown inline as `.playing-card` elements (§9.7), in a flex-wrap row.
  - Each card has a rank and suit in the top-left and bottom-right corners (rotated 180°) and a large suit in the center. A joker shows "JOKER" vertically with a ★.
  - `role="img"`, `aria-label="Queen of hearts"`.
  - The last hand is kept in memory only.
- History and copy: `"Q♥, 10♠"`.

---

## 7. Share

### 7.1 `share(tool)` in `js/presets.js`
- `url = new URL('../', import.meta.url).href + '#' + route + '?' + toParams(tool, extractConfig(...), lists)`. The base resolves to the **site root** from any landing page. Coin uses `'#/coin'` with no params.
- `text = shareText()`, or if empty, `"Random: " + (preset name | tool label) + " — " + summary`.
- If `navigator.share` exists, call `navigator.share({ title: 'Random', text, url })` and ignore `AbortError`. Otherwise call `copyText(text + '\n' + url)`, which shows the "Copied" toast.
- The result overlay's Share button (next to Copy, shown only when `onShare` is passed) calls the same function.

### 7.2 Param format (`toParams` / `fromParams` in tools.js)
- Format: `v=1` followed by one `key=value` per schema field, in schema order, encoded with `URLSearchParams`.
  - Integers are decimal. Booleans are `1` or `0`. Enums use their literal value. `text` is newline-joined raw lines, so weights survive.
  - Example: `#/number?v=1&from=1&to=12&count=3&sort=1&allowDupes=0&noRepeat=0`.
- **List-source tools**:
  - `source` and `listId` are never emitted. The items are always inlined as `text`, resolved from the saved list when the source is `'list'`.
  - `toParams` keeps the first **100 lines and ≤ 2,000 characters**. It returns `{ query, truncated }`. When truncated, share also shows the toast "Link includes the first 100 items".
- `fromParams(tool, q) → config | null`:
  - `v`, if present, must be `'1'`.
  - For each schema key present: int must match `/^-?\d{1,10}$/`; bool must be `1`, `0`, `true` or `false`; enum must be an exact member; text must be ≤ 10,000 characters. `source` and `listId` are **ignored** (list tools always get `source: 'paste'`).
  - Unknown keys are ignored. Missing keys take **defaults**, not the current state, so a link is reproducible.
  - The result is `cleanConfig(tool, obj)` in **strict** mode. Any failure returns `null`.
- **Safety**: values reach the DOM only through `.value` and `textContent`. Numbers are range-checked before any RNG call. No param is ever evaluated or used as a selector or URL.

### 7.3 Share list
The List screen's ⋮ → Share list… builds `#/list/new?name=<name>&items=<items joined by \n>` from the site root (first 100 items / 2,000 characters, same truncation toast). The text is `"Random list: <name>"`. The recipient gets a prefilled editor (§5.3).

---

## 8. Home

### 8.1 Layout (top to bottom; styles in §9.5)
1. The top bar with the large title "Random" and the settings button.
2. The **search field** (§8.2).
3. The section label "Tools", then a grouped card with rows for Number, List, Dice, Cast lots and Coin.
4. The section label "More tools", then a grouped card with rows for Teams, Shuffle, Wheel, Lottery and Cards.

**Tool row**:
- It is an `<a href="#/<route>">` with an icon tile, the label (sentence case), and a chevron.
- Under it come the tool's **child rows**: its presets (and for List, its saved lists), indented.
- **List row**: the label is not a link (there is no list route). It has a trailing "+" icon button (`aria-label="New list"`, `#/list/new`) instead of a chevron. With no lists, a muted child row says "No lists yet — tap + to create one".

**Preset child row**:
- It is a link to `#/<tool>/p/<id>` showing the name (ellipsized), the muted summary (ellipsized, `max-width: 45%`) and a ⋮ button (`aria-label="Options for <name>"`, menu Rename / Edit / Delete).
- **List child rows** are the same, with the summary `N items` and the menu Rename / Edit / Delete.

**Collapse**: when a tool has more than 5 children, show the first 5 and then a `<button class="child-more" aria-expanded="false">Show all (12)</button>`. When expanded it reads "Show less". The expanded state is kept in a module-level `Set` for the session.

Home subscribes to the store and repaints its children, and unsubscribes on cleanup.

### 8.2 Search
- **Field**: `<input type="search" enterkeyhint="go" autocomplete="off" spellcheck="false" aria-label="Search tools and presets" placeholder="Search tools and presets">` inside a `.search` wrapper, with a leading search icon.
- **Clear button**: an icon-button (`aria-label="Clear search"`), visible only when the field has a value. It clears the field and refocuses it.
- **Behaviour**: on each `input`, run `search(index, value)`.
  - An empty trimmed query shows the normal sections.
  - Otherwise the sections are **hidden** and a results card is shown instead.
- **Results**:
  - A `<ul class="search-results" aria-label="Search results">` of up to 20 rows.
  - Each row is `<a href>` with the icon tile, the **label** with its match in `<mark>`, and a muted **sub** line (e.g. "Dice", "Number · 1–12", "List · 20 items").
  - `<mark>` is built with DOM nodes: take the first case-insensitive `indexOf` of the raw trimmed query in the label. If it is not found, there is no highlight.
- **Empty state**: `No results for "<q>"` (textContent), with the hint "Try d20, coin, teams or wheel".
- **Announcements**: `announce("3 results")` or "No results", debounced by 400 ms.
- **Keyboard**:
  - `/` focuses the field when the event target is not an input, textarea, select or contenteditable. It does not fire during a sheet, dialog or open menu. A window `keydown` listener is registered by Home and removed on cleanup.
  - **Enter** in the field opens the first result with `location.hash = href`.
  - **ArrowDown** from the field focuses the first result link. Up/Down move between results, and Up from the first result returns to the field.
  - **Escape** in the field clears it if it is non-empty (`stopPropagation`), or blurs it otherwise.
- The query is not persisted.

### 8.3 Index and ranking (`js/search.js`, pure)
`buildIndex(state)` returns entries `{ kind, label, sub, href, icon, keywords: string[] }`, in this order:
1. **Tools**, kind `tool`, from `TOOLS`, with `TOOL_KEYWORDS`. The List tool's href is `#/list/new`.
2. **User lists**, kind `list`: href `#/list/<id>`, sub `List · N items`. The keywords are `['list']`, plus the builtin keywords if the id is a builtin.
3. **Presets**, kind `preset`: href `#/<tool>/p/<id>`, sub `<Tool label> · <summary>`. The keywords are the tool label plus the tool keywords.
4. **Builtin lists not already in the user's lists**, kind `list`: href `#/list/<id>` (auto-created on open), sub `List`.
5. **SHORTCUTS**, kind `shortcut`. These are config links that use the share-param mechanism:
   - `d4`, `d6`, `d8`, `d10`, `d12`, `d20`, `d100` → `#/dice?v=1&count=1&sides=N&modifier=0`, sub "Dice".
   - `Number 1–6`, `1–10`, `1–50`, `1–100`, `1–1000` → `#/number?v=1&from=1&to=N`, sub "Number".
   - `6/49`, `5/69 + 1/26` → `#/lottery?v=1&…`, sub "Lottery".

`TOOL_KEYWORDS` (in tools.js):
- number: random number, rng, pick a number, range, digit, integer
- list: list, name picker, names, pick, choose, random item, picker
- dice: dice, die, roll, d4, d6, d8, d10, d12, d20, d100, rpg, dnd, tabletop
- lots: lots, draw lots, straws, draw straws, winner, raffle
- coin: coin, flip, heads, tails, toss, yes no, 50 50, decide
- teams: teams, team, groups, group, split, divide, team generator, pairs
- shuffle: shuffle, random order, order, sequence, turn order, queue, sort
- wheel: wheel, spin, spinner, wheel of names, roulette, spin the wheel
- lottery: lottery, lotto, numbers, balls, powerball, euromillions, mega millions, bonus
- cards: cards, card, deck, playing cards, draw a card, poker, joker

`BUILTIN_LISTS` keywords are in §10.2.

**Normalization**: `norm(s) = s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()`. For example, "8-ball" becomes "8 ball" and "1–12" becomes "1 12".

**Ranking**:
```
tier(q, s) = s.startsWith(q) ? 3 : (' ' + s).includes(' ' + q) ? 2 : s.includes(q) ? 1 : 0
labelScore = tier(q, norm(label)) ; kwScore = max over keywords of tier(q, norm(kw))
score = max(labelScore > 0 ? labelScore * 2 + 1 : 0, kwScore * 2)
```
So label prefix = 7, keyword prefix = 6, label word = 5, keyword word = 4, label substring = 3, keyword substring = 2.
- Drop entries with score 0.
- Sort by score descending, then kind (tool 0, list 1, preset 2, shortcut 3), then index order.
- Return at most 20.
- An empty normalized query returns `[]`.

The ranking is prefix > word match > substring, as required.

---

## 9. Visual redesign: premium minimalist

**Scope: the redesign applies to the whole app.** That includes every v1 screen (Home, Number, List, List editor, Dice, Coin, Cast lots, Settings, History sheet, result overlay), the v2 below-the-fold section (article, nav, ad slot, footer, privacy page) and every new v3 screen.

**Direction**: away from Material (UXAPPS reference) toward calm, precise, iOS/Things/Linear-level polish:
- Neutral near-black and off-white surfaces.
- One refined accent (indigo), used **only for actions and state**.
- Hairlines instead of heavy fills.
- Large, crisp tabular numerals for results.
- Short, springy motion.

There are no webfonts, no images and no new dependencies. Everything is CSS plus inline SVG.

### 9.1 Implementation approach
- Replace the token block at the top of `css/app.css` with §9.2.
- Restyle every existing selector to use the new tokens. **Keep the class names** the JS already uses (`.card`, `.fab`, `.pill`, `.row`, `.switch`, `.seg`, `.stepper`, `.sheet`, `.menu`, `.toast`, `.die`, `.coin`, `.lot`, `.result-card`, `.below`, `.ad-slot`, …). Add new classes for new components.
- Old tokens used by name in JS or CSS (`--surface-2`, `--muted`, `--divider`, `--primary`, `--on-primary`, `--danger`) are **kept as aliases** so nothing breaks:
  ```css
  --muted: var(--text-2);
  --divider: var(--hairline);
  --primary: var(--accent);
  --on-primary: var(--on-accent);
  ```
  `--surface` becomes `--surface-1`. Keep `--surface` as an alias too.
- Remove the `.watermark` element from Home (home.js no longer creates it) and its CSS.

### 9.2 Tokens

```css
:root, html[data-theme="dark"] {
  color-scheme: dark;
  --bg: #0B0B0C;          /* app background */
  --surface-1: #141416;   /* cards, grouped lists */
  --surface-2: #1C1C1F;   /* inputs, sheets, menus, chips */
  --surface-3: #26262A;   /* pressed rows, icon tiles, selected segment */
  --hairline: rgba(255,255,255,.08);
  --hairline-strong: rgba(255,255,255,.14);
  --border-input: #62626A;  /* ≥ 3:1 vs bg/surfaces (WCAG 1.4.11) */
  --text: #F2F2F3;
  --text-2: #A1A1A8;        /* secondary text; ≥ 5.9:1 on every surface */
  --accent: #8B93FF;
  --on-accent: #0B0B0C;
  --accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);
  --danger: #FF6B6B;
  --die-bg: #F2F2F3; --die-fg: #0B0B0C;
  --shadow-1: 0 1px 2px rgba(0,0,0,.30);
  --shadow-2: 0 1px 2px rgba(0,0,0,.30), 0 6px 20px rgba(0,0,0,.28);
  --shadow-3: 0 2px 6px rgba(0,0,0,.30), 0 18px 48px rgba(0,0,0,.45);
}
html[data-theme="light"] {
  color-scheme: light;
  --bg: #FAFAF9;
  --surface-1: #FFFFFF;
  --surface-2: #F4F4F3;
  --surface-3: #EBEBEA;
  --hairline: rgba(10,10,12,.08);
  --hairline-strong: rgba(10,10,12,.14);
  --border-input: #8E8E95;
  --text: #0B0B0C;
  --text-2: #5F5F66;
  --accent: #4F46E5;
  --on-accent: #FFFFFF;
  --accent-soft: color-mix(in srgb, var(--accent) 12%, transparent);
  --danger: #D93036;
  --die-bg: #111113; --die-fg: #FAFAF9;
  --shadow-1: 0 1px 2px rgba(16,16,20,.06);
  --shadow-2: 0 1px 2px rgba(16,16,20,.06), 0 6px 20px rgba(16,16,20,.08);
  --shadow-3: 0 2px 6px rgba(16,16,20,.08), 0 18px 48px rgba(16,16,20,.16);
}
:root {
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI Variable Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter Display", "Inter", "Segoe UI Variable Display", "Segoe UI", Roboto, sans-serif;
  /* type scale: size / line-height */
  --fs-caption: 12px;  --lh-caption: 16px;   /* eyebrows: 600, uppercase, letter-spacing .06em, --text-2 */
  --fs-footnote: 13px; --lh-footnote: 18px;
  --fs-sub: 14px;      --lh-sub: 20px;
  --fs-body: 16px;     --lh-body: 24px;      /* inputs are always ≥ 16px (no iOS zoom) */
  --fs-title: 17px;    --lh-title: 22px;     /* top bar title, 600 */
  --fs-h2: 20px;       --lh-h2: 26px;        /* 600, -0.01em */
  --fs-large: 30px;    --lh-large: 36px;     /* Home large title, 700, -0.02em */
  --fs-display: clamp(56px, 17vw, 104px);    /* single result value, 600, -0.035em, tabular */
  /* spacing (4pt) */
  --sp-1: 4px; --sp-2: 8px; --sp-3: 12px; --sp-4: 16px; --sp-5: 20px; --sp-6: 24px; --sp-8: 32px; --sp-10: 40px; --sp-12: 48px;
  /* radius */
  --r-sm: 8px; --r-md: 12px; --r-lg: 16px; --r-xl: 20px; --r-2xl: 28px; --r-full: 999px;
  /* hairline width */
  --hair: 1px;
  /* motion */
  --ease-out: cubic-bezier(.22, 1, .36, 1);
  --ease-spring: cubic-bezier(.34, 1.36, .64, 1);   /* small overshoot */
  --dur-press: 120ms; --dur-1: 180ms; --dur-2: 240ms; --dur-3: 320ms;
}
@media (min-resolution: 2dppx) { :root { --hair: .5px; } }
```

Base rules:
- `body { font: var(--fs-body)/var(--lh-body) var(--font); background: var(--bg); color: var(--text); -webkit-font-smoothing: antialiased; font-feature-settings: "cv11", "ss01"; }`. The feature settings apply only when Inter is installed and are harmless otherwise.
- `.num, results, counters, steppers, dice, balls { font-variant-numeric: tabular-nums; }`.
- `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`.
- `::selection { background: var(--accent-soft); }`.
- Hairline borders are always `var(--hair) solid var(--hairline)`.

**Contrast (must hold; the reviewer spot-checks):**
- `--text` and `--text-2` are ≥ 4.5:1 on `--bg`, `--surface-1`, `--surface-2` and `--surface-3` in both themes. Computed values: dark text-2 is ≥ 5.9:1, light text-2 is ≥ 5.7:1.
- Accent text is ≥ 4.5:1 on all surfaces (dark ~6.3–7.2, light ~5.7–6.3).
- `--on-accent` on `--accent` is ≥ 4.5:1.
- Input and switch boundaries (`--border-input`) are ≥ 3:1.
- White labels on every `PALETTE` color are ≥ 4.5:1.

### 9.3 Icons (`js/ui.js`)
- Change the shared `svg()` wrapper to `stroke-width="1.5"`. All icons are redrawn or kept on a 24-unit grid with round caps and joins, 1.5px stroke, no fills except small dots.
- Rendered size: 20px in rows and tiles, 22px in the top bar, 18px in the search field and small buttons.
- `back` becomes a chevron: `<path d="M15 5l-7 7 7 7"/>`.
- New icons:
  - `chevron`: `<path d="M9 5l7 7-7 7"/>`
  - `search`: `<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>`
  - `share`: `<path d="M12 3v12M8 7l4-4 4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/>`
  - `paste`: `<rect x="8" y="3" width="8" height="4" rx="1.5"/><path d="M8 5H6.5A1.5 1.5 0 0 0 5 6.5v13A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 17.5 5H16"/>`
  - `teams`: `<circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.1a4.5 4.5 0 0 1 5 4.9"/>`
  - `shuffle`: `<path d="M3 7h3.5c2.2 0 3.6 1.2 4.7 3.2l1.6 3.6c1.1 2 2.5 3.2 4.7 3.2H21M3 17h3.5c1.4 0 2.5-.5 3.4-1.4M14.1 8.4c.9-.9 2-1.4 3.4-1.4H21M18 4l3 3-3 3M18 14l3 3-3 3"/>`
  - `wheel`: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.5"/><path d="M12 3v7.5M12 13.5V21M3 12h7.5M13.5 12H21M5.6 5.6l5.3 5.3M13.1 13.1l5.3 5.3"/>`
  - `lottery`: `<circle cx="8.5" cy="14.5" r="5.5"/><circle cx="16" cy="8.5" r="4.5"/><path d="M8 13l1-1v5M15.2 7.5h1.6l-1.2 3"/>`
  - `cards`: `<rect x="8" y="3" width="12" height="16" rx="2"/><path d="M8 6.5L4.6 7.4a1.5 1.5 0 0 0-1.1 1.8l2.9 10.6a1.5 1.5 0 0 0 1.8 1.1L13 19.6"/>`
- `refresh` is still used inside FABs. `star` stays filled. Keep every existing key so screens don't break.

### 9.4 Chrome
- **Top bar**:
  - Height 52px plus the safe area. The background is `color-mix(in srgb, var(--bg) 82%, transparent)` with `backdrop-filter: saturate(180%) blur(16px)` inside `@supports`. Without support it is a solid `--bg`.
  - `border-bottom: var(--hair) solid transparent`, which becomes `var(--hairline)` when `html[data-scrolled]`. `app.js` sets that attribute with a passive scroll listener (`scrollY > 4`) and clears it on route mount.
  - Title: `--fs-title`, weight 600, `--text`. Icon buttons are 44×44 hit areas with 22px icons in `--text-2`, pressed state `--surface-3`. A sound toggle that is on uses `--text`.
  - **Home** uses a large title: the `<h1>` is `--fs-large`/700/−0.02em, left-aligned in the content column under a 52px bar, with the settings button in the bar. Apply it via `.topbar.large`, which `topBar({ large: true })` sets.
- **Content column**: `max-width: 600px`, side padding `--sp-5` (20px), `--sp-4` under 360px.
- **Section label** (`.section-label`): the caption style, `margin: var(--sp-6) var(--sp-1) var(--sp-2)`.
- **Grouped card** (`.group`): `--surface-1`, radius `--r-lg`, `box-shadow: 0 0 0 var(--hair) var(--hairline) inset`, `overflow: hidden`, no drop shadow in dark and `--shadow-1` in light.
- **Toast**: a pill with radius `--r-full`, `--text` background, `--bg` text, `--fs-sub`/500, `--shadow-2`, padding 10px 16px. Entrance: opacity plus `translateY(6px)`, `--dur-1 --ease-out`.

### 9.5 Rows, Home and search
- **Tool row** (`.tool-row`): min-height 56px, padding `0 var(--sp-3) 0 var(--sp-4)`, gap `--sp-3`.
  - The icon tile (`.tile`) is 32×32, radius `--r-sm`, background `--surface-3`, with a 18px icon in `--text`. It is monochrome: accent tiles are not used.
  - The label is `--fs-body`/500 in sentence case. **Never uppercase.**
  - The trailing chevron is 18px in `--text-2`.
  - Rows are separated by a hairline inset from the label's left edge (60px), iOS-style: `.tool-row + .tool-row::before`, or a `border-top` on an inner wrapper.
  - `:active` sets the background to `--surface-3` (no scale).
- **Child row** (`.child-row`): min-height 48px, left padding 60px (aligned with the label). The name is 15px in `--text`, the summary `--fs-footnote` in `--text-2`, and the ⋮ button is 44px with an 18px icon in `--text-2`. There is a hairline above each child row, inset 60px.
- **`.child-more`**: the same height, `--fs-sub`, `--accent` text, left padding 60px.
- **Search** (`.search`): height 44px, radius `--r-md`, background `--surface-2`, border `var(--hair) solid var(--hairline)`, 18px icon in `--text-2` at 12px left, input padding-left 40px, `--fs-body`.
  - Focus: `border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft)`.
  - The placeholder is `--text-2`. Hide the native WebKit clear button.
  - `<mark>`: background `var(--accent-soft)`, `color: inherit`, radius 3px, padding 0 1px.
- **Search results** reuse `.group` and `.tool-row`, with a second-line `.row-sub` (`--fs-footnote`, `--text-2`).

### 9.6 Controls
- **FAB (labelled pill)**:
  - `fab({ label, icon = 'refresh' })` renders `[icon 20px] <span>label</span>`. The visible text *is* the label, so drop `aria-label`.
  - It is fixed and **centered**: `left: 50%; bottom: calc(env(safe-area-inset-bottom) + 20px); transform: translateX(-50%)`.
  - Size: height 52px, padding `0 var(--sp-6)`, min-width 148px, radius `--r-full`, `--accent` background, `--on-accent` text, `--fs-body`/600, `--shadow-3`.
  - Pressed: `transform: translateX(-50%) scale(.97)`.
  - Disabled: `opacity: .4; box-shadow: none`.
  - The v2 `html[data-below] .fab` fade still applies. The toast moves to `bottom: calc(env(safe-area-inset-bottom) + 88px)`.
  - Labels: Number and List "Generate", Dice "Roll", Coin "Flip", Lots "New round" (icon refresh), Teams "Split", Shuffle "Shuffle", Wheel "Spin", Lottery "Draw", Cards "Draw".
- **Buttons**:
  - `.btn`: height 44px, padding `0 var(--sp-4)`, radius `--r-md`, `--fs-body`/600, `--accent` text, transparent.
  - `.btn.filled`: accent background, on-accent text.
  - `.btn.tonal`: `--surface-2` background, `--text` text, hairline border.
  - `.btn.sm`: `min-height: 44px`, padding `0 14px`, `--fs-sub`/600, radius `--r-md`.
  - `.btn.danger-text` uses `--danger`.
  - Every `.btn`, `.pill`, `.chip` and `.icon-btn` gets `transition: transform var(--dur-press) var(--ease-out), background var(--dur-1)` and `:active { transform: scale(.97) }`.
- **Parameters pill** (`.pill`): height 40px within a 44px hit area, radius `--r-full`, `--surface-2` background, hairline border, `--text` text with a `--text-2` icon, `--fs-sub`/600.
- **Chips** (`.chip`, new): height 36px (44px hit via margin/padding), radius `--r-full`, `--surface-2`, hairline, `--fs-sub`/600. `[aria-pressed="true"]` uses `--text` background and `--bg` text.
- **Segmented** (`.segmented`/`.seg`, including Settings):
  - Track: `--surface-2`, radius `--r-md`, padding 3px, hairline.
  - Items: height 38px, `--fs-sub`/600 in `--text-2`.
  - Selected item: `--surface-1` background (light) or `--surface-3` (dark), `--text` text, `--shadow-1`, radius 9px, `transition: background var(--dur-1)`.
  - No accent fill.
- **Switch**:
  - 51×31. The off track is `--surface-3` with a `--border-input` hairline; the on track is `--accent`.
  - The thumb is 27px, white `#FFFFFF`, with `--shadow-1`, sliding via `transform` (`--dur-1 --ease-spring`).
  - The whole row stays clickable.
- **Stepper**: 44px circles with `--surface-2` background and a hairline border, 18px icons. The value is `--fs-body`/600, tabular, min-width 72px.
- **Text fields** (`.field`, `.textarea`, `select.field`): `--surface-2` background, border `1px solid var(--border-input)` (full token, ≥ 3:1), radius `--r-md`, padding 12px 14px, `--fs-body`. Focus state is the same as the search field.
- **Number big inputs**: `--font-display`, weight 300, letter-spacing −0.03em, `--text`. The focus underline is 2px `--accent`. The FROM/TO labels use the caption style.
- **No repeat card** (`.nr-card`): a `.group`-style card, min-height 56px. The counter is `--fs-sub`/600, tabular, `--text-2` when off.
- **Preset bar** (`.preset-bar`): `--surface-2`, radius `--r-lg`, hairline, padding `var(--sp-3) var(--sp-4)`, margin-bottom `--sp-3`.
- **Sheets**:
  - `--surface-1` in light and `--surface-2` in dark, radius `--r-xl --r-xl 0 0`, `--shadow-3`. The handle is 36×5 in `--hairline-strong`.
  - `::backdrop { background: rgba(0,0,0,.4); }`, plus `backdrop-filter: blur(2px)` inside `@supports`.
  - Entrance: `translateY(24px)` and opacity to none, `--dur-3 --ease-out`.
  - Title `--fs-h2`/600. Rows use hairline separators.
- **Confirm and prompt dialogs**: the same surfaces as sheets, radius `--r-xl`, width `min(88vw, 360px)`, padding `--sp-6`. Entrance: `scale(.96)` and opacity, `--dur-2 --ease-spring`.
- **Menu**: `--surface-2` (dark) or `--surface-1` (light), radius `--r-md`, hairline border, `--shadow-3`, padding 4px. Items are 44px, `--fs-body`, radius 8px, hover/active `--surface-3`. Entrance: opacity plus `scale(.98)` from the anchor corner, `--dur-1`.

### 9.7 Results and tool visuals
- **Result overlay**:
  - Backdrop `rgba(0,0,0,.5)`, with `backdrop-filter: blur(8px)` inside `@supports`.
  - **Result card**:
    - `--surface-1`, radius `--r-2xl`, `--shadow-3`, hairline ring, `width: min(84vw, 380px)`, `aspect-ratio: 1`, padding `--sp-6`.
    - Top-left **caption** (caption style) with the text from `showResult({ caption })` (tool or preset/list name), preceded by a 6px `--accent` dot.
    - Values are `--text` in `--font-display`/600, tabular, letter-spacing −0.03em.
    - Sizes: one short value (≤ 4 characters) uses `--fs-display`. Otherwise ≤ 12 characters → 44px, ≤ 40 → 30px, else 20px. Multi-value results keep the v1 flex-wrap; list picks stay one per line.
  - **No random background colors.** Remove the palette pick and `lastColor` from `showResult`. The v1 criterion "random vivid color" is superseded.
  - **Reveal**: on every show or regenerate, the card inner (`.result-inner`) plays `@keyframes reveal { from { opacity: 0; transform: translateY(8px) scale(.98); filter: blur(2px) } to { opacity: 1; transform: none; filter: none } }` for `--dur-2 --ease-spring`. The card itself fades in on first open only (`--dur-1`).
  - Under the card: `Copy` and (optionally) `Share` as `.btn.sm.tonal` icon+text buttons.
- **Dice**:
  - The face background is `--die-bg` (ivory on dark, graphite on light) with pips and numbers in `--die-fg`. Radius 24%.
  - `box-shadow: var(--shadow-2), inset 0 1px 0 rgba(255,255,255,.18), inset 0 -2px 0 rgba(0,0,0,.12)`.
  - Pips are 72% of their cell. There are no palette colors on dice.
  - The rolling wobble is reduced to ±8° and `scale(1.02)`.
  - Settle: each die plays `reveal` staggered 30ms by index.
- **Coin**:
  - Heads face: `radial-gradient(circle at 30% 25%, #FFFFFF 0%, #E4E4E7 45%, #A1A1AA 100%)` with `#0B0B0C` text.
  - Tails face: `radial-gradient(circle at 30% 25%, #5A5A63 0%, #2A2A2F 55%, #18181B 100%)` with `#F2F2F3` text.
  - Both use `inset 0 0 0 6px rgba(255,255,255,.10), var(--shadow-3)`. The letter is `--font-display`/600, 40% size. The label is caption style, letter-spacing .2em.
  - These are fixed colors (a physical object), the same in both themes. The contrast of each letter on its face is ≥ 7:1.
- **Coin stats**: two columns, each a big number (`--fs-h2`/600, tabular) above a caption ("HEADS · 40%"). A hairline divides them. Under them, the streak line.
- **Lots**:
  - Front: `--surface-2`, hairline, radius `--r-md`, "?" in `--text-2` 26px/500, number in the caption style.
  - Winner back: `--accent` with `--on-accent` star and "WIN".
  - Blank back: transparent with a 1px dashed `--hairline-strong` border and a `--text-2` dash.
- **Playing cards** (`.playing-card`):
  - 76×108px (64×90 under 360px), `#FFFFFF` in both themes, radius 10px, `0 0 0 1px rgba(0,0,0,.10)` ring plus `--shadow-2`.
  - Red suits `#C8102E`, black `#111113`. Corner text 15px/600 in `--font-display`, center suit 34px.
  - Each drawn card plays `reveal`, staggered 40ms.
- **Wheel**:
  - Segments use `PALETTE` (below). A rim circle `r=100`, `fill: none`, `stroke: var(--hairline-strong)`, `stroke-width: 1.5`.
  - The hub is `--surface-1` with `--shadow-2` and a hairline.
  - The pointer is a 16×20 triangle in `--text` with `--shadow-1`, overlapping the rim by 6px.
- **Lottery balls**: see §6.5 (monochrome main balls with `--text`/`--bg`, and accent bonus balls). 40px, `--font-display` 16px/600, `--shadow-1`.
- **Team cards**: `.group` style with padding `--sp-4`. The header is `--fs-sub`/600, and names use `--fs-body` with line-height 28px.
- **`PALETTE`** (replaces the v1 vivid palette; used only by the wheel segments and team dots; white text ≥ 4.5:1 on each):
  `['#4F46E5', '#0F766E', '#B45309', '#BE185D', '#1D4ED8', '#15803D', '#7C3AED', '#C2410C', '#334155', '#9F1239']`

### 9.8 Below-the-fold section, ad slot and footer
- `.below`: `max-width: 600px`, a top hairline, padding `var(--sp-10) var(--sp-5) calc(env(safe-area-inset-bottom) + var(--sp-10))`.
- Article:
  - h1 24px/650/−0.015em.
  - h2 `--fs-title`/600, margin-top `--sp-8`.
  - h3 `--fs-body`/600, margin-top `--sp-5`.
  - p `--fs-body`/1.65 in `--text-2`, max 68ch.
  - Links are `--accent` with no underline, underlined on hover.
- **Grouped nav** (§10.3): each group's `<h3>` uses the caption style, and each group's `<ul>` is a `.group`-style card with 44px link rows and inset hairlines. The same pattern is used for the home tool list.
- **Ad slot**: a `.group`-style card (`--surface-1`, hairline, radius `--r-lg`), centered, padding `--sp-3`, `min-height: 124px` (reserved as v2, so still zero CLS). The label "Advertisement" uses the caption style, 11px. The slot keeps the v2 collapse rules exactly.
- **Footer**: `--fs-footnote` in `--text-2`, links in `--text-2` (underlined on hover), a `·` separator, and 44px tall link hit areas as in v2.

### 9.9 Motion, reduced motion and performance
- **Press**: `scale(.97)` over `--dur-press`. **Reveal**: `--dur-2 --ease-spring`. **Sheets**: `--dur-3 --ease-out`. Nothing longer than 320ms, except the dice roll (500ms, v1), the coin flip (900ms, v1) and the wheel spin (4.4s).
- The existing `[data-motion="off"]` rule (animation and transition none) stays. Also add `[data-motion="off"] :active { transform: none !important; }` and `[data-motion="off"] .fab:active { transform: translateX(-50%) !important; }`. The JS motion checks (dice, coin, lots, wheel) are unchanged.
- **No layout shift**:
  - The FAB, toast and overlays are fixed.
  - The ad box is reserved.
  - The preset bar only appears after user input.
  - The search results replace the sections in the same column.
- Effects are limited to `transform`, `opacity` and `filter: blur` on small elements. `backdrop-filter` is used only on the top bar, overlay and sheet backdrop, each inside `@supports`.
- There are no box-shadow animations.

### 9.10 Brand: icon, og.png, theme-color
- **Theme color**:
  - The template `<meta name="theme-color">` default is `#0B0B0C`. The `app.js` fallback is `'#0B0B0C'`. `applyTheme` keeps reading `--bg`, so light gives `#FAFAF9`.
  - `manifest.webmanifest`: `background_color` and `theme_color` are `#0B0B0C`.
- **App icon** (`tools/make-icons.mjs` and `icons/icon.svg`; same geometry as v1, new colors, thinner ring):
  - The background is `#111113` (the `any` rounded rect r=112, and the full-bleed maskable/apple icons).
  - Ring stroke 28: inner radius 106, outer 134 (was 102/138). Arrowhead base width 76 (radius 82→158) and apex 56 ahead along the tangent. The arc spans are unchanged.
  - **Two-tone**: arc A (200°→330°) and its arrowhead are `#F2F2F3`. Arc B (20°→150°) and its arrowhead are `#8B93FF`.
  - Maskable and apple-touch still scale the glyph by 0.8. Update the coverage tests to use the new radii.
- **og.png** (`tools/make-og.mjs`):
  - The background is `#0B0B0C`. The bottom bar becomes 1200×4 in `#8B93FF`.
  - The icon is the new colors at the same position.
  - The "RANDOM" wordmark is `#F2F2F3` with the same bitmap geometry.
  - Motif row:
    - Die: `#F2F2F3` with `#0B0B0C` pips.
    - Coin: a circle in `#A1A1AA`.
    - Tile 1: `#8B93FF`.
    - Tile 2: `#26262A`.
- `build-pages.mjs` `og:image:alt` becomes "Random: number, dice, coin, list, wheel and team tools".

---

## 10. Landing pages and build

### 10.1 `js/site.js`
- `parsePreset(json)` keeps the v2 `number` and `list` shapes **exactly**. The existing tests stay valid.
- It adds **tool shapes** for `dice`, `lots`, `lottery` and `cards`: `{ <tool>: { ...partial } }`, where the object has exactly one top-level key, and that key is one of these tools.
  - Strict validation: `cleanConfig(tool, { ...CONFIG_DEFAULTS[tool], ...partial })` must be non-null.
  - Each present key must be a schema key. An unknown key is invalid (`null`).
  - It returns `{ <tool>: <the present keys, with the cleaned values> }`.
  - Teams, shuffle and wheel presets are **not** accepted. Their pages use the tool defaults (sample text), so a landing visit never overwrites the user's pasted text.
- `applyPreset()`: for a tool shape, if any present key differs from the working section, run `update(s => applyConfig(tool, s[tool], { ...extractConfig(tool, s[tool]), ...preset }))`.

### 10.2 `BUILTIN_LISTS` (in `js/tools.js`; pages-data imports it)

| id | name | items | extra search keywords |
|---|---|---|---|
| `preset-names` | Names | Alice, Bob, Charlie, Dana, Eli, Farah | names, name picker |
| `preset-yes-no` | Yes or No | Yes, No | yes no, decide |
| `preset-magic-8-ball` | Magic 8-ball | It is certain · It is decidedly so · Without a doubt · Yes definitely · You may rely on it · As I see it, yes · Most likely · Outlook good · Yes · Signs point to yes · Reply hazy, try again · Ask again later · Better not tell you now · Cannot predict now · Concentrate and ask again · Don't count on it · My reply is no · My sources say no · Outlook not so good · Very doubtful | 8 ball, eight ball, magic ball, fortune |
| `preset-rock-paper-scissors` | Rock paper scissors | Rock, Paper, Scissors | rps, rock, paper, scissors, hand game |
| `preset-letters` | Letters A–Z | A … Z (26 items) | letter, alphabet, a z |
| `preset-months` | Months | January … December | month, months, year |
| `preset-weekdays` | Days of the week | Monday … Sunday | day, weekday, week |

**Magic 8-ball decision**: it is a **list preset**, with no dedicated screen. The reasons: no new code, the answers stay editable, and the reveal is the existing result overlay (a large crisp answer with the "Magic 8-ball" caption), which already fits the premium result style. A dedicated 8-ball visual is left out (§14).

`list.js`/`list-edit.js` auto-create any `BUILTIN_LISTS` id on open (§5.2). v2 behaviour stays: visiting a list landing page adds the list, and edits are never overwritten.

### 10.3 Pages (`tools/pages-data.mjs`)

Every tool page (not home, not privacy) now needs `group` ∈ `GROUPS`, `nav` and `blurb`:
```js
export const GROUPS = [
  ['numbers', 'Numbers'],
  ['dice', 'Dice, coins & cards'],
  ['lists', 'Lists, names & teams'],
  ['answers', 'Answers & picks'],
];
```
PAGES order within a group is the order below. List presets reference `BUILTIN_LISTS` (e.g. `preset: { list: BUILTIN_LISTS['preset-magic-8-ball'] }` with `{ id, name, items }` only).

| slug | entry | preset | group | nav |
|---|---|---|---|---|
| random-number-generator | /number | – | numbers | Random number generator |
| ★ random-number-1-6 | /number | number 1–6 | numbers | Random number 1–6 |
| random-number-1-10 | /number | number 1–10 | numbers | Random number 1–10 |
| ★ random-number-1-50 | /number | number 1–50 | numbers | Random number 1–50 |
| random-number-1-100 | /number | number 1–100 | numbers | Random number 1–100 |
| ★ random-number-1-1000 | /number | number 1–1000 | numbers | Random number 1–1000 |
| ★ lottery-number-generator | /lottery | – | numbers | Lottery numbers |
| dice-roller | /dice | – | dice | Dice roller |
| ★ d4-dice-roller … ★ d20-dice-roller (d4, d6, d8, d10, d12, d20) | /dice | `{dice:{count:1,sides:N,modifier:0}}` | dice | D4 … D20 roller |
| coin-flip | /coin | – | dice | Coin flip |
| ★ draw-a-card | /cards | – | dice | Draw a card |
| random-name-picker | /list/preset-names | builtin | lists | Random name picker |
| ★ team-generator | /teams | – | lists | Team generator |
| ★ shuffle-list | /shuffle | – | lists | Shuffle a list |
| ★ spin-the-wheel | /wheel | – | lists | Spin the wheel |
| draw-lots | /lots | – | lists | Draw lots |
| yes-or-no | /list/preset-yes-no | builtin | answers | Yes or no |
| ★ magic-8-ball | /list/preset-magic-8-ball | builtin | answers | Magic 8-ball |
| ★ rock-paper-scissors | /list/preset-rock-paper-scissors | builtin | answers | Rock paper scissors |
| ★ random-letter-generator | /list/preset-letters | builtin | answers | Random letter |
| ★ random-month-generator | /list/preset-months | builtin | answers | Random month |
| ★ random-day-of-the-week | /list/preset-weekdays | builtin | answers | Random weekday |

The total is home + 27 tool pages + privacy = **29 HTML files**.

**Build changes (`build-pages.mjs`)**:
- **Validation**:
  - Every non-home tool page has a `nav`, a `blurb` and a valid `group`.
  - The list-preset entry check is unchanged.
  - For tool-shape presets, `entry === '/' + <tool>`.
  - Every preset passes `parsePreset`.
- **NAV**: `<nav class="other-tools" aria-label="Other tools"><h2>More random tools</h2>` then, per group that has at least one page other than the current one, `<h3>Group label</h3><ul>…</ul>`. After that comes `<ul><li><a href="{{BASE}}">All tools</a></li></ul>` (not on home).
- **Home tool list** (`toolList`): the same grouping inside the article, `<h2>All tools</h2>` + `<h3>` + `<ul class="tool-links">` with link and blurb.
- Everything else (escaping, sitemap with every page, robots, ads.txt, sw patch, deterministic output) is unchanged. The sitemap automatically lists all 29 URLs when `SITE_URL` is set.

### 10.4 Page copy (use as written; light edits OK)
Facts to keep true:
- Dice: 1–12 dice, d2–d100, modifier ±99, notation like 2d6+3.
- Teams: 2–50 teams or groups of 2–50.
- Wheel: 2–100 items, weights with `*3`.
- Lottery: pool up to 99, up to 10 numbers, up to 3 bonus balls, 1–10 lines.
- Cards: 52 cards plus 2 optional jokers, 1–10 per draw.
- Lists: 500 items, up to 20 picked. History: the last 20 results.
- Presets can be saved; links can be shared.

**Updated existing pages:**

*Home*
- description: `Free random tools in one app: numbers, dice, coin flip, name picker, spinning wheel, teams, lottery numbers and cards. Works offline.`
- intro 1: "Random is a small, fast app for everyday random choices: pick a number, roll any dice, flip a coin, choose names from a list, split people into teams, spin a wheel, draw lottery numbers or playing cards. It runs in your browser, works offline after the first visit and can be installed to your home screen."
- intro 2: unchanged.
- Add a FAQ: "Can I save my favourite settings?" → "Yes. Set up any tool, open the ⋮ menu and choose Save as preset. Your presets appear on the home screen under their tool, and search finds them instantly."

*random-number-generator*: add a FAQ: "Can I save a range I use often?" → "Yes. Choose Save as preset from the ⋮ menu, give it a name, and it appears under Number on the home screen. Share sends a link that opens the same settings."

*dice-roller*
- title: `Dice Roller: Roll Any Dice Online (d4 to d100, 2d6+3)`
- description: `Roll up to 12 dice online: d4, d6, d8, d10, d12, d20 or d100, with modifiers like 2d6+3 and an instant total. Free and works offline.`
- h1: `Dice roller`
- intro:
  1. "Choose how many dice to roll, from 1 to 12, and pick the type in Parameters: d4, d6, d8, d10, d12, d20 or d100. You can also type dice notation such as 2d6+3 or d20-1, and the total includes the modifier."
  2. "Six-sided dice show classic pips, and other dice show their number. Each die is rolled independently with an equal chance for every face, and the history keeps your last 20 rolls with the full breakdown."
- FAQ:
  - "Can I roll a d20?" → "Yes. Choose d20 in Parameters or type d20. There is also a dedicated d20 page."
  - "What does 2d6+3 mean?" → "Roll two six-sided dice, add them up, then add 3. The roller shows each die and the final total."
  - "How do I see previous rolls?" → "Tap the clock icon to see your last 20 rolls with totals."

*coin-flip*: add a FAQ: "Can I see how often I got heads?" → "Yes. Under the coin you see the heads and tails counts with percentages, your current streak and your longest streak. Reset tally starts over."

*random-name-picker*: add a FAQ: "Can I make one name more likely?" → "Yes. Add *2 or x3 after an item, like "Sam *3", to make it three times as likely. Type \x3 if you really mean the text x3."

**New pages:**

*random-number-1-6*
- title: `Random Number 1-6: Pick a Number from 1 to 6`
- description: `Pick a random number from 1 to 6, like rolling a die without the dice. Each number has an equal 1 in 6 chance. Free, fast and works offline.`
- h1: `Random number from 1 to 6`
- intro:
  1. "This page opens the number generator set to 1–6. Tap generate and you get a whole number from 1 to 6, each with exactly the same chance."
  2. "Use it in place of a missing die, to pick one of six options, or to decide turn order in a small group. Turn on No repeat to go through all six numbers once."
- FAQ:
  - "Is this the same as rolling a die?" → "Yes. Each number from 1 to 6 has a 1 in 6 chance, just like a fair die. For real dice with pips, use the dice roller."
  - "Can I get several numbers at once?" → "Yes. Set How many numbers in Parameters. With duplicates off, you can draw all six in random order."

*random-number-1-50*
- title: `Random Number Generator 1-50: Pick a Number from 1 to 50`
- description: `Get a random number between 1 and 50. Draw several at once or use No repeat for games and raffles with up to 50 tickets. Works offline.`
- h1: `Random number from 1 to 50`
- intro:
  1. "This page opens the number generator set to 1–50. Each number has exactly a 2% chance on every draw."
  2. "It suits classroom seat numbers, small raffles and quiz questions. Turn on No repeat to call each number once, and Sort results to list several draws in order."
- FAQ:
  - "How do I run a raffle with 50 tickets?" → "Turn on No repeat and generate once per prize. The counter shows how many tickets are left."
  - "Can I save 1–50 for next time?" → "Yes. Choose Save as preset in the ⋮ menu and it appears under Number on the home screen."

*random-number-1-1000*
- title: `Random Number Generator 1-1000: Pick from 1 to 1000`
- description: `Pick a random number from 1 to 1000 for giveaways, big raffles and guessing games. Draw up to 100 at once, sorted if you like. Works offline.`
- h1: `Random number from 1 to 1000`
- intro:
  1. "This page opens the number generator set to 1–1000. Every number has exactly a 1 in 1000 chance."
  2. "Use it to pick a comment or entry number in a giveaway, run a large raffle or play higher-or-lower. Draw up to 100 numbers at once, and No repeat makes sure no number comes up twice."
- FAQ:
  - "Can I pick several winners from 1000 entries?" → "Yes. Set How many numbers in Parameters. With duplicates off, every winner is a different number."
  - "Is every number equally likely?" → "Yes. The generator uses your device's secure random source with rejection sampling, so no number is favored."

*lottery-number-generator*
- title: `Lottery Number Generator: Random Lotto Numbers`
- description: `Generate random lottery numbers for 6/49, 5/69 + 1/26 and other formats, with bonus balls and up to 10 lines at once. Free and works offline.`
- h1: `Lottery number generator`
- intro:
  1. "Pick a format such as 6/49 or 5/69 + 1/26, or set your own: a main pool of up to 99 numbers, up to 10 numbers per line and up to 3 bonus balls from a separate or the same pool."
  2. "Each line is drawn without repeats and sorted, like a quick pick. Draw up to 10 lines at once, copy them, or save your format as a preset."
- FAQ:
  - "Does a random pick improve my odds?" → "No. Every combination is equally likely to be drawn, whether you choose it yourself or use a random pick. Play responsibly."
  - "What is a bonus ball?" → "Some lotteries draw extra numbers from a separate pool, like 1 from 26. Others draw the bonus from the main pool. Both are supported."

*d4-dice-roller*
- title: `D4 Dice Roller: Roll a 4-Sided Die Online`
- description: `Roll a d4 online: a fair four-sided die for tabletop RPG damage and board games. Add more dice or a modifier like 2d4+1. Works offline.`
- h1: `Roll a d4`
- intro:
  1. "This page opens the dice roller with one four-sided die. Tap the die or the roll button to get a number from 1 to 4."
  2. "The d4 is common in tabletop RPGs for daggers, small spells and healing potions. Add dice with the stepper or type notation such as 3d4+2 in Parameters."
- FAQ:
  - "Is each side equally likely?" → "Yes. Each result from 1 to 4 has a 25% chance."
  - "Can I roll several d4 at once?" → "Yes. Use the − and + buttons, up to 12 dice, and the total is shown under the dice."

*d6-dice-roller*
- title: `D6 Dice Roller: Roll a Six-Sided Die Online`
- description: `Roll a single six-sided die online with classic pip faces, or add more d6 for totals like 3d6. Every face has a fair 1 in 6 chance.`
- h1: `Roll a d6`
- intro:
  1. "This page opens the dice roller with one classic six-sided die with pips. Tap it to roll."
  2. "Add more dice for board games, or use notation like 3d6 or 2d6+1 for role-playing games. The total and each die's value are shown after every roll."
- FAQ:
  - "What's the difference from the dice roller page?" → "This page starts with a single d6. The dice roller keeps your last settings, such as 2d6 or a d20."
  - "Can I roll two dice?" → "Yes. Tap + to add dice, up to 12."

*d8-dice-roller*
- title: `D8 Dice Roller: Roll an 8-Sided Die Online`
- description: `Roll a d8 online for RPG weapon damage and healing rolls. Each face from 1 to 8 is equally likely, and 2d8+3 style modifiers work too.`
- h1: `Roll a d8`
- intro:
  1. "This page opens the dice roller with one eight-sided die. Each roll gives a number from 1 to 8."
  2. "Eight-sided dice are used for longswords, some spells and hit dice in tabletop RPGs. Type 2d8+3 or similar in Parameters to add dice and a bonus in one step."
- FAQ:
  - "How do I add a damage bonus?" → "Set the modifier in Parameters, or type notation such as d8+2. The total includes it."
  - "Are the results fair?" → "Yes. Each face has a 1 in 8 chance from a secure random source."

*d10-dice-roller*
- title: `D10 Dice Roller: Roll a 10-Sided Die Online`
- description: `Roll a ten-sided die online for RPGs and games. Roll one d10 or several with a total, or switch to d100 for percentile rolls. Works offline.`
- h1: `Roll a d10`
- intro:
  1. "This page opens the dice roller with one ten-sided die, numbered 1 to 10."
  2. "D10s are used in many role-playing systems and for percentile rolls. Choose d100 in Parameters for a number from 1 to 100 in a single roll."
- FAQ:
  - "Does the d10 show 0 or 10?" → "It shows 1 to 10. Every face is equally likely."
  - "Can I roll a pool of d10s?" → "Yes. Add up to 12 dice. Each value is shown along with the total."

*d12-dice-roller*
- title: `D12 Dice Roller: Roll a 12-Sided Die Online`
- description: `Roll a d12 online: a fair twelve-sided die for greataxe damage, hit dice or picking a month. Add dice or a modifier as you need.`
- h1: `Roll a d12`
- intro:
  1. "This page opens the dice roller with one twelve-sided die. Each roll gives a number from 1 to 12."
  2. "Use it for big weapon damage and barbarian hit dice, or any choice among twelve options. Notation such as 2d12+4 works in Parameters."
- FAQ:
  - "Is each number equally likely?" → "Yes. Every face has a 1 in 12 chance."
  - "Can I save a d12 roll I use a lot?" → "Yes. Set it up, then choose Save as preset from the ⋮ menu."

*d20-dice-roller*
- title: `D20 Dice Roller: Roll a 20-Sided Die Online`
- description: `Roll a d20 online for D&D checks, attacks and saving throws. Add a modifier like d20+5, roll several d20s at once and see the total.`
- h1: `Roll a d20`
- intro:
  1. "This page opens the dice roller with one twenty-sided die. Tap it to roll a number from 1 to 20."
  2. "Add your bonus with the modifier, for example d20+5 for an attack roll. For advantage, roll 2 dice and use the higher one. Save your usual rolls as presets for quick access."
- FAQ:
  - "Is a natural 20 as likely as any other roll?" → "Yes. Every face from 1 to 20 has exactly a 5% chance."
  - "How do I add my modifier?" → "Open Parameters and set the modifier, or type notation like d20+5. The total includes it."

*draw-a-card*
- title: `Draw a Card: Random Playing Card Generator`
- description: `Draw random playing cards from a shuffled 52-card deck, with optional jokers. Draw one or several and keep going until the deck runs out.`
- h1: `Draw a card`
- intro:
  1. "Tap draw to take a card from a shuffled standard deck of 52. With No repeat on, the deck works like a real one: drawn cards stay out and the counter shows how many are left."
  2. "Draw up to 10 cards at once for a quick hand, add two jokers in Parameters, and reshuffle at any time from the menu next to the counter."
- FAQ:
  - "Can the same card come up twice?" → "Not while No repeat is on, until the deck is reshuffled. With it off, every draw uses a full deck."
  - "Are jokers included?" → "Only if you turn on Include 2 jokers in Parameters."

*team-generator*
- title: `Random Team Generator: Split Names into Teams`
- description: `Paste a list of names and split them into random, balanced teams or groups of a set size. Copy the teams in one tap. Free and works offline.`
- h1: `Random team generator`
- intro:
  1. "Paste names one per line, or pick one of your saved lists, then choose either a number of teams or a group size. Tap split to shuffle everyone into balanced teams."
  2. "Team sizes never differ by more than one person. Copy the result to share it in a chat, or save the setup as a preset for your weekly game or class."
- FAQ:
  - "What if the names don't divide evenly?" → "Some teams get one extra person. Sizes never differ by more than one."
  - "Can I paste a comma-separated list?" → "Yes. Tap Paste to import from your clipboard. Commas, semicolons or new lines all work."

*shuffle-list*
- title: `Shuffle a List: Put Items in Random Order`
- description: `Paste a list and shuffle it into a random order, numbered and ready to copy. Perfect for turn order, presentation slots and playlists.`
- h1: `Shuffle a list`
- intro:
  1. "Paste your items one per line, or choose a saved list, then tap shuffle. You get the whole list in a new random order, numbered from 1."
  2. "Every possible order is equally likely. Use it for speaking order, game turns, task rotation or study questions, and copy the numbered result with one tap."
- FAQ:
  - "Is every order equally likely?" → "Yes. The list is shuffled with the Fisher–Yates method using a secure random source."
  - "Can I shuffle one of my saved lists?" → "Yes. Switch the source to Saved list and choose it. The saved list itself is not changed."

*spin-the-wheel*
- title: `Spin the Wheel: Random Wheel Spinner for Names`
- description: `Add names or choices, spin the wheel and see where it lands. Up to 100 items, colored segments and weighted entries. Free, works offline.`
- h1: `Spin the wheel`
- intro:
  1. "Type your options one per line, or use a saved list, and tap spin. The winner is picked fairly before the wheel starts turning, then the wheel eases to a stop on it."
  2. "Add *2 or x3 after an item to give it a bigger slice and a proportionally higher chance. The wheel holds up to 100 items, and labels are hidden only when slices get too thin to read."
- FAQ:
  - "Is the wheel fair?" → "Yes. Each item's chance matches its slice. The result is chosen with a secure random source, and the animation only shows it."
  - "Can I turn off the animation?" → "Yes. With Animations off in Settings, or reduced motion on your device, the result appears instantly."

*magic-8-ball*
- title: `Magic 8-Ball Online: Ask a Question, Get an Answer`
- description: `Ask the magic 8-ball a yes-or-no question and get one of the 20 classic answers at random. Edit the answers to make your own. Works offline.`
- h1: `Magic 8-ball`
- intro:
  1. "Think of a yes-or-no question, then tap the button. The 8-ball answers with one of its 20 classic replies, from It is certain to Very doubtful."
  2. "Ten answers are positive, five are non-committal and five are negative, just like the original toy. Edit the list from the ⋮ menu to add your own answers."
- FAQ:
  - "Are all answers equally likely?" → "Yes. Each of the 20 answers has a 1 in 20 chance."
  - "Can I change the answers?" → "Yes. Choose Edit list from the ⋮ menu. Your changes are saved on your device."

*rock-paper-scissors*
- title: `Rock Paper Scissors Generator: Random Hand Picker`
- description: `Let the app throw rock, paper or scissors for you, each with a fair 1 in 3 chance. Great for settling decisions or playing solo. Works offline.`
- h1: `Rock paper scissors`
- intro:
  1. "Tap the button and the app throws rock, paper or scissors. Play against it, or let two people each tap once and compare."
  2. "Rock beats scissors, scissors beats paper and paper beats rock. Each throw is independent, so there is no pattern to exploit."
- FAQ:
  - "Is the computer's throw random?" → "Yes. Each throw has an equal 1 in 3 chance and does not depend on earlier throws."
  - "Can I add lizard and Spock?" → "Yes. Edit the list from the ⋮ menu and add them."

*random-letter-generator*
- title: `Random Letter Generator: Pick a Letter from A to Z`
- description: `Pick a random letter from A to Z for word games, category rounds and name ideas. Use No repeat to go through the whole alphabet once.`
- h1: `Random letter generator`
- intro:
  1. "Tap the button to get a random letter from A to Z. Each of the 26 letters has the same chance."
  2. "Use it for category word games, alphabet challenges or picking an initial. Turn on No repeat to work through all 26 letters without duplicates, or edit the list to remove hard letters."
- FAQ:
  - "Can I skip letters like Q and X?" → "Yes. Edit the list from the ⋮ menu and delete them."
  - "Can I get several letters at once?" → "Yes. Set How many to pick in Parameters, up to 20 different letters."

*random-month-generator*
- title: `Random Month Generator: Pick a Month of the Year`
- description: `Pick a random month from January to December for planning, writing prompts or games. Each month has an equal 1 in 12 chance. Works offline.`
- h1: `Random month generator`
- intro:
  1. "Tap the button to pick one of the twelve months at random."
  2. "Use it for birthday guessing games, story prompts, deciding when to plan a trip, or assigning months to people. No repeat hands out every month once."
- FAQ:
  - "Is every month equally likely?" → "Yes. Each month has a 1 in 12 chance, whatever its number of days."
  - "Can I pick a random date instead?" → "Pick a month here, then use the number generator from 1 to 31 for the day."

*random-day-of-the-week*
- title: `Random Day of the Week Generator: Pick a Weekday`
- description: `Pick a random day of the week from Monday to Sunday. Use it to schedule chores, pick a meeting day or plan a date night. Free, works offline.`
- h1: `Random day of the week`
- intro:
  1. "Tap the button to get a random day from Monday to Sunday."
  2. "Use it to share out chores, choose a day for a meetup or add some surprise to your plans. Remove Saturday and Sunday from the list for weekdays only."
- FAQ:
  - "Can I pick only weekdays?" → "Yes. Edit the list from the ⋮ menu and remove Saturday and Sunday."
  - "Can I assign each day once?" → "Yes. Turn on No repeat and each day comes up once before the list starts over."

`build-pages.mjs` enforces descriptions of 50–160 characters. If any line above fails, trim it minimally.

---

## 11. PWA

- **`sw.js` PRECACHE**: add these after `'./js/ads.js'` and before the build marker:
  `'./js/tools.js'`, `'./js/parse.js'`, `'./js/search.js'`, `'./js/presets.js'`, `'./js/screens/source.js'`, `'./js/screens/teams.js'`, `'./js/screens/shuffle.js'`, `'./js/screens/wheel.js'`, `'./js/screens/lottery.js'`, `'./js/screens/cards.js'`.
  - The build regenerates the pages block (27 tool pages plus privacy), fails on a missing file, recomputes the `CACHE` content hash, and emits `modulepreload` for every module automatically.
  - Do not hand-edit `CACHE`.
- **Manifest**:
  - `description`: "Random number generator, dice roller, coin flip, name picker, spinning wheel, teams and more. Works offline."
  - Colors as in §9.10.
  - `shortcuts` (4): Number `./#/number`, Dice `./#/dice`, Coin `./#/coin`, Wheel `./#/wheel`. Cast lots is dropped.
- Offline: every new route and page works offline after the first visit (everything is precached).

---

## 12. Accessibility

- Every new icon-only button has an `aria-label`: ⋮ "Tool options", "Options for <name>", "Clear search", "New list".
- Visible-text buttons (FAB, Copy, Share, Paste) need no label.
- The search field has an `aria-label`. The results list is labelled, and its count is announced (debounced). `<mark>` is decorative.
- Show all/Show less uses `aria-expanded`.
- The preset bar text is `aria-live="polite"`.
- Segmented controls use `role="radiogroup"` with `radio` items, roving tabindex and arrow keys (the `ui.segmented` helper copies the Settings pattern).
- Chips use `aria-pressed`.
- Wheel: `role="img"` with an `aria-label`. The result line is `aria-live`, plus `announce()`.
- Dice, cards and lottery lines are `role="img"` with full `aria-label`s. Team sections are labelled by their headings.
- The prompt dialog's input is labelled. Focus returns to the invoking control on close (native `<dialog>`).
- Contrast is AA in both themes (§9.2). Touch targets are ≥ 44px. Focus rings are visible.
- Reduced motion or Animations off: wheel, dice, coin and lots all resolve instantly, and there is no reveal or press scale.

---

## 13. Tests

Create `tests/v3.test.mjs` (`node tests/v3.test.mjs`) with the same mini `test()` harness.
- **Weighted parser**:
  - `Pizza *3` → `{Pizza, 3}`. `Pizza x3` and `Pizza X3` → weight 3.
  - `Pizza*3`, `Pizza * 3`, `Pizza x 3`, `*3`, `Pizza x0` and `Pizza x101` are literal with weight 1.
  - `Size \x3` → `{ 'Size x3', 1 }`. `Pizza *100` → 100.
- **splitImport**: `"a, b;c\td"` → 4 items. `"a,b\nc"` → `['a,b', 'c']`. Blanks are dropped.
- **Dice notation**:
  - `2d6+3`, `d20`, `3D8-2`, ` 2 d 6 + 3 `, `2d6−1` (U+2212) and `12d100-99` are valid with the right values.
  - `''`, `d`, `0d6`, `13d6`, `2d1`, `2d101`, `2d6+100`, `2d6+1d4` and `abc` return `null`.
  - `formatDice` round-trips each valid case.
- **drawWeighted**:
  - Weights `[1, 3]`: over 40k single draws, index 1 is 75% ± 2%.
  - With noRepeat over 5 items with mixed weights, 5 draws give a permutation of 0–4, and the 6th resets with the note.
  - `count > remaining` is capped with a note.
- **Lottery**: 2,000 draws each of `6/49`, `5/69 + 1/26` (separate) and `6/49 + 1 same pool`:
  - main has the right length, is distinct, sorted and in range.
  - bonus is in range.
  - same-pool bonus is disjoint from main.
- **Team split**:
  - `splitTeams(10 names, 'teams', 3)` gives sizes `[4, 3, 3]` in some order.
  - `('size', 4)` gives 3 teams with max ≤ 4.
  - `('teams', 50)` with 5 names gives 5 teams of 1.
  - The union equals the input multiset.
  - Sizes differ ≤ 1 over 500 random runs.
- **Shuffle uniformity (sanity)**: 60,000 shuffles of `[0, 1, 2]`. Each of the 6 permutations is within ±5% of 10,000.
- **tools.js**:
  - `cleanConfig` strict rejects `{ from: 1.5 }`, `{ count: 0 }`, `{ sides: 1 }`, `{ mode: 'x' }` and a non-object.
  - Lenient returns defaults for the same inputs.
  - The fixes: number swap, noRepeat off for a range > 100k, lots k clamp, lottery bonus clamp for both pool kinds.
  - `applyConfig` returns true or false correctly and resets pools per §2.1.
  - For list tools with source list, `applyConfig` keeps `text`.
- **Share params**:
  - The round-trip `fromParams(tool, new URLSearchParams(toParams(tool, cfg).query))` deep-equals `cfg` for every CONFIG_TOOL (list tools with `source: 'paste'`).
  - `null` for `v=2`, `from=abc`, `from=1e3`, `count=101`, `sortx` ignored but `sort=yes` invalid, and `text` > 10,000 characters.
  - `source=list&listId=x` is ignored, so the result is paste.
  - Truncation to 100 lines sets `truncated`.
- **Search ranking** (index from `normalize(null)` plus one preset `{ tool: 'dice', name: 'Fireball', config: { count: 8, sides: 6, modifier: 0 } }`):
  - `co` → first is Coin.
  - `d20` → first is shortcut `d20`, and Dice is in the results.
  - `teams` → first is Teams.
  - `8 ball` → the results include Magic 8-ball.
  - `yes no` → the results include Coin and Yes or No.
  - `fire` → Fireball.
  - `dice` → Dice first, and Fireball present.
  - `ice` → Dice is a substring match ranked below any prefix matches.
  - `''` → `[]`. `zzz` → `[]`.
  - Results are capped at 20.
- **Store migration v1 → v2**:
  - A realistic v1 object (version 1, custom number, two lists with drawn, dice `{count: 3, values: [2, 5, 6]}`, coin tallies, history) normalizes to version 2.
  - Lists and history are preserved. Dice gets `sides: 6, modifier: 0` with values kept. `presets: []`. The new sections equal their defaults. The coin gains `run/best/bestFace`.
  - An unversioned object is treated like v1.
  - Bad presets (unknown tool, bad id, duplicate id, empty name, 25 dice presets) are dropped or capped to 20.
  - A preset config with invalid fields becomes a lenient config.
  - `normalize(null)` still deep-equals DEFAULTS.

`tests/site.test.mjs` updates:
- The expected HTML count is `PAGES.length` (import pages-data), i.e. 29.
- `parsePreset` accepts `{ dice: { count: 1, sides: 20, modifier: 0 } }` → the same object, and `{ lottery: { n: 69, k: 5 } }`.
- It rejects `{ dice: { sides: 1 } }`, `{ dice: { foo: 1 } }`, `{ dice: {}, number: {} }` and `{ teams: { n: 3 } }`.
- The build must fail if a page lacks a group (validation only; no test needed).

`tests/rng.test.mjs` is unchanged and must pass. README test line: `node tests/rng.test.mjs && node tests/site.test.mjs && node tests/v3.test.mjs`.

---

## 14. Deliberately left out
- Folding saved lists into presets (§3.8). Per-preset history or no-repeat pools. Preset reordering, folders or pinning. Import/export of presets or data files.
- Cross-tab sync (`storage` events) and protection against an old cached tab overwriting v2 data.
- Multi-term dice notation (`2d6+1d4`), advantage/disadvantage, exploding dice, keep-highest.
- Wheel elimination mode (remove the winner), tick sounds while spinning, label flipping on the left half, more than 100 items.
- A dedicated magic 8-ball visual (it is a list preset).
- Skill-balanced or weighted teams. Saving shuffle orders.
- Custom card decks, card images, dealing to multiple players.
- Lottery ticket checking, jackpot data, named lottery brands in the UI beyond format strings.
- Fuzzy or typo-tolerant search, searching list item contents or landing-page text, search history.
- QR codes, URL shorteners, sharing results as images.
- Webfonts, custom illustrations, a light/dark accent picker, custom themes.
- i18n, analytics, SW update prompt (unchanged).

---

## 15. Acceptance criteria

**Presets**
- [ ] Number set to 1–12, count 3, sort on → ⋮ → Save as preset… → name "D12 three" → the route becomes `#/number/p/<id>` with that title. Home shows "D12 three · 1–12 · 3 numbers" as a child row under Number.
- [ ] Opening the preset loads its settings. Changing To shows the preset bar. Update saves (the bar hides and a reload keeps it), Save as new creates a second preset and navigates to it, and Revert restores the preset values in the inputs.
- [ ] Reopening an unchanged preset keeps its no-repeat pool, and opening a different preset resets it.
- [ ] Home row ⋮: Rename (prompt, Enter submits, empty disabled), Edit (opens the preset with Parameters open), and Delete (confirm; the row disappears).
- [ ] Presets work for Number, Dice, Cast lots, Teams, Shuffle, Wheel, Lottery and Cards. Coin has no "Save as preset". Lists have Rename/Edit/Delete.
- [ ] The 21st preset for a tool is refused with a toast. With more than 5 children, a tool shows "Show all (N)", which toggles.
- [ ] An unknown preset id shows "Preset not found" and goes to the tool route. A preset whose saved list was deleted opens with "The saved list was deleted".
- [ ] v1/v2 data loads without loss (lists, history, settings, number/dice/coin/lots), and `version` becomes 2.

**New tools**
- [ ] Teams: 10 names / 3 teams → sizes 4/3/3. Group size 4 → 3 groups. Copy gives "Team 1: …" lines. A saved list works as the source. Fewer than 2 names shows a toast.
- [ ] Shuffle: a numbered permutation of every item. Copy works.
- [ ] Wheel:
  - 2–100 items with colored segments.
  - Labels are readable and hidden when a segment is < 5.5°.
  - The spin eases out over ~4.4s and stops with the chosen segment under the top pointer (the landing item always equals the announced and history result).
  - Animations off or reduced motion → instant.
  - `Pizza *3` gets 3× the angle.
  - More than 100 items shows the note.
- [ ] Lottery: the format chips fill the config. 6/49 and 5/69 + 1/26 give correct, sorted, distinct numbers. The same-pool bonus never repeats a main number. Lines 1–10 work.
- [ ] Cards: suits in red and black with text glyphs (no emoji rendering on iOS), jokers optional. The no-repeat counter shows "N left", reshuffles on empty with a toast, and Reshuffle in the menu works.

**QoL**
- [ ] List items `Pizza *3` show "Pizza" with a ×3 badge, and over many picks Pizza is about 3× as frequent. With No repeat, each entry still appears once per cycle. `Size \x3` shows "Size x3".
- [ ] Dice: d4–d100 chips, notation `2d6+3` applies (invalid input reverts with a toast), non-d6 dice show numbers, the total includes the modifier, and history reads `2d6+3: 4 + 5 + 3 = 12`. 1–12 dice.
- [ ] Coin shows counts, percentages, the current streak and the longest streak. Reset clears them all.
- [ ] Share: on mobile it opens the native share sheet, on desktop it copies text plus a link. Opening the link in a fresh profile reproduces the config (not the result), and the query is stripped from the URL. A tampered link (`to=abc`) shows "This link has invalid settings" and changes nothing. Share list opens a prefilled editor that saves only on Save.
- [ ] Paste imports comma- or newline-separated clipboard text into the list editor and the source cards. A denied clipboard shows the fallback toast.

**Search**
- [ ] The search field is at the top of Home. `/` focuses it. Typing filters instantly with no network requests (DevTools Network stays empty).
- [ ] "d20", "coin", "teams", "8 ball", "yes no" and a preset's name all return the expected first or included results, with highlighted matches.
- [ ] Enter opens the first result, arrows move through the results, Escape clears, and the clear button works. A no-match query shows the empty state and "No results" is announced.

**Landing pages & build**
- [ ] `node tools/build-pages.mjs` writes 29 HTML files, and a second run changes nothing. With `SITE_URL` set, the sitemap has 29 URLs.
- [ ] `/d20-dice-roller/` opens one d20 showing a number face. `/random-number-1-1000/` shows 1–1000. `/magic-8-ball/` opens the 20-answer list. `/team-generator/`, `/shuffle-list/`, `/spin-the-wheel/`, `/lottery-number-generator/` and `/draw-a-card/` open their tools.
- [ ] Every page has a unique title and description (50–160 characters), 2+ intro paragraphs and 2+ FAQs, and a grouped "More random tools" nav without a self link.
- [ ] The manifest has 4 shortcuts (Number, Dice, Coin, Wheel) and the new colors.

**Redesign (all screens, v1/v2 and v3)**
- [ ] The tokens in §9.2 are used everywhere. There are no hard-coded colors in components, except the coin faces, playing cards, `PALETTE` and the icon/og generators. No leftover cyan `#4DD0E1`, `#00838F` or `#00ACC1` remains anywhere in css/js/icons/manifest/template.
- [ ] Home has no watermark icons and no uppercase card labels. It has grouped rows with 32px monochrome tiles, sentence-case labels, chevrons and inset hairlines. The large title "Random" is shown.
- [ ] The result overlay shows a neutral card with an accent-dot caption and large display numerals, and no random colors. The reveal animation is ≤ 240ms.
- [ ] The FAB is a centered labelled pill (e.g. "Roll", "Spin"). Press feedback scales to .97. None of it happens with reduced motion.
- [ ] Dice are monochrome (ivory on dark, graphite on light). The coin faces are silver and graphite. Lots and cards match §9.7.
- [ ] Sheets, menus, dialogs, toasts, switches, segmented controls, steppers, fields, the article, nav, ad slot and footer match §9.4–§9.8 in both themes.
- [ ] Every icon uses a 1.5px stroke. The back arrow is a chevron.
- [ ] Contrast spot-checks with DevTools meet AA:
  - `--text-2` on each surface in both themes
  - accent text on `--surface-2`
  - `--on-accent` on `--accent`
  - white on each `PALETTE` color
  - `--border-input` ≥ 3:1
- [ ] The theme-color meta is `#0B0B0C` in dark and `#FAFAF9` in light. The regenerated icons (two-tone ring on `#111113`) and og.png use the new brand, `file icons/*.png og.png` reports the correct sizes, and `icons/icon.svg` matches the PNGs.
- [ ] Lighthouse mobile on `/` and `/coin-flip/`: CLS = 0, no console errors, and no webfont or new third-party requests.

**Regression & quality**
- [ ] Every v1/v2 criterion still passes, except those explicitly superseded: "random vivid result color", "LIST card with + in header" (now the List row with a + button), "Dice 1–6" (now 1–12), dice history format, and "Manifest shortcuts include Cast lots".
- [ ] `node --check` passes on every JS/MJS file. `node tests/rng.test.mjs`, `node tests/site.test.mjs` and `node tests/v3.test.mjs` all pass.
- [ ] There is no `Math.random` in `js/`. The only `innerHTML` is in `ui.icon()`. User text containing `<img src=x onerror=alert(1)>` renders literally in: preset names, list names, search results, the wheel, teams, shuffle and cards.
- [ ] No horizontal scroll at 320px on any screen. Offline reload works on every new route and page after the first visit.
