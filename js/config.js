// Site configuration. This is the ONLY file you edit to turn on the canonical URL, ads and the tip jar.
// Empty string = feature OFF (no script loaded, no empty box, no layout space).
// After editing, run:  node tools/build-pages.mjs   and commit the result.
export const CONFIG = {
  SITE_URL: 'https://random-number-generator-emf.pages.dev/',                 // e.g. 'https://example.com/'  (https, include a trailing '/'; include the sub-path if any)
  ADSENSE_CLIENT: '',           // e.g. 'ca-pub-1234567890123456'  (AdSense → Account → Account information)
  ADSENSE_SLOT: '',             // e.g. '1234567890'  (id of a FIXED-SIZE 320×50 display ad unit)
  TIP_URL: 'https://ko-fi.com/vedatozkan',                  // e.g. 'https://ko-fi.com/yourname' or 'https://buymeacoffee.com/yourname'
  TIP_LABEL: 'Buy me a coffee',
  GOOGLE_SITE_VERIFICATION: 'GrEqbwsKcm8L1PHF65JznGWGB7L2_MdygIyVydxRXDA', // optional: Search Console "HTML tag" content token
};

// ---- Derived values. Do not edit below this line. ----
const s = (v) => (typeof v === 'string' ? v.trim() : '');
const url = s(CONFIG.SITE_URL);
export const SITE_URL = /^https:\/\/[^/\s]+(\/[^\s]*)?$/.test(url) ? (url.endsWith('/') ? url : url + '/') : '';
export const ADSENSE_CLIENT = /^ca-pub-\d{10,20}$/.test(s(CONFIG.ADSENSE_CLIENT)) ? s(CONFIG.ADSENSE_CLIENT) : '';
export const ADSENSE_SLOT = /^\d{5,20}$/.test(s(CONFIG.ADSENSE_SLOT)) ? s(CONFIG.ADSENSE_SLOT) : '';
export const ADS_ON = !!(ADSENSE_CLIENT && ADSENSE_SLOT);
export const TIP_URL = /^https:\/\/\S+$/.test(s(CONFIG.TIP_URL)) ? s(CONFIG.TIP_URL) : '';
export const TIP_LABEL = s(CONFIG.TIP_LABEL) || 'Buy me a coffee';
export const GSC_TOKEN = /^[\w-]{10,100}$/.test(s(CONFIG.GOOGLE_SITE_VERIFICATION)) ? s(CONFIG.GOOGLE_SITE_VERIFICATION) : '';
