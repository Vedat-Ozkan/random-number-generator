// Bootstrap: theme, motion, router, keyboard, service worker.
import { getState, subscribe, setSaveErrorHandler } from './store.js';
import { startRouter, getPrimaryAction } from './router.js';
import { getEntry, applyPreset, initHomeFlag } from './site.js';
import { initAds } from './ads.js';
import { toast, isMenuOpen, closeMenu, isResultOpen, closeResult } from './ui.js';
import * as home from './screens/home.js';
import * as number from './screens/number.js';
import * as list from './screens/list.js';
import * as listEdit from './screens/list-edit.js';
import * as lists from './screens/lists.js';
import * as dice from './screens/dice.js';
import * as coin from './screens/coin.js';
import * as lots from './screens/lots.js';
import * as teams from './screens/teams.js';
import * as shuffle from './screens/shuffle.js';
import * as wheel from './screens/wheel.js';
import * as lottery from './screens/lottery.js';
import * as cards from './screens/cards.js';
import * as settings from './screens/settings.js';

export const VERSION = '4.0.0';

const ROUTES = [
  { path: '/', screen: home },
  { path: '/number', screen: number },
  { path: '/number/p/:id', screen: number },
  { path: '/lists', screen: lists },
  { path: '/list/new', screen: listEdit },
  { path: '/list/:id/edit', screen: listEdit },
  { path: '/list/:id', screen: list },
  { path: '/dice', screen: dice },
  { path: '/dice/p/:id', screen: dice },
  { path: '/coin', screen: coin },
  { path: '/lots', screen: lots },
  { path: '/lots/p/:id', screen: lots },
  { path: '/teams', screen: teams },
  { path: '/teams/p/:id', screen: teams },
  { path: '/shuffle', screen: shuffle },
  { path: '/shuffle/p/:id', screen: shuffle },
  { path: '/wheel', screen: wheel },
  { path: '/wheel/p/:id', screen: wheel },
  { path: '/lottery', screen: lottery },
  { path: '/lottery/p/:id', screen: lottery },
  { path: '/cards', screen: cards },
  { path: '/cards/p/:id', screen: cards },
  { path: '/settings', screen: settings },
];

const darkQuery = matchMedia('(prefers-color-scheme: dark)');
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');

function applyTheme() {
  const pref = getState().settings.theme;
  const theme = pref === 'system' ? (darkQuery.matches ? 'dark' : 'light') : pref;
  const html = document.documentElement;
  html.dataset.theme = theme;
  const bg = getComputedStyle(html).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg || '#0B0B0C');
}

function applyMotion() {
  const level = !getState().settings.animations ? 'off' : motionQuery.matches ? 'reduced' : 'on';
  document.documentElement.dataset.motion = level;
}

function applyAll() { applyTheme(); applyMotion(); }

darkQuery.addEventListener('change', applyTheme);
motionQuery.addEventListener('change', applyMotion);
subscribe(applyAll);
setSaveErrorHandler(() => toast('Storage full — data not saved'));
applyAll();

applyPreset();
initHomeFlag();
startRouter(document.getElementById('app'), ROUTES, getEntry());
initAds();

const SKIP = 'input, textarea, select, button, a, [role="switch"]';

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'Escape') {
    if (isMenuOpen()) closeMenu(true);
    else if (isResultOpen()) closeResult();
    return;
  }
  if (e.key !== ' ' && e.key !== 'Enter') return;
  const action = getPrimaryAction();
  if (!action) return;
  if (e.target instanceof Element && e.target.closest(SKIP)) return;
  if (isMenuOpen() || document.querySelector('dialog[open]')) return;
  e.preventDefault();
  action();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register(new URL('../sw.js', import.meta.url)).catch(() => {}));
}
