import { h, icon, topBar, switchRow, confirmDialog, toast, segmented } from '../ui.js';
import { ADS_ON, TIP_URL, TIP_LABEL } from '../config.js';
import { isNoAds, setNoAds } from '../ads.js';
import { getState, update, clearAll } from '../store.js';
import { VERSION } from '../app.js';

const THEMES = [['system', 'System'], ['light', 'Light'], ['dark', 'Dark']];

export function render(root) {
  const s = getState().settings;

  const seg = segmented({
    label: 'Theme', options: THEMES, value: s.theme,
    onChange: (value) => update((st) => { st.settings.theme = value; }),
  });

  const toggle = (key, label, hint) => switchRow({
    label, hint, checked: s[key], onChange: (v) => update((st) => { st.settings[key] = v; }),
  });

  // Animations hint follows the OS reduced-motion setting, live.
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const anim = toggle('animations', 'Animations');
  const paintAnim = () => anim.setHint(reduce.matches
    ? 'Your device asks for less motion: spins and flips are shorter. Turn off to stop all motion.'
    : 'Turn off to stop all motion, including spins and flips.');
  paintAnim();
  reduce.addEventListener('change', paintAnim);

  const vibHint = 'vibrate' in navigator ? '' : 'Not supported on this device';

  root.append(
    topBar({ title: 'Settings' }),
    h('div', { class: 'content settings scroll-region' },
      h('div', { class: 'card settings-card' },
        h('div', { class: 'row-label', text: 'Theme' }), seg.el),
      h('div', { class: 'card settings-card' },
        toggle('sound', 'Sound').el,
        toggle('vibration', 'Vibration', vibHint).el,
        anim.el),
      tipCard(),
      h('div', { class: 'settings-foot' },
        h('button', {
          class: 'btn danger-text clear-all', attrs: { type: 'button' }, text: 'Clear all data',
          on: {
            click: async () => {
              if (await confirmDialog({ message: 'Delete all lists, presets, history and settings?', confirmLabel: 'Delete' })) {
                clearAll();
                location.reload();
              }
            },
          },
        }),
        h('a', { class: 'btn privacy-link', attrs: { href: new URL('../../privacy/', import.meta.url).href }, text: 'Privacy' })),
      versionLine()));
  return () => reduce.removeEventListener('change', paintAnim);
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
