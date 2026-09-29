// Hash router with navDepth-based back handling.

let root = null;
let routes = [];
let cleanup = null;
let primaryAction = null;
let depth = 0;
let replacing = false;
let defaultPath = '/';
const beforeMountHooks = [];

export function beforeMount(fn) { beforeMountHooks.push(fn); }
export function setPrimaryAction(fn) { primaryAction = fn; }
export function getPrimaryAction() { return primaryAction; }

export function replace(hash) {
  if (location.hash === hash) return;
  replacing = true;
  location.replace(hash);
}

export const navDepth = () => depth;

export function back() {
  if (depth > 0) history.back();
  else replace('#/');
}

function match(pattern, path) {
  const p = pattern.split('/');
  const a = path.split('/');
  if (p.length !== a.length) return null;
  const params = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) {
      try { params[p[i].slice(1)] = decodeURIComponent(a[i]); } catch { return null; }
    } else if (p[i] !== a[i]) return null;
  }
  return params;
}

// Normalized current route path, with the page's default applied to an empty hash.
export function currentPath() {
  let path = location.hash.replace(/^#/, '').split('?')[0] || defaultPath;
  if (path.length > 1) path = path.replace(/\/+$/, '');
  return path;
}

function resolve() {
  const path = currentPath();
  for (const r of routes) {
    const params = match(r.path, path);
    if (params) return { screen: r.screen, params };
  }
  return null;
}

function mount() {
  beforeMountHooks.forEach((fn) => fn());
  try { cleanup?.(); } catch { /* ignore */ }
  cleanup = null;
  primaryAction = null;
  root.replaceChildren();
  const route = resolve();
  if (!route) { replace('#/'); return; }
  cleanup = route.screen.render(root, route.params) || null;
  window.scrollTo(0, 0);
  root.querySelector('h1')?.focus({ preventScroll: true });
}

export function startRouter(mountEl, routeTable, defaultRoute = '/') {
  root = mountEl;
  defaultPath = defaultRoute;
  routes = routeTable;
  depth = history.state && typeof history.state.d === 'number' ? history.state.d : 0;
  history.replaceState({ d: depth }, '');
  window.addEventListener('hashchange', () => {
    const st = history.state;
    if (replacing) replacing = false;
    else if (st && typeof st.d === 'number') depth = st.d; // history traversal
    else depth += 1; // new user navigation
    history.replaceState({ d: depth }, '');
    mount();
  });
  mount();
}
