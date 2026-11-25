import * as store from './store.js';
import { icons, toast, esc } from './ui.js';
import { historyView, gameView, settingsView } from './views/history.js';
import { newGameView, editGameView } from './views/newgame.js';
import { statsView } from './views/stats.js';
import { playersView } from './views/players.js';
import { timerView } from './views/timer.js';

const root = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
const tabsEl = document.getElementById('tabs');

const TABS = [
  { id: 'history', label: 'History', icon: icons.history, hash: '#/history' },
  { id: 'players', label: 'Players', icon: icons.players, hash: '#/players' },
  { id: 'stats', label: 'Stats', icon: icons.stats, hash: '#/stats' },
  { id: 'timer', label: 'Timer', icon: icons.timer, hash: '#/timer' },
];
tabsEl.innerHTML = TABS.map((t) => `<a class="tab" data-tab="${t.id}" href="${t.hash}">${t.icon}<span>${t.label}</span></a>`).join('');

const routes = [
  { re: /^#\/history$/, tab: 'history', view: historyView },
  { re: /^#\/game\/([^/]+)$/, view: gameView },
  { re: /^#\/settings$/, view: settingsView },
  { re: /^#\/new(?:\/(\w+))?$/, view: newGameView },
  { re: /^#\/edit\/([^/]+)$/, view: editGameView },
  { re: /^#\/players$/, tab: 'players', view: playersView },
  { re: /^#\/stats(?:\/([^/]+))?$/, tab: 'stats', view: statsView },
  { re: /^#\/timer$/, tab: 'timer', view: timerView },
];

let cleanup = null;
let lastGate;

const GOOGLE_G = '<svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z"/></svg>';

/** Cloud mode needs a signed-in, allowed account before any app screen is shown. */
function gate() {
  if (!store.info.inited) return 'loading';
  if (store.info.mode === 'cloud') {
    const a = store.info.auth;
    if (a.state === 'loading') return 'loading';
    if (a.state === 'signedOut') return 'login';
    if (store.info.denied) return 'denied';
  }
  return null;
}

function renderGate(kind) {
  const logo = '<img src="icon.svg" alt="" width="84" height="84" style="border-radius:20px">';
  if (kind === 'loading') {
    root.innerHTML = `<div class="page auth">${logo}<div class="skeleton" style="width:60%;height:18px;margin-top:22px"></div></div>`;
  } else if (kind === 'login') {
    root.innerHTML = `<div class="page auth">${logo}
      <h1 class="h1" style="margin-top:18px">7 Wonders Score</h1>
      <p class="sub">Sign in with Google to see and add games. Only invited players can get in.</p>
      <button class="btn primary block" data-act="signin">${GOOGLE_G}<span>Sign in with Google</span></button>
      ${store.info.error ? `<p class="auth-err">${esc(store.info.error)}</p>` : ''}</div>`;
  } else {
    const u = store.info.auth.user;
    root.innerHTML = `<div class="page auth"><div style="font-size:54px">🔒</div>
      <h1 class="h1" style="margin-top:10px">No access</h1>
      <p class="sub"><b>${esc(u?.email || 'This account')}</b> isn't on the list of allowed players. Ask the owner to add you, or sign in with a different Google account.</p>
      <button class="btn primary block" data-act="signout">Sign out</button></div>`;
  }
  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'signin') { b.disabled = true; await store.signIn(); b.disabled = false; const g = gate(); if (g) renderGate(g); }
    else if (b.dataset.act === 'signout') store.signOut();
  };
}

function route() {
  const hash = location.hash || '#/history';
  if (cleanup) { try { cleanup(); } catch (e) { console.error(e); } cleanup = null; }
  root.onclick = root.oninput = root.onchange = root.onsubmit = root.onkeydown = null;

  lastGate = gate();
  if (lastGate) {
    tabbar.classList.add('hidden');
    renderGate(lastGate);
    return;
  }

  for (const r of routes) {
    const m = hash.match(r.re);
    if (!m) continue;
    tabbar.classList.toggle('hidden', !r.tab);
    tabsEl.querySelectorAll('.tab').forEach((a) => a.classList.toggle('active', a.dataset.tab === r.tab));
    window.scrollTo(0, 0);
    cleanup = r.view(root, m.slice(1)) || null;
    return;
  }
  location.replace('#/history');
}

window.addEventListener('hashchange', route);
store.setErrorHandler((msg) => toast('Sync problem: ' + msg, 5000));
store.subscribe(() => { if (gate() !== lastGate) route(); });
route();
store.init().then(() => { if (gate() !== lastGate) route(); }).catch((e) => console.error(e));
