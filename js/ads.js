// Lazy AdSense loader and the owner "no ads" flag. AdSense is referenced nowhere else.
import { ADS_ON, ADSENSE_CLIENT } from './config.js';

const KEY = 'random:noads';

export function isNoAds() {
  try { return localStorage.getItem(KEY) === '1'; } catch { return false; }
}

export function setNoAds(on) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  document.documentElement.toggleAttribute('data-noads', !!on);
}

export function initAds() {
  const html = document.documentElement;
  const slot = document.getElementById('ad-slot');
  if (!ADS_ON || !slot || html.hasAttribute('data-noads')) return;

  let scriptAdded = false;
  let scriptReady = false;
  let pushed = false;
  let interacted = false;
  const shown = () => slot.offsetHeight > 0 && !html.hasAttribute('data-noads');
  // Never at boot: needs one user interaction and the dock (Home only) actually displayed.
  // The unit is only pushed while the dock is displayed (AdSense measures the slot width),
  // so a tap that navigates away from Home waits for the next visit to Home.
  function tryLoad() {
    if (pushed || !interacted || !shown()) return;
    if (!scriptAdded) {
      scriptAdded = true;
      if (!navigator.onLine) { html.setAttribute('data-noads', ''); return; }
      const script = document.createElement('script');
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
      script.onerror = () => html.setAttribute('data-noads', '');
      script.onload = () => { scriptReady = true; requestAnimationFrame(tryLoad); };
      document.head.append(script);
      return;
    }
    if (!scriptReady) return;
    pushed = true;
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
  const events = ['pointerdown', 'touchstart', 'keydown'];
  const onInput = () => {
    interacted = true;
    events.forEach((e) => window.removeEventListener(e, onInput));
    tryLoad();
  };
  events.forEach((e) => window.addEventListener(e, onInput, { passive: true }));
  window.addEventListener('hashchange', () => requestAnimationFrame(tryLoad));
}
