// Page data for tools/build-pages.mjs. All copy is plain text; the build escapes it.
import { BUILTIN_LISTS } from '../js/tools.js';

export const SITE_NAME = 'Random';

export const ADS_PRIVACY = "This site shows ads from Google AdSense. Google and its partners may use cookies or similar technologies to show ads and measure them, based on your visits to this and other websites. Visitors in the EEA, the UK and Switzerland are asked for consent through Google's consent message. You can manage ad personalization at https://adssettings.google.com. To learn more, see https://policies.google.com/technologies/partner-sites.";

export const GROUPS = [
  ['numbers', 'Numbers'],
  ['dice', 'Dice, coins & cards'],
  ['lists', 'Lists, names & teams'],
  ['answers', 'Answers & picks'],
];

const builtin = (id) => ({ list: { id, name: BUILTIN_LISTS[id].name, items: [...BUILTIN_LISTS[id].items] } });
const dicePreset = (sides) => ({ dice: { count: 1, sides, modifier: 0 } });

export const PAGES = [
  {
    slug: '', entry: '/', preset: null, tool: true,
    blurb: 'All tools in one app.',
    title: 'Random: Number Generator, Coin Flip, Dice & Name Picker',
    description: 'Free random tools in one app: numbers, dice, coin flip, name picker, spinning wheel, teams, lottery numbers and cards. Works offline.',
    h1: 'Random: simple, fair random tools',
    intro: [
      'Random is a small, fast app for everyday random choices: pick a number, roll any dice, flip a coin, choose names from a list, split people into teams, spin a wheel, draw lottery numbers or playing cards. It runs in your browser, works offline after the first visit and can be installed to your home screen.',
      "Every result comes from your device's cryptographically secure random number generator, with rejection sampling so that no outcome is more likely than another.",
    ],
    toolList: true,
    faq: [
      ['Is it really random?', 'It uses crypto.getRandomValues, the same secure generator browsers use for encryption keys. Rejection sampling removes the small bias that simpler methods have, so every allowed result is equally likely.'],
      ['Does it work offline?', "Yes. After your first visit the whole app is stored on your device. To install it, use your browser's Install app or Add to Home Screen option."],
      ['Where is my data stored?', "Your lists, settings and history are saved only in your browser's local storage on this device. Nothing you enter is uploaded."],
      ['Can I save my favourite settings?', 'Yes. Set up any tool, open the ⋮ menu and choose Save as preset. Your presets appear on the home screen under their tool, and search finds them instantly.'],
    ],
  },
  {
    slug: 'random-number-generator', entry: '/number', preset: null, tool: true, group: 'numbers', nav: 'Random number generator',
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
      ['Can I save a range I use often?', 'Yes. Choose Save as preset from the ⋮ menu, give it a name, and it appears under Number on the home screen. Share sends a link that opens the same settings.'],
    ],
  },
  {
    slug: 'random-number-1-6', entry: '/number', preset: { number: { from: 1, to: 6 } }, tool: true, group: 'numbers', nav: 'Random number 1–6',
    blurb: 'A random number from 1 to 6.',
    title: 'Random Number 1-6: Pick a Number from 1 to 6',
    description: 'Pick a random number from 1 to 6, like rolling a die without the dice. Each number has an equal 1 in 6 chance. Free, fast and works offline.',
    h1: 'Random number from 1 to 6',
    intro: [
      'This page opens the number generator set to 1–6. Tap generate and you get a whole number from 1 to 6, each with exactly the same chance.',
      'Use it in place of a missing die, to pick one of six options, or to decide turn order in a small group. Turn on No repeat to go through all six numbers once.',
    ],
    faq: [
      ['Is this the same as rolling a die?', 'Yes. Each number from 1 to 6 has a 1 in 6 chance, just like a fair die. For real dice with pips, use the dice roller.'],
      ['Can I get several numbers at once?', 'Yes. Set How many numbers in Parameters. With duplicates off, you can draw all six in random order.'],
    ],
  },
  {
    slug: 'random-number-1-10', entry: '/number', preset: { number: { from: 1, to: 10 } }, tool: true, group: 'numbers', nav: 'Random number 1–10',
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
    slug: 'random-number-1-50', entry: '/number', preset: { number: { from: 1, to: 50 } }, tool: true, group: 'numbers', nav: 'Random number 1–50',
    blurb: 'A random number from 1 to 50.',
    title: 'Random Number Generator 1-50: Pick a Number from 1 to 50',
    description: 'Get a random number between 1 and 50. Draw several at once or use No repeat for games and raffles with up to 50 tickets. Works offline.',
    h1: 'Random number from 1 to 50',
    intro: [
      'This page opens the number generator set to 1–50. Each number has exactly a 2% chance on every draw.',
      'It suits classroom seat numbers, small raffles and quiz questions. Turn on No repeat to call each number once, and Sort results to list several draws in order.',
    ],
    faq: [
      ['How do I run a raffle with 50 tickets?', 'Turn on No repeat and generate once per prize. The counter shows how many tickets are left.'],
      ['Can I save 1–50 for next time?', 'Yes. Choose Save as preset in the ⋮ menu and it appears under Number on the home screen.'],
    ],
  },
  {
    slug: 'random-number-1-100', entry: '/number', preset: { number: { from: 1, to: 100 } }, tool: true, group: 'numbers', nav: 'Random number 1–100',
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
    slug: 'random-number-1-1000', entry: '/number', preset: { number: { from: 1, to: 1000 } }, tool: true, group: 'numbers', nav: 'Random number 1–1000',
    blurb: 'A random number from 1 to 1000.',
    title: 'Random Number Generator 1-1000: Pick from 1 to 1000',
    description: 'Pick a random number from 1 to 1000 for giveaways, big raffles and guessing games. Draw up to 100 at once, sorted if you like. Works offline.',
    h1: 'Random number from 1 to 1000',
    intro: [
      'This page opens the number generator set to 1–1000. Every number has exactly a 1 in 1000 chance.',
      'Use it to pick a comment or entry number in a giveaway, run a large raffle or play higher-or-lower. Draw up to 100 numbers at once, and No repeat makes sure no number comes up twice.',
    ],
    faq: [
      ['Can I pick several winners from 1000 entries?', 'Yes. Set How many numbers in Parameters. With duplicates off, every winner is a different number.'],
      ['Is every number equally likely?', "Yes. The generator uses your device's secure random source with rejection sampling, so no number is favored."],
    ],
  },
  {
    slug: 'lottery-number-generator', entry: '/lottery', preset: null, tool: true, group: 'numbers', nav: 'Lottery numbers',
    blurb: 'Quick picks for 6/49, 5/69 + 1/26 and more.',
    title: 'Lottery Number Generator: Random Lotto Numbers',
    description: 'Generate random lottery numbers for 6/49, 5/69 + 1/26 and other formats, with bonus balls and up to 10 lines at once. Free and works offline.',
    h1: 'Lottery number generator',
    intro: [
      'Pick a format such as 6/49 or 5/69 + 1/26, or set your own: a main pool of up to 99 numbers, up to 10 numbers per line and up to 3 bonus balls from a separate or the same pool.',
      'Each line is drawn without repeats and sorted, like a quick pick. Draw up to 10 lines at once, copy them, or save your format as a preset.',
    ],
    faq: [
      ['Does a random pick improve my odds?', 'No. Every combination is equally likely to be drawn, whether you choose it yourself or use a random pick. Play responsibly.'],
      ['What is a bonus ball?', 'Some lotteries draw extra numbers from a separate pool, like 1 from 26. Others draw the bonus from the main pool. Both are supported.'],
    ],
  },
  {
    slug: 'dice-roller', entry: '/dice', preset: null, tool: true, group: 'dice', nav: 'Dice roller',
    blurb: 'Roll 1 to 12 dice, any type, with modifiers.',
    title: 'Dice Roller: Roll Any Dice Online (d4 to d100, 2d6+3)',
    description: 'Roll up to 12 dice online: d4, d6, d8, d10, d12, d20 or d100, with modifiers like 2d6+3 and an instant total. Free and works offline.',
    h1: 'Dice roller',
    intro: [
      'Choose how many dice to roll, from 1 to 12, and pick the type in Parameters: d4, d6, d8, d10, d12, d20 or d100. You can also type dice notation such as 2d6+3 or d20-1, and the total includes the modifier.',
      'Six-sided dice show classic pips, and other dice show their number. Each die is rolled independently with an equal chance for every face, and the history keeps your last 20 rolls with the full breakdown.',
    ],
    faq: [
      ['Can I roll a d20?', 'Yes. Choose d20 in Parameters or type d20. There is also a dedicated d20 page.'],
      ['What does 2d6+3 mean?', 'Roll two six-sided dice, add them up, then add 3. The roller shows each die and the final total.'],
      ['How do I see previous rolls?', 'Tap the clock icon to see your last 20 rolls with totals.'],
    ],
  },
  {
    slug: 'd4-dice-roller', entry: '/dice', preset: dicePreset(4), tool: true, group: 'dice', nav: 'D4 roller',
    blurb: 'Roll a four-sided die.',
    title: 'D4 Dice Roller: Roll a 4-Sided Die Online',
    description: 'Roll a d4 online: a fair four-sided die for tabletop RPG damage and board games. Add more dice or a modifier like 2d4+1. Works offline.',
    h1: 'Roll a d4',
    intro: [
      'This page opens the dice roller with one four-sided die. Tap the die or the roll button to get a number from 1 to 4.',
      'The d4 is common in tabletop RPGs for daggers, small spells and healing potions. Add dice with the stepper or type notation such as 3d4+2 in Parameters.',
    ],
    faq: [
      ['Is each side equally likely?', 'Yes. Each result from 1 to 4 has a 25% chance.'],
      ['Can I roll several d4 at once?', 'Yes. Use the − and + buttons, up to 12 dice, and the total is shown under the dice.'],
    ],
  },
  {
    slug: 'd6-dice-roller', entry: '/dice', preset: dicePreset(6), tool: true, group: 'dice', nav: 'D6 roller',
    blurb: 'Roll a classic six-sided die.',
    title: 'D6 Dice Roller: Roll a Six-Sided Die Online',
    description: 'Roll a single six-sided die online with classic pip faces, or add more d6 for totals like 3d6. Every face has a fair 1 in 6 chance.',
    h1: 'Roll a d6',
    intro: [
      'This page opens the dice roller with one classic six-sided die with pips. Tap it to roll.',
      "Add more dice for board games, or use notation like 3d6 or 2d6+1 for role-playing games. The total and each die's value are shown after every roll.",
    ],
    faq: [
      ["What's the difference from the dice roller page?", 'This page starts with a single d6. The dice roller keeps your last settings, such as 2d6 or a d20.'],
      ['Can I roll two dice?', 'Yes. Tap + to add dice, up to 12.'],
    ],
  },
  {
    slug: 'd8-dice-roller', entry: '/dice', preset: dicePreset(8), tool: true, group: 'dice', nav: 'D8 roller',
    blurb: 'Roll an eight-sided die.',
    title: 'D8 Dice Roller: Roll an 8-Sided Die Online',
    description: 'Roll a d8 online for RPG weapon damage and healing rolls. Each face from 1 to 8 is equally likely, and 2d8+3 style modifiers work too.',
    h1: 'Roll a d8',
    intro: [
      'This page opens the dice roller with one eight-sided die. Each roll gives a number from 1 to 8.',
      'Eight-sided dice are used for longswords, some spells and hit dice in tabletop RPGs. Type 2d8+3 or similar in Parameters to add dice and a bonus in one step.',
    ],
    faq: [
      ['How do I add a damage bonus?', 'Set the modifier in Parameters, or type notation such as d8+2. The total includes it.'],
      ['Are the results fair?', 'Yes. Each face has a 1 in 8 chance from a secure random source.'],
    ],
  },
  {
    slug: 'd10-dice-roller', entry: '/dice', preset: dicePreset(10), tool: true, group: 'dice', nav: 'D10 roller',
    blurb: 'Roll a ten-sided die.',
    title: 'D10 Dice Roller: Roll a 10-Sided Die Online',
    description: 'Roll a ten-sided die online for RPGs and games. Roll one d10 or several with a total, or switch to d100 for percentile rolls. Works offline.',
    h1: 'Roll a d10',
    intro: [
      'This page opens the dice roller with one ten-sided die, numbered 1 to 10.',
      'D10s are used in many role-playing systems and for percentile rolls. Choose d100 in Parameters for a number from 1 to 100 in a single roll.',
    ],
    faq: [
      ['Does the d10 show 0 or 10?', 'It shows 1 to 10. Every face is equally likely.'],
      ['Can I roll a pool of d10s?', 'Yes. Add up to 12 dice. Each value is shown along with the total.'],
    ],
  },
  {
    slug: 'd12-dice-roller', entry: '/dice', preset: dicePreset(12), tool: true, group: 'dice', nav: 'D12 roller',
    blurb: 'Roll a twelve-sided die.',
    title: 'D12 Dice Roller: Roll a 12-Sided Die Online',
    description: 'Roll a d12 online: a fair twelve-sided die for greataxe damage, hit dice or picking a month. Add dice or a modifier as you need.',
    h1: 'Roll a d12',
    intro: [
      'This page opens the dice roller with one twelve-sided die. Each roll gives a number from 1 to 12.',
      'Use it for big weapon damage and barbarian hit dice, or any choice among twelve options. Notation such as 2d12+4 works in Parameters.',
    ],
    faq: [
      ['Is each number equally likely?', 'Yes. Every face has a 1 in 12 chance.'],
      ['Can I save a d12 roll I use a lot?', 'Yes. Set it up, then choose Save as preset from the ⋮ menu.'],
    ],
  },
  {
    slug: 'd20-dice-roller', entry: '/dice', preset: dicePreset(20), tool: true, group: 'dice', nav: 'D20 roller',
    blurb: 'Roll a twenty-sided die.',
    title: 'D20 Dice Roller: Roll a 20-Sided Die Online',
    description: 'Roll a d20 online for D&D checks, attacks and saving throws. Add a modifier like d20+5, roll several d20s at once and see the total.',
    h1: 'Roll a d20',
    intro: [
      'This page opens the dice roller with one twenty-sided die. Tap it to roll a number from 1 to 20.',
      'Add your bonus with the modifier, for example d20+5 for an attack roll. For advantage, roll 2 dice and use the higher one. Save your usual rolls as presets for quick access.',
    ],
    faq: [
      ['Is a natural 20 as likely as any other roll?', 'Yes. Every face from 1 to 20 has exactly a 5% chance.'],
      ['How do I add my modifier?', 'Open Parameters and set the modifier, or type notation like d20+5. The total includes it.'],
    ],
  },
  {
    slug: 'coin-flip', entry: '/coin', preset: null, tool: true, group: 'dice', nav: 'Coin flip',
    blurb: 'Fair heads or tails with a 3D flip and stats.',
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
      ['Can I see how often I got heads?', 'Yes. Under the coin you see the heads and tails counts with percentages, your current streak and your longest streak. Reset tally starts over.'],
    ],
  },
  {
    slug: 'draw-a-card', entry: '/cards', preset: null, tool: true, group: 'dice', nav: 'Draw a card',
    blurb: 'Draw playing cards from a shuffled deck.',
    title: 'Draw a Card: Random Playing Card Generator',
    description: 'Draw random playing cards from a shuffled 52-card deck, with optional jokers. Draw one or several and keep going until the deck runs out.',
    h1: 'Draw a card',
    intro: [
      'Tap draw to take a card from a shuffled standard deck of 52. With No repeat on, the deck works like a real one: drawn cards stay out and the counter shows how many are left.',
      'Draw up to 10 cards at once for a quick hand, add two jokers in Parameters, and reshuffle at any time from the menu next to the counter.',
    ],
    faq: [
      ['Can the same card come up twice?', 'Not while No repeat is on, until the deck is reshuffled. With it off, every draw uses a full deck.'],
      ['Are jokers included?', 'Only if you turn on Include 2 jokers in Parameters.'],
    ],
  },
  {
    slug: 'random-name-picker', entry: '/list/preset-names', preset: builtin('preset-names'),
    tool: true, group: 'lists', nav: 'Random name picker',
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
      ['Can I make one name more likely?', 'Yes. Add *2 or x3 after an item, like "Sam *3", to make it three times as likely. Type \\x3 if you really mean the text x3.'],
    ],
  },
  {
    slug: 'team-generator', entry: '/teams', preset: null, tool: true, group: 'lists', nav: 'Team generator',
    blurb: 'Split names into balanced random teams.',
    title: 'Random Team Generator: Split Names into Teams',
    description: 'Paste a list of names and split them into random, balanced teams or groups of a set size. Copy the teams in one tap. Free and works offline.',
    h1: 'Random team generator',
    intro: [
      'Paste names one per line, or pick one of your saved lists, then choose either a number of teams or a group size. Tap split to shuffle everyone into balanced teams.',
      'Team sizes never differ by more than one person. Copy the result to share it in a chat, or save the setup as a preset for your weekly game or class.',
    ],
    faq: [
      ["What if the names don't divide evenly?", 'Some teams get one extra person. Sizes never differ by more than one.'],
      ['Can I paste a comma-separated list?', 'Yes. Tap Paste to import from your clipboard. Commas, semicolons or new lines all work.'],
    ],
  },
  {
    slug: 'shuffle-list', entry: '/shuffle', preset: null, tool: true, group: 'lists', nav: 'Shuffle a list',
    blurb: 'Put any list in random order.',
    title: 'Shuffle a List: Put Items in Random Order',
    description: 'Paste a list and shuffle it into a random order, numbered and ready to copy. Perfect for turn order, presentation slots and playlists.',
    h1: 'Shuffle a list',
    intro: [
      'Paste your items one per line, or choose a saved list, then tap shuffle. You get the whole list in a new random order, numbered from 1.',
      'Every possible order is equally likely. Use it for speaking order, game turns, task rotation or study questions, and copy the numbered result with one tap.',
    ],
    faq: [
      ['Is every order equally likely?', 'Yes. The list is shuffled with the Fisher–Yates method using a secure random source.'],
      ['Can I shuffle one of my saved lists?', 'Yes. Switch the source to Saved list and choose it. The saved list itself is not changed.'],
    ],
  },
  {
    slug: 'spin-the-wheel', entry: '/wheel', preset: null, tool: true, group: 'lists', nav: 'Spin the wheel',
    blurb: 'A wheel of names or choices with weighted slices.',
    title: 'Spin the Wheel: Random Wheel Spinner for Names',
    description: 'Add names or choices, spin the wheel and see where it lands. Up to 100 items, colored segments and weighted entries. Free, works offline.',
    h1: 'Spin the wheel',
    intro: [
      'Type your options one per line, or use a saved list, and tap spin. The winner is picked fairly before the wheel starts turning, then the wheel eases to a stop on it.',
      'Add *2 or x3 after an item to give it a bigger slice and a proportionally higher chance. The wheel holds up to 100 items, and labels are hidden only when slices get too thin to read.',
    ],
    faq: [
      ['Is the wheel fair?', "Yes. Each item's chance matches its slice. The result is chosen with a secure random source, and the animation only shows it."],
      ['Can I turn off the animation?', 'Yes. With Animations off in Settings, or reduced motion on your device, the result appears instantly.'],
    ],
  },
  {
    slug: 'draw-lots', entry: '/lots', preset: null, tool: true, group: 'lists', nav: 'Draw lots',
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
    slug: 'yes-or-no', entry: '/list/preset-yes-no', preset: builtin('preset-yes-no'),
    tool: true, group: 'answers', nav: 'Yes or no',
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
    slug: 'magic-8-ball', entry: '/list/preset-magic-8-ball', preset: builtin('preset-magic-8-ball'),
    tool: true, group: 'answers', nav: 'Magic 8-ball',
    blurb: 'Ask a question, get one of 20 classic answers.',
    title: 'Magic 8-Ball Online: Ask a Question, Get an Answer',
    description: 'Ask the magic 8-ball a yes-or-no question and get one of the 20 classic answers at random. Edit the answers to make your own. Works offline.',
    h1: 'Magic 8-ball',
    intro: [
      'Think of a yes-or-no question, then tap the button. The 8-ball answers with one of its 20 classic replies, from It is certain to Very doubtful.',
      'Ten answers are positive, five are non-committal and five are negative, just like the original toy. Edit the list from the ⋮ menu to add your own answers.',
    ],
    faq: [
      ['Are all answers equally likely?', 'Yes. Each of the 20 answers has a 1 in 20 chance.'],
      ['Can I change the answers?', 'Yes. Choose Edit list from the ⋮ menu. Your changes are saved on your device.'],
    ],
  },
  {
    slug: 'rock-paper-scissors', entry: '/list/preset-rock-paper-scissors', preset: builtin('preset-rock-paper-scissors'),
    tool: true, group: 'answers', nav: 'Rock paper scissors',
    blurb: 'Let the app throw a hand for you.',
    title: 'Rock Paper Scissors Generator: Random Hand Picker',
    description: 'Let the app throw rock, paper or scissors for you, each with a fair 1 in 3 chance. Great for settling decisions or playing solo. Works offline.',
    h1: 'Rock paper scissors',
    intro: [
      'Tap the button and the app throws rock, paper or scissors. Play against it, or let two people each tap once and compare.',
      'Rock beats scissors, scissors beats paper and paper beats rock. Each throw is independent, so there is no pattern to exploit.',
    ],
    faq: [
      ["Is the computer's throw random?", 'Yes. Each throw has an equal 1 in 3 chance and does not depend on earlier throws.'],
      ['Can I add lizard and Spock?', 'Yes. Edit the list from the ⋮ menu and add them.'],
    ],
  },
  {
    slug: 'random-letter-generator', entry: '/list/preset-letters', preset: builtin('preset-letters'),
    tool: true, group: 'answers', nav: 'Random letter',
    blurb: 'Pick a random letter from A to Z.',
    title: 'Random Letter Generator: Pick a Letter from A to Z',
    description: 'Pick a random letter from A to Z for word games, category rounds and name ideas. Use No repeat to go through the whole alphabet once.',
    h1: 'Random letter generator',
    intro: [
      'Tap the button to get a random letter from A to Z. Each of the 26 letters has the same chance.',
      'Use it for category word games, alphabet challenges or picking an initial. Turn on No repeat to work through all 26 letters without duplicates, or edit the list to remove hard letters.',
    ],
    faq: [
      ['Can I skip letters like Q and X?', 'Yes. Edit the list from the ⋮ menu and delete them.'],
      ['Can I get several letters at once?', 'Yes. Set How many to pick in Parameters, up to 20 different letters.'],
    ],
  },
  {
    slug: 'random-month-generator', entry: '/list/preset-months', preset: builtin('preset-months'),
    tool: true, group: 'answers', nav: 'Random month',
    blurb: 'Pick a random month of the year.',
    title: 'Random Month Generator: Pick a Month of the Year',
    description: 'Pick a random month from January to December for planning, writing prompts or games. Each month has an equal 1 in 12 chance. Works offline.',
    h1: 'Random month generator',
    intro: [
      'Tap the button to pick one of the twelve months at random.',
      'Use it for birthday guessing games, story prompts, deciding when to plan a trip, or assigning months to people. No repeat hands out every month once.',
    ],
    faq: [
      ['Is every month equally likely?', 'Yes. Each month has a 1 in 12 chance, whatever its number of days.'],
      ['Can I pick a random date instead?', 'Pick a month here, then use the number generator from 1 to 31 for the day.'],
    ],
  },
  {
    slug: 'random-day-of-the-week', entry: '/list/preset-weekdays', preset: builtin('preset-weekdays'),
    tool: true, group: 'answers', nav: 'Random weekday',
    blurb: 'Pick a random day of the week.',
    title: 'Random Day of the Week Generator: Pick a Weekday',
    description: 'Pick a random day of the week from Monday to Sunday. Use it to schedule chores, pick a meeting day or plan a date night. Free, works offline.',
    h1: 'Random day of the week',
    intro: [
      'Tap the button to get a random day from Monday to Sunday.',
      'Use it to share out chores, choose a day for a meetup or add some surprise to your plans. Remove Saturday and Sunday from the list for weekdays only.',
    ],
    faq: [
      ['Can I pick only weekdays?', 'Yes. Edit the list from the ⋮ menu and remove Saturday and Sunday.'],
      ['Can I assign each day once?', 'Yes. Turn on No repeat and each day comes up once before the list starts over.'],
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
