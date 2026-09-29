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

  let loaded = false;
  let interacted = false; // scroll restoration on reload must not trigger the load
  // Load only once the user has scrolled and the slot is near the viewport (never at boot).
  function tryLoad() {
    if (loaded || !interacted || window.scrollY <= 0 || !slot.offsetHeight) return;
    if (slot.getBoundingClientRect().top > window.innerHeight + 300) return;
    loaded = true;
    window.removeEventListener('scroll', tryLoad);
    if (!navigator.onLine) { html.setAttribute('data-noads', ''); return; }
    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(ADSENSE_CLIENT)}`;
    script.onerror = () => html.setAttribute('data-noads', '');
    document.head.append(script);
    (window.adsbygoogle = window.adsbygoogle || []).push({});
  }
  window.addEventListener('scroll', tryLoad, { passive: true });
  const onInput = () => {
    interacted = true;
    ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach((e) => window.removeEventListener(e, onInput));
    tryLoad();
  };
  ['pointerdown', 'touchstart', 'keydown', 'wheel'].forEach((e) => window.addEventListener(e, onInput, { passive: true }));
}
