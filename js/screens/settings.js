import { h, icon, topBar, switchRow, confirmDialog, toast } from '../ui.js';
import { ADS_ON, TIP_URL, TIP_LABEL } from '../config.js';
import { isNoAds, setNoAds } from '../ads.js';
import { getState, update, clearAll } from '../store.js';
import { VERSION } from '../app.js';

const THEMES = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];

export function render(root) {
  const s = getState().settings;

  const segButtons = THEMES.map(([value, label]) => h('button', {
    class: 'seg', attrs: { type: 'button', role: 'radio', 'aria-checked': String(s.theme === value), tabindex: s.theme === value ? '0' : '-1' },
    text: label,
    on: { click: () => choose(value) },
  }));
  const seg = h('div', { class: 'segmented', attrs: { role: 'radiogroup', 'aria-label': 'Theme' } }, segButtons);

  function choose(value) {
    update((st) => { st.settings.theme = value; });
    segButtons.forEach((b, i) => {
      const on = THEMES[i][0] === value;
      b.setAttribute('aria-checked', String(on));
      b.tabIndex = on ? 0 : -1;
    });
  }
  seg.addEventListener('keydown', (e) => {
    const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const i = THEMES.findIndex(([v]) => v === getState().settings.theme);
    const next = (i + dir + THEMES.length) % THEMES.length;
    choose(THEMES[next][0]);
    segButtons[next].focus();
  });

  const toggle = (key, label, hint) => switchRow({
    label, hint, checked: s[key], onChange: (v) => update((st) => { st.settings[key] = v; }),
  }).el;

  const vibHint = 'vibrate' in navigator ? '' : 'Not supported on this device';

  root.append(
    topBar({ title: 'Settings' }),
    h('div', { class: 'content settings' },
      h('div', { class: 'card settings-card' },
        h('div', { class: 'row-label', text: 'Theme' }), seg),
      h('div', { class: 'card settings-card' },
        toggle('sound', 'Sound'),
        toggle('vibration', 'Vibration', vibHint),
        toggle('animations', 'Animations', 'Also off when your system asks to reduce motion')),
      tipCard(),
      h('button', {
        class: 'btn danger-text clear-all', attrs: { type: 'button' }, text: 'Clear all data',
        on: {
          click: async () => {
            if (await confirmDialog({ message: 'Delete all lists, history and settings?', confirmLabel: 'Delete' })) {
              clearAll();
              location.reload();
            }
          },
        },
      }),
      versionLine(),
      h('a', { class: 'muted privacy-link', attrs: { href: new URL('../../privacy/', import.meta.url).href }, text: 'Privacy' })));
}

function tipCard() {
  if (!TIP_URL) return null;
  return h('div', { class: 'card settings-card' },
    h('a', { class: 'row link-row', attrs: { href: TIP_URL, target: '_blank', rel: 'noopener' } },
      h('span', { class: 'link-icon' }, icon('heart')),
      h('div', { class: 'row-text' },
        h('div', { class: 'row-label', text: TIP_LABEL }),
        h('div', { class: 'row-hint', text: 'Support this free tool' }))));
}

// Hidden owner switch: tap the version line 5 times within 3 seconds.
function versionLine() {
  const taps = [];
  return h('p', {
    class: 'muted version', text: `Random v${VERSION}`,
    on: {
      click: () => {
        if (!ADS_ON) return;
        const now = Date.now();
        taps.push(now);
        while (taps.length && now - taps[0] > 3000) taps.shift();
        if (taps.length < 5) return;
        taps.length = 0;
        const off = !isNoAds();
        setNoAds(off);
        toast(off ? 'Ads off on this device' : 'Ads on on this device (after reload)');
      },
    },
  });
}
