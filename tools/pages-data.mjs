// Page data for tools/build-pages.mjs. All copy is plain text; the build escapes it.
export const SITE_NAME = 'Random';

export const ADS_PRIVACY = "This site shows ads from Google AdSense. Google and its partners may use cookies or similar technologies to show ads and measure them, based on your visits to this and other websites. Visitors in the EEA, the UK and Switzerland are asked for consent through Google's consent message. You can manage ad personalization at https://adssettings.google.com. To learn more, see https://policies.google.com/technologies/partner-sites.";

export const PAGES = [
  {
    slug: '', entry: '/', preset: null, tool: true,
    blurb: 'All tools in one app.',
    title: 'Random: Number Generator, Coin Flip, Dice & Name Picker',
    description: 'Free random tools in one fast app: pick a number, flip a coin, roll dice, pick names from a list or draw lots. Works offline, no sign-up.',
    h1: 'Random: simple, fair random tools',
    intro: [
      'Random is a small, fast app for everyday random choices: pick a number in any range, choose a name from a list, roll up to six dice, flip a coin or draw lots. It runs in your browser, works offline after the first visit and can be installed to your home screen like an app.',
      "Every result comes from your device's cryptographically secure random number generator, with rejection sampling so that no outcome is more likely than another.",
    ],
    toolList: true,
    faq: [
      ['Is it really random?', 'It uses crypto.getRandomValues, the same secure generator browsers use for encryption keys. Rejection sampling removes the small bias that simpler methods have, so every allowed result is equally likely.'],
      ['Does it work offline?', "Yes. After your first visit the whole app is stored on your device. To install it, use your browser's Install app or Add to Home Screen option."],
      ['Where is my data stored?', "Your lists, settings and history are saved only in your browser's local storage on this device. Nothing you enter is uploaded."],
    ],
  },
  {
    slug: 'random-number-generator', entry: '/number', preset: null, tool: true, nav: 'Random number generator',
    blurb: 'Pick numbers in any range, with No repeat.',
    title: 'Random Number Generator: Pick a Number in Any Range',
    description: 'Pick random numbers in any range. Draw up to 100 at once, sort them, or use No repeat so each number comes up once. Free and works offline.',
    h1: 'Random number generator',
    intro: [
      'Set From and To, then tap the generate button or press Space. Any whole numbers from -1,000,000,000 to 1,000,000,000 work, and if From is larger than To they are swapped for you.',
      'Open Parameters to draw up to 100 numbers at once, sort the results or allow duplicates. Turn on No repeat to draw every number in the range exactly once, like pulling numbered tickets from a hat. The counter shows how many are left, and the pool starts over when it runs out.',
    ],
    faq: [
      ['Can I generate numbers without repeats?', 'Yes. Turn on No repeat. It works for ranges of up to 100,000 numbers, and you can reset the pool at any time from the menu next to the counter.'],
      ['Is every number equally likely?', "Yes. Results come from your device's secure random generator with rejection sampling, so no number is favored."],
      ['Can I see earlier results?', 'Tap the clock icon to see your last 20 results. Tap one to copy it.'],
    ],
  },
  {
    slug: 'random-number-1-10', entry: '/number', preset: { number: { from: 1, to: 10 } }, tool: true, nav: 'Random number 1–10',
    blurb: 'A random number from 1 to 10.',
    title: 'Random Number Generator 1-10: Pick a Number from 1 to 10',
    description: 'Pick a random number from 1 to 10 with one tap. Use No repeat to go through all ten once. Free, fast and works offline.',
    h1: 'Random number from 1 to 10',
    intro: [
      'This page opens the number generator set to 1–10. Tap generate for a number. Each value from 1 to 10 has exactly a 10% chance.',
      'Use it for pick-a-number games, deciding who goes first or quick ratings. You can change From and To at any time for a different range.',
    ],
    faq: [
      ['How do I pick 1 to 10 without repeats?', 'Turn on No repeat. You get each of the ten numbers once, in random order, and the counter shows how many have been drawn.'],
      ['Can I pick several numbers at once?', 'Yes. Open Parameters and set How many numbers. With duplicates off, they are all different.'],
    ],
  },
  {
    slug: 'random-number-1-100', entry: '/number', preset: { number: { from: 1, to: 100 } }, tool: true, nav: 'Random number 1–100',
    blurb: 'A random number from 1 to 100.',
    title: 'Random Number Generator 1-100: Pick a Number from 1 to 100',
    description: 'Get a random number from 1 to 100 instantly. Draw several at once, or use No repeat for raffles and bingo without duplicates. Works offline.',
    h1: 'Random number from 1 to 100',
    intro: [
      'This page opens the number generator set to 1–100. Each number has exactly a 1% chance.',
      'It is handy for raffles with numbered tickets, classroom games, bingo-style calling and percentage rolls. With No repeat on, each number comes up only once until all 100 have been drawn.',
    ],
    faq: [
      ['Can I use it for a raffle?', 'Yes. Set To to your number of tickets, turn on No repeat and draw. History keeps the last 20 draws.'],
      ['How do I draw 5 different numbers?', 'Open Parameters and set How many numbers to 5. Duplicates are off by default, and Sort results puts them in order.'],
    ],
  },
  {
    slug: 'coin-flip', entry: '/coin', preset: null, tool: true, nav: 'Coin flip',
    blurb: 'Fair heads or tails with a 3D flip and a tally.',
    title: 'Coin Flip: Flip a Coin Online (Heads or Tails)',
    description: 'Flip a coin online: a fair 50/50 heads or tails toss with a 3D animation and a running tally. Free, fast and works offline.',
    h1: 'Flip a coin',
    intro: [
      'Tap the coin or the flip button to toss it. The coin spins and lands on heads or tails, and the tally counts every result until you reset it.',
      "Each flip is an independent 50/50 draw from your device's secure random generator, so earlier flips never influence the next one.",
    ],
    faq: [
      ['Is this coin flip fair?', 'Yes. Heads and tails each have exactly a 50% chance on every flip.'],
      ['Why did I get heads five times in a row?', 'Streaks are normal in fair random sequences. Any given five flips have a 1 in 32 chance of all being heads.'],
      ['Does it work without internet?', 'Yes, after your first visit.'],
    ],
  },
  {
    slug: 'dice-roller', entry: '/dice', preset: null, tool: true, nav: 'Dice roller',
    blurb: 'Roll 1 to 6 dice and see the total.',
    title: 'Dice Roller: Roll 1 to 6 Dice Online',
    description: 'Roll 1 to 6 dice online and see the total instantly, with a rolling animation and your last 20 rolls. Free and works offline.',
    h1: 'Dice roller',
    intro: [
      'Choose how many dice to roll with the − and + buttons, from 1 to 6, then tap the dice or the roll button. With more than one die, the total is shown under the dice.',
      'Use it for board games when the dice go missing, dice games or any quick d6 roll. Each die is rolled independently, and every face has an equal 1 in 6 chance.',
    ],
    faq: [
      ['Can I roll a d20 or other dice?', 'This roller uses six-sided dice. For a d20, use the random number generator with a range of 1 to 20.'],
      ['How do I see previous rolls?', 'Tap the clock icon to see your last 20 rolls with totals.'],
    ],
  },
  {
    slug: 'random-name-picker', entry: '/list/preset-names',
    preset: { list: { id: 'preset-names', name: 'Names', items: ['Alice', 'Bob', 'Charlie', 'Dana', 'Eli', 'Farah'] } },
    tool: true, nav: 'Random name picker',
    blurb: 'Pick names from your own list.',
    title: 'Random Name Picker: Pick a Random Name from a List',
    description: 'Paste a list of names and pick one at random. Pick several at once or use No repeat so nobody is chosen twice. Lists stay on your device.',
    h1: 'Random name picker',
    intro: [
      'This page opens a sample list of names. To use your own, open the ⋮ menu, choose Edit list and paste your names one per line (up to 500). Then tap the pick button.',
      'Pick up to 20 names at once for teams or prize draws. Turn on No repeat to go through everyone exactly once, which suits turn order, presentations and classroom questions. You can save as many lists as you like, and you will find them on the home screen.',
    ],
    faq: [
      ['Can I pick several winners at once?', 'Yes. Open Parameters and set How many to pick, up to 20. All the picks in one draw are different entries.'],
      ['Can the same name be picked twice?', 'Not within one draw. Across draws, turn on No repeat.'],
      ['Are my lists saved?', 'Yes, in your browser on this device only. Nothing is uploaded.'],
    ],
  },
  {
    slug: 'draw-lots', entry: '/lots', preset: null, tool: true, nav: 'Draw lots',
    blurb: 'Draw straws: reveal winners one by one.',
    title: 'Draw Lots Online: Cast Lots and Find the Winner',
    description: 'Draw lots online like drawing straws: set the number of lots and winners, then reveal them one by one. Fair, simple, works offline.',
    h1: 'Draw lots',
    intro: [
      'In Parameters, set the number of lots (2 to 30) and how many of them are winners. Each person taps a face-down lot to reveal it: a star means a winner and a dash means a blank.',
      'It works like drawing straws. The winners are placed at random before anyone chooses, so the order in which people pick does not change their chances. Tap the new round button to shuffle again.',
    ],
    faq: [
      ['Does it matter who picks first?', 'No. With K winners among N lots, every lot has the same K in N chance.'],
      ['Can there be more than one winner?', 'Yes, any number from 1 up to one less than the number of lots.'],
    ],
  },
  {
    slug: 'yes-or-no', entry: '/list/preset-yes-no',
    preset: { list: { id: 'preset-yes-no', name: 'Yes or No', items: ['Yes', 'No'] } },
    tool: true, nav: 'Yes or no',
    blurb: 'A random yes or no answer.',
    title: 'Yes or No Generator: Random Yes/No Answer',
    description: "Can't decide? Get a random yes or no answer with one tap. A fair 50/50 decision maker that works offline. Free, no sign-up.",
    h1: 'Yes or no?',
    intro: [
      'Ask your question, then tap the button to get a yes or a no. Both answers are equally likely.',
      'The answers come from a list you can edit: add Maybe or Ask again later through the ⋮ menu, or try the Random answer list on the home screen.',
    ],
    faq: [
      ['Is it really 50/50?', 'Yes. Each tap picks Yes or No with equal chance.'],
      ['Can I get the same answer twice in a row?', 'Yes. Every tap is independent. Turn on No repeat if you want the two answers to alternate in random pairs.'],
    ],
  },
  {
    slug: 'privacy', entry: '/', preset: null, tool: false,
    title: 'Privacy: Random',
    description: 'How Random handles your data: lists and settings stay on your device. Explains ads and cookies when ads are shown.',
    h1: 'Privacy',
    intro: [
      'Random has no accounts and no analytics.',
      "Your lists, settings and history are stored only in your browser's local storage on this device, and you can erase them with Settings → Clear all data.",
      'The app files are cached on your device so that it works offline.',
    ],
    faq: [],
  },
];
