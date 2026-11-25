// Data layer. Uses Firestore when js/firebase-config.js is filled in, otherwise localStorage.
// Both backends expose the same tiny API so the views don't care which one is active.
import { firebaseConfig } from './firebase-config.js';

const FIREBASE_VERSION = '10.14.1';

const state = { players: [], games: [], ready: { players: false, games: false } };
export const info = {
  mode: 'local', status: 'ok', error: null, configured: false,
  inited: false,                          // init() finished
  denied: false,                          // signed in, but Firestore rules reject this account
  auth: { state: 'loading', user: null }, // cloud mode only: loading | signedOut | signedIn
};
let errorHandler = null;
export const setErrorHandler = (fn) => { errorHandler = fn; };

const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(state));
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export const getState = () => state;
export const isReady = () => state.ready.players && state.ready.games;

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '').slice(0, 20) : Math.random().toString(36).slice(2) + Date.now().toString(36));

const clean = (o) => JSON.parse(JSON.stringify(o)); // strips undefined (Firestore rejects it)

function isConfigured(cfg) {
  return !!(cfg && cfg.apiKey && cfg.projectId && !String(cfg.apiKey).startsWith('YOUR_') && !String(cfg.projectId).startsWith('YOUR_'));
}

function upsert(col, item) {
  const i = state[col].findIndex((x) => x.id === item.id);
  if (i >= 0) state[col][i] = item; else state[col].push(item);
}

/* ---------------- local backend ---------------- */
function localBackend() {
  const load = (k) => { try { return JSON.parse(localStorage.getItem('sw_' + k)) || []; } catch { return []; } };
  const persist = (k) => { try { localStorage.setItem('sw_' + k, JSON.stringify(state[k])); } catch (e) { console.warn(e); } };
  return {
    async init() {
      state.players = load('players');
      state.games = load('games');
      state.ready.players = state.ready.games = true;
      emit();
    },
    put(col, item) { upsert(col, item); persist(col); emit(); },
    remove(col, id) { state[col] = state[col].filter((x) => x.id !== id); persist(col); emit(); },
  };
}

/* ---------------- Firestore backend (+ Google sign-in) ---------------- */
async function cloudBackend() {
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(`${base}/firebase-app.js`),
    import(`${base}/firebase-firestore.js`),
    import(`${base}/firebase-auth.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  let db;
  try {
    db = fs.initializeFirestore(app, {
      localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
    });
  } catch {
    db = fs.getFirestore(app);
  }
  const auth = au.getAuth(app);

  const fail = (err) => {
    info.status = 'error'; info.error = err.message || String(err); console.error(err);
    errorHandler && errorHandler(info.error);
    emit();
  };

  // Firestore listeners only run while someone is signed in.
  let unsubs = [];
  const stop = () => {
    unsubs.forEach((f) => f()); unsubs = [];
    state.players = []; state.games = [];
    state.ready.players = state.ready.games = false;
  };
  const start = () => {
    for (const col of ['players', 'games']) {
      unsubs.push(fs.onSnapshot(
        fs.collection(db, col),
        (snap) => {
          state[col] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          state.ready[col] = true;
          info.status = 'ok'; info.error = null;
          emit();
        },
        (err) => {
          state.ready[col] = true;
          if (err.code === 'permission-denied') { info.denied = true; emit(); } else fail(err);
        }
      ));
    }
  };

  au.onAuthStateChanged(auth, (user) => {
    stop();
    info.denied = false; info.error = null; info.status = 'ok';
    if (user) {
      info.auth = { state: 'signedIn', user: { email: user.email, name: user.displayName, photo: user.photoURL } };
      start();
    } else {
      info.auth = { state: 'signedOut', user: null };
    }
    emit();
  });
  au.getRedirectResult(auth).catch((e) => { info.error = e.message; emit(); });

  return {
    async init() {},
    async signIn() {
      const provider = new au.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      info.error = null;
      try {
        await au.signInWithPopup(auth, provider);
      } catch (e) {
        if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment'].includes(e.code)) {
          await au.signInWithRedirect(auth, provider); // e.g. home-screen app on iOS
        } else if (!['auth/popup-closed-by-user', 'auth/cancelled-popup-request'].includes(e.code)) {
          info.error = e.code === 'auth/unauthorized-domain'
            ? `This domain (${location.hostname}) is not in Firebase → Authentication → Settings → Authorized domains.`
            : e.message;
          emit();
        }
      }
    },
    signOut: () => au.signOut(auth),
    put(col, item) {
      const { id, ...data } = clean(item);
      upsert(col, { id, ...data }); emit(); // optimistic; the snapshot listener will confirm
      fs.setDoc(fs.doc(db, col, id), data).catch(fail);
    },
    remove(col, id) {
      state[col] = state[col].filter((x) => x.id !== id); emit();
      fs.deleteDoc(fs.doc(db, col, id)).catch(fail);
    },
  };
}

let backend = null;

export async function init() {
  info.configured = isConfigured(firebaseConfig);
  if (info.configured) {
    try {
      backend = await cloudBackend();
      info.mode = 'cloud';
      info.inited = true;
      return;
    } catch (e) {
      info.error = 'Could not load Firebase: ' + (e.message || e);
      info.status = 'error';
      console.error(e);
    }
  }
  info.mode = 'local';
  backend = localBackend();
  info.inited = true;
  await backend.init();
}

export const signIn = () => backend?.signIn?.();
export const signOut = () => backend?.signOut?.();

/* ---------------- public API ---------------- */
export function addPlayer(name) {
  const p = { id: uid(), name: name.trim(), createdAt: Date.now() };
  backend.put('players', p);
  return p;
}
export const deletePlayer = (id) => backend.remove('players', id);

export function saveGame(game) {
  const g = { ...game, id: game.id || uid() };
  backend.put('games', g);
  return g.id;
}
export const deleteGame = (id) => backend.remove('games', id);

export function exportData() {
  return { app: '7wonders-score', version: 1, exportedAt: new Date().toISOString(), players: state.players, games: state.games };
}

export function importData(obj) {
  if (!obj || !Array.isArray(obj.players) || !Array.isArray(obj.games)) throw new Error('Not a valid backup file');
  let np = 0, ng = 0;
  const haveP = new Set(state.players.map((p) => p.id));
  const haveG = new Set(state.games.map((g) => g.id));
  for (const p of obj.players) if (p.id && p.name && !haveP.has(p.id)) { backend.put('players', p); np++; }
  for (const g of obj.games) if (g.id && g.players && !haveG.has(g.id)) { backend.put('games', g); ng++; }
  return { players: np, games: ng };
}
