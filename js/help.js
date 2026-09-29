// Help for every in-app screen. The "?" button opens either the page's static #help dialog
// (SEO copy, on the page's own entry route) or a sheet built from HELP.
import { h, iconButton, openSheet } from './ui.js';
import { getEntry } from './site.js';
import { currentPath } from './router.js';
import { TIP_URL, TIP_LABEL } from './config.js';

export const HELP = {
  home: {
    title: 'Random',
    intro: 'Fair random tools that work offline.',
    steps: [
      'Tap a tool to start.',
      'Search finds tools, presets and lists: try d20 or coin.',
      "Save any tool's setup from its ⋮ menu; it appears under Saved.",
    ],
    faq: [
      ['Is it really random?', 'Yes. Results come from crypto.getRandomValues with rejection sampling, so every outcome is equally likely.'],
      ['Where is my data?', "Only on this device, in your browser's storage."],
    ],
  },
  number: {
    title: 'Number',
    intro: 'Pick whole numbers in any range.',
    steps: [
      'Set From and To (up to ±1,000,000,000).',
      'Parameters: how many (up to 100), sort, duplicates.',
      'No repeat draws each number once until the pool runs out.',
    ],
    faq: [['Earlier results?', 'Tap the clock icon for the last 20.']],
  },
  list: {
    title: 'List',
    intro: 'Pick items from this list.',
    steps: [
      'Tap Generate.',
      'Parameters sets how many to pick (up to 20).',
      'No repeat goes through every item once. Edit the list from ⋮.',
    ],
    faq: [['Can some items be more likely?', 'Yes: add a space and *3 after an item in the editor, like Pizza *3.']],
  },
  listEdit: {
    title: 'Editing a list',
    intro: '',
    steps: [
      'One item per line, up to 500.',
      'Paste adds items split on commas, tabs or new lines.',
      'Add a space and *3 after an item (Pizza *3) to make it 3× as likely.',
    ],
    faq: [],
  },
  lists: {
    title: 'Lists',
    intro: '',
    steps: [
      'Tap a list to pick from it.',
      'New list creates one; ⋮ on a row renames, edits or deletes it.',
      'Ready-made lists are saved the first time you open them.',
    ],
    faq: [],
  },
  dice: {
    title: 'Dice',
    intro: '',
    steps: [
      'Tap Roll or the dice.',
      'Tap the notation chip (like 2d6+3) for sides and modifier.',
      'The stepper sets 1–12 dice.',
    ],
    faq: [['Which dice?', 'd2 to d100, a modifier from −99 to +99.']],
  },
  coin: {
    title: 'Coin',
    intro: '',
    steps: [
      'Tap Flip or the coin.',
      'The tally shows heads, tails and streaks; Reset tally clears it.',
    ],
    faq: [['Is it 50/50?', 'Yes, exactly.']],
  },
  lots: {
    title: 'Cast lots',
    intro: '',
    steps: [
      'Tap a lot to reveal it; a star marks a winner.',
      'Parameters sets 2–30 lots and the number of winners.',
      'New round hides new winners.',
    ],
    faq: [],
  },
  teams: {
    title: 'Teams',
    intro: '',
    steps: [
      'Tap the names row to paste names or choose a saved list.',
      'Split into a number of teams or by group size.',
      'Tap Split; team sizes differ by at most one.',
    ],
    faq: [],
  },
  shuffle: {
    title: 'Shuffle',
    intro: '',
    steps: [
      'Tap the items row to add items or choose a saved list.',
      'Tap Shuffle; every order is equally likely.',
    ],
    faq: [],
  },
  wheel: {
    title: 'Wheel',
    intro: '',
    steps: [
      'Tap the items row to edit the wheel (up to 100 items).',
      'Add a space and *3 after an item (Pizza *3) for a 3× bigger slice.',
      'Tap Spin; the result is chosen fairly before the wheel moves.',
    ],
    faq: [['Why is the spin shorter sometimes?', 'Your device asks for less motion. Settings → Animations turns motion off entirely.']],
  },
  lottery: {
    title: 'Lottery',
    intro: '',
    steps: [
      'Pick a format chip, or set your own in Parameters.',
      'Draw up to 10 lines, with bonus balls from the same or a separate pool.',
    ],
    faq: [['Does it improve my odds?', "No. Random picks don't change your odds. Play responsibly."]],
  },
  cards: {
    title: 'Cards',
    intro: '',
    steps: [
      'Tap Draw; Parameters sets 1–10 cards and jokers.',
      'No repeat (deck) deals from one deck until you reshuffle.',
    ],
    faq: [],
  },
};

const privacyHref = () => new URL('../privacy/', import.meta.url).href;

function helpFoot() {
  return h('p', { class: 'help-foot' },
    h('a', { attrs: { href: privacyHref() }, text: 'Privacy' }),
    TIP_URL ? ' · ' : null,
    TIP_URL ? h('a', { attrs: { href: TIP_URL, target: '_blank', rel: 'noopener' }, text: TIP_LABEL }) : null);
}

function helpBody(entry) {
  return h('div', { class: 'help-doc' },
    entry.intro ? h('p', { text: entry.intro }) : null,
    h('ol', { class: 'help-steps' }, ...entry.steps.map((t) => h('li', { text: t }))),
    entry.faq.length ? h('h3', { text: 'Questions' }) : null,
    ...entry.faq.flatMap(([q, a]) => [h('h3', { text: q }), h('p', { text: a })]),
    helpFoot());
}

let staticWired = false;

export function openHelp(key, { title } = {}) {
  const dlg = document.getElementById('help');
  if (dlg && dlg.tagName === 'DIALOG' && currentPath() === getEntry()) {
    if (!staticWired) {
      staticWired = true;
      dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); });
    }
    dlg.scrollTop = 0;
    if (!dlg.open) dlg.showModal();
    // showModal focuses the first link (and scrolls to it); start at the top instead.
    dlg.querySelector('h1')?.focus({ preventScroll: true });
    dlg.scrollTop = 0;
    return;
  }
  const entry = HELP[key] || HELP.home;
  openSheet({ title: title || entry.title, body: helpBody(entry) });
}

export function helpButton(key, opts) {
  const b = iconButton({ icon: 'help', label: 'Help', onClick: () => openHelp(key, opts) });
  b.setAttribute('aria-haspopup', 'dialog');
  return b;
}
