import * as store from '../store.js';
import { esc, go, fmtDateShort, fmtDateLong, icons, confirmDialog, toast } from '../ui.js';
import { activeCategories, CATEGORIES, categoryPoints, wonderById, SIDES, EXPANSIONS } from '../data.js';
import { getDraft, hasProgress, resetDraft, saveDraft } from '../draft.js';

const skeleton = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';

export const sortGames = (games) =>
  [...games].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt || 0) - (a.createdAt || 0));

/* ---------------------------------------------------------------- History list */
export function historyView(root) {
  const render = () => {
    const { games } = store.getState();
    const ready = store.isReady();
    const list = sortGames(games);
    const inProgress = hasProgress();
    const d = getDraft();

    root.innerHTML = `
      <div class="page">
        <header class="head">
          <h1 class="h1 big">History</h1>
          <div style="display:flex;align-items:center;gap:6px">
            <button class="btn ghost small" data-act="past">Add old game</button>
            <a class="icon-btn" href="#/settings" aria-label="Settings">${icons.settings}</a>
          </div>
        </header>
        ${inProgress ? `
          <div class="banner">
            <b>Game in progress</b>
            <span class="muted">${d.selected.length} players · ${d.step === 'scores' ? 'entering scores' : 'setting up'}</span>
            <div class="row-actions">
              <button class="btn primary small" data-act="resume">Resume</button>
              <button class="btn ghost small" data-act="discard">Discard</button>
            </div>
          </div>` : ''}
        ${!ready ? skeleton : list.length ? list.map(card).join('') : `
          <div class="empty"><div class="big">🏛️</div><p>No games yet.<br>Tap <b>New Game</b> to log your first one.</p></div>`}
      </div>
      <button class="fab" data-act="new">${icons.plus}<span>New Game</span></button>`;
  };

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'resume') go('#/new/' + (getDraft().step || 'players'));
    else if (act === 'discard') {
      if (await confirmDialog({ title: 'Discard this game?', message: 'The players, seating and scores entered so far will be lost.', confirmLabel: 'Discard', danger: true })) { resetDraft(); render(); }
    } else if (act === 'new' || act === 'past') {
      if (hasProgress()) {
        if (!(await confirmDialog({ title: 'Start a new game?', message: 'You have a game in progress. Starting a new one discards it.', confirmLabel: 'Start new', danger: true }))) return;
      }
      const d = resetDraft();
      if (act === 'past') { d.past = true; d.expansions.wondersPack = false; saveDraft(); }
      go('#/new/players');
    }
  };

  render();
  return store.subscribe(render);
}

function card(g) {
  const names = (g.players || []).map((p) => esc(p.name)).join(', ');
  return `
    <a class="card gcard" href="#/game/${esc(g.id)}">
      <div class="gc-top"><span>${fmtDateShort(g.date)}</span><span class="winner">🏆 ${esc(g.winnerName)}</span></div>
      <div class="gc-names">${names}</div>
      <div class="pts">${g.winnerScore} Points</div>
    </a>`;
}

/* ---------------------------------------------------------------- Game detail */
export function gameView(root, [id]) {
  const open = new Set();

  const render = () => {
    const g = store.getState().games.find((x) => x.id === id);
    if (!g) {
      root.innerHTML = `${topbar()}<div class="page no-tabs">${store.isReady() ? '<div class="empty"><div class="big">🤷</div><p>This game no longer exists.</p></div>' : skeleton}</div>`;
      return;
    }
    const cats = activeCategories(g.expansions);
    const chips = EXPANSIONS.filter((x) => g.expansions[x.key]).map((x) => `<span class="chip">${esc(x.name)}</span>`).join('');
    const ranks = rankLabel(g.players);

    root.innerHTML = `
      ${topbar()}
      <div class="page no-tabs">
        <div class="res-date">${fmtDateLong(g.date)}</div>
        <div class="res-hero">
          <div class="trophy">🏆</div>
          <div class="wn">${esc(g.winnerName)}</div>
          <div class="pts">${g.winnerScore} Points</div>
          ${chips ? `<div class="chips">${chips}</div>` : ''}
        </div>
        <div class="h2">Game results</div>
        ${g.players.map((p, i) => accordion(p, ranks[i], cats, g.winnerIds.includes(p.id), open.has(p.id))).join('')}
        <div style="height:12px"></div>
        <button class="btn outline block" data-act="edit" style="margin-bottom:10px">Edit scores</button>
        <button class="btn outline block" data-act="delete">Delete</button>
      </div>`;
  };

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'back') go('#/history');
    else if (b.dataset.act === 'toggle') {
      const acc = b.closest('.acc');
      acc.classList.toggle('open');
      const pid = acc.dataset.pid;
      acc.classList.contains('open') ? open.add(pid) : open.delete(pid);
      b.querySelector('.chev').innerHTML = acc.classList.contains('open') ? icons.chevronUp : icons.chevronDown;
    } else if (b.dataset.act === 'edit') go('#/edit/' + id);
    else if (b.dataset.act === 'delete') {
      if (await confirmDialog({ title: 'Delete this game?', message: 'This removes it from the history and the stats. It cannot be undone.', confirmLabel: 'Delete', danger: true })) {
        store.deleteGame(id);
        toast('Game deleted');
        go('#/history');
      }
    }
  };

  render();
  return store.subscribe(render);
}

function topbar() {
  return `<div class="topbar"><button class="back" data-act="back">${icons.back}<span>Back</span></button></div>`;
}

/** Display rank for each (already rank-sorted) player: trophy for 1st, number otherwise. */
function rankLabel(players) {
  let prev = null, prevRank = 0;
  return players.map((p, i) => {
    const same = prev && prev.total === p.total && (prev.scores?.coins || 0) === (p.scores?.coins || 0);
    const r = same ? prevRank : i + 1;
    prev = p; prevRank = r;
    return r;
  });
}

function accordion(p, rank, cats, isWinner, isOpen) {
  const w = p.wonder ? wonderById(p.wonder) : null;
  const meta = [w ? `${w.name}${p.side ? ' · ' + SIDES[p.side] : ''}` : null, p.seat != null ? `Seat ${p.seat + 1}` : null].filter(Boolean).join(' · ');
  return `
    <div class="acc ${isWinner ? 'win' : ''} ${isOpen ? 'open' : ''}" data-pid="${esc(p.id)}">
      <button class="acc-head" data-act="toggle">
        <span class="rk">${rank === 1 ? '🏆' : rank}</span>
        <span class="nm">${esc(p.name)}</span>
        <span class="tot">${p.total}</span>
        <span class="chev">${isOpen ? icons.chevronUp : icons.chevronDown}</span>
      </button>
      <div class="acc-body">
        ${meta ? `<div class="meta">${esc(meta)}</div>` : ''}
        ${cats.map((c) => {
          const pts = categoryPoints(c.key, p.scores);
          const raw = c.key === 'coins' ? `<span class="raw">${p.scores.coins || 0}</span>` : '';
          return `<div class="cat-row"><span class="dot" style="background:${c.color}"></span><span class="lbl">${c.key === 'coins' ? 'Coins - Amount' : c.label}</span>${raw}<span class="val">${pts < 0 ? '−' + Math.abs(pts) : pts}</span></div>`;
        }).join('')}
      </div>
    </div>`;
}

/* ---------------------------------------------------------------- Settings */
export function settingsView(root) {
  const render = () => {
    const { mode, status, error, configured } = store.info;
    const { players, games } = store.getState();
    const ok = mode === 'cloud' && status === 'ok';
    root.innerHTML = `
      ${topbar()}
      <div class="page no-tabs">
        <h1 class="h1" style="margin:16px 0 14px">Settings</h1>
        <div class="card">
          <div class="set-row"><div><b>Storage</b><div class="muted" style="font-size:14px">
            <span class="status-dot ${ok ? 'ok' : status === 'error' ? 'err' : ''}"></span>${mode === 'cloud' ? (status === 'ok' ? 'Synced with Firebase' : 'Firebase error') : 'Local only (this browser)'}</div></div></div>
          ${mode === 'local' && !configured ? `<p class="muted" style="margin-top:10px;font-size:14px">Firebase isn't configured yet, so data is stored only in this browser. Fill in <code>js/firebase-config.js</code> to share games between devices — see the README.</p>` : ''}
          ${error ? `<p style="margin-top:10px;font-size:14px;color:var(--danger)">${esc(error)}</p>` : ''}
        </div>
        ${mode === 'cloud' && store.info.auth.user ? `
        <div class="card">
          <div class="set-row"><div style="min-width:0"><b>Account</b>
            <div class="muted" style="font-size:14px;overflow:hidden;text-overflow:ellipsis">${esc(store.info.auth.user.email)}</div></div>
            <button class="btn ghost small" data-act="signout">Sign out</button></div>
        </div>` : ''}
        <div class="card">
          <b>Backup</b>
          <p class="muted" style="font-size:14px;margin:4px 0 12px">${players.length} players · ${games.length} games</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button class="btn ghost small" data-act="export">Export JSON</button>
            <button class="btn ghost small" data-act="import">Import JSON</button>
          </div>
          <input type="file" id="file" accept="application/json,.json" class="hidden">
          <p class="muted" style="font-size:13px;margin-top:10px">Import adds missing players and games; existing ones are never overwritten. Handy for moving data from local mode into Firebase.</p>
        </div>
      </div>`;
  };

  root.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'back') go('#/history');
    else if (b.dataset.act === 'export') {
      const blob = new Blob([JSON.stringify(store.exportData(), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `7wonders-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } else if (b.dataset.act === 'import') root.querySelector('#file').click();
  };
  root.onchange = async (e) => {
    if (e.target.id !== 'file' || !e.target.files[0]) return;
    try {
      const res = store.importData(JSON.parse(await e.target.files[0].text()));
      toast(`Imported ${res.games} games, ${res.players} players`);
    } catch (err) { toast('Import failed: ' + err.message); }
    e.target.value = '';
  };

  render();
  return store.subscribe(render);
}
