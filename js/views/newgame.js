// New-game wizard: players → expansions → setup (seating + wonders) → scores.
// Also used (scores step only) for editing a saved game.
import * as store from '../store.js';
import { esc, go, icons, toast, confirmDialog, openModal } from '../ui.js';
import {
  CATEGORIES, EXPANSIONS, SET_LABELS, SIDES, WONDERS, activeCategories, availableWonders, buildGame,
  categoryPoints, emptyScores, rankPlayers, tiedOnPoints, scienceScore, totalPoints, wonderById,
} from '../data.js';
import { freshDraft, getDraft, resetDraft, saveDraft } from '../draft.js';

const STEPS = ['players', 'expansions', 'setup', 'scores'];

export function newGameView(root, [step]) {
  const d = getDraft();
  if (!STEPS.includes(step)) step = 'players';
  if (step !== 'players' && d.selected.length < 2) { location.replace('#/new/players'); return; }
  if (step === 'scores' && d.seating.length < 2 && !d.past) { location.replace('#/new/setup'); return; }
  return mountWizard(root, 'new', step, d);
}

export function editGameView(root, [id]) {
  let inner = null;
  const tryMount = () => {
    if (inner) return;
    const g = store.getState().games.find((x) => x.id === id);
    if (g) inner = mountWizard(root, 'edit', 'scores', draftFromGame(g));
    else if (store.isReady()) go('#/history');
  };
  root.innerHTML = '<div class="page"><div class="skeleton"></div></div>';
  tryMount();
  const unsub = store.subscribe(tryMount);
  return () => { unsub(); inner && inner(); };
}

function draftFromGame(g) {
  const seating = [...g.players].sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))
    .map((p) => ({ playerId: p.id, name: p.name, wonder: p.wonder || null, side: p.side || null }));
  const scores = {};
  for (const p of g.players) scores[p.id] = { ...emptyScores(), ...p.scores };
  return {
    ...freshDraft(), started: true, past: !!g.manual, editingId: g.id, createdAt: g.createdAt, date: g.date,
    expansions: { ...g.expansions }, selected: seating.map((s) => s.playerId), seating, scores,
    wonderSig: 'edit',
  };
}

/* ---------------------------------------------------------------- helpers */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const byName = (a, b) => a.name.localeCompare(b.name);

const HINTS = {
  military: 'Total of your military tokens (−1, +1, +3, +5). Can be negative.',
  coins: 'Enter the number of coins you have. Every 3 coins = 1 point.',
  debts: 'Enter the debt points you took. Each one costs 1 point.',
  civilian: 'Points on your blue cards.',
  commercial: 'Points from your yellow cards.',
  guilds: 'Points from your purple guild cards.',
  wonder: 'Points from your wonder stages.',
  leaders: 'Points from your leaders (white cards).',
  cities: 'Points from your black cards.',
  science: 'Total science points. Tap the calculator to count from symbols.',
};

function mountWizard(root, mode, step, d) {
  const persist = () => { if (mode === 'new') saveDraft(); };
  const edit = mode === 'edit';
  const stepNo = STEPS.indexOf(step) + 1;
  const cleanups = [];

  if (!edit) { d.step = step; if (step !== 'players') d.started = true; persist(); }

  const players = () => store.getState().players;
  const nameOf = (id) => players().find((p) => p.id === id)?.name || d.seating.find((s) => s.playerId === id)?.name || '';

  const layout = (title, sub, body, footer) => `
    <div class="topbar">
      <button class="back" data-act="back">${icons.back}<span>Back</span></button>
      ${edit ? '<span class="muted">Editing game</span>' : `<div class="steps">${STEPS.map((_, i) => `<i class="${i < stepNo ? 'on' : ''}"></i>`).join('')}</div>`}
    </div>
    <div class="page has-footer no-tabs">
      <h1 class="h1" style="margin:16px 0 0">${title}</h1>
      <p class="sub">${sub}</p>
      ${body}
    </div>
    <div class="footer-bar"><div class="inner">${footer}</div></div>`;

  const goStep = (s) => go('#/new/' + s);
  const onBack = () => {
    if (edit) return go('#/game/' + d.editingId);
    if (d.past && step === 'scores') return goStep('expansions');
    const i = STEPS.indexOf(step);
    if (i <= 0) go('#/history'); else goStep(STEPS[i - 1]);
  };

  let handlers = { click: () => {}, input: () => {}, submit: () => {}, change: () => {} };
  root.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (b && b.dataset.act === 'back') return onBack();
    handlers.click(e, b);
  };
  root.oninput = (e) => handlers.input(e);
  root.onchange = (e) => handlers.change(e);
  root.onsubmit = (e) => { e.preventDefault(); handlers.submit(e); };
  const onFocusIn = (e) => { if (e.target.classList?.contains('st-in')) setTimeout(() => e.target.select(), 0); };
  root.addEventListener('focusin', onFocusIn);
  cleanups.push(() => root.removeEventListener('focusin', onFocusIn));

  /* ================================================================ STEP 1: players */
  function stepPlayers() {
    root.innerHTML = layout(
      "Who's playing?",
      'Pick the players, or add someone new. You can also remove people from the list.',
      `<div id="plist"></div>
       <form class="add-row" autocomplete="off">
         <input class="input" id="newName" placeholder="New player name" maxlength="24" enterkeyhint="done">
         <button class="btn primary" type="submit">Add</button>
       </form>
       <div id="pastBox" style="margin-top:22px"></div>`,
      '<button class="btn primary block" data-act="next" id="nextBtn">Next</button>'
    );
    const plist = root.querySelector('#plist');
    const nextBtn = root.querySelector('#nextBtn');

    const draw = () => {
      const list = [...players()].sort(byName);
      // only prune once players have loaded, or a refresh would wipe the saved selection
      if (store.isReady()) d.selected = d.selected.filter((id) => list.some((p) => p.id === id));
      plist.innerHTML = list.length
        ? list.map((p) => {
            const on = d.selected.includes(p.id);
            return `<div class="tile ${on ? 'on' : ''}" data-act="toggle" data-id="${esc(p.id)}" role="button" tabindex="0">
                <span class="check">✓</span><span class="grow name">${esc(p.name)}</span>
                <button class="x" data-act="del" data-id="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">${icons.close}</button>
              </div>`;
          }).join('')
        : '<div class="empty" style="padding:28px 0"><p>No players yet — add your first one below.</p></div>';
      root.querySelector('#pastBox').innerHTML = `
        <div class="tile ${d.past ? 'on' : ''}" data-act="past" role="button" tabindex="0">
          <div class="grow"><div class="name">Adding an older game?</div>
            <div class="desc">Skip seating and wonders and go straight to the scores. These games don't count in the wonder stats.</div></div>
          <span class="switch"></span>
        </div>`;
      const n = d.selected.length;
      nextBtn.disabled = n < 2;
      nextBtn.textContent = n < 2 ? 'Select at least 2 players' : `Next · ${n} players`;
    };

    handlers.click = async (e, b) => {
      if (!b) return;
      const id = b.dataset.id;
      if (b.dataset.act === 'toggle') {
        d.selected = d.selected.includes(id) ? d.selected.filter((x) => x !== id) : [...d.selected, id];
        persist(); draw();
      } else if (b.dataset.act === 'del') {
        e.stopPropagation();
        const p = players().find((x) => x.id === id);
        if (await confirmDialog({ title: `Remove ${p?.name}?`, message: 'They disappear from this list. Games they already played keep their name and scores.', confirmLabel: 'Remove', danger: true })) {
          store.deletePlayer(id);
          d.selected = d.selected.filter((x) => x !== id);
          persist(); draw();
        }
      } else if (b.dataset.act === 'past') {
        d.past = !d.past;
        d.expansions.wondersPack = !d.past; // no wonders in old games → don't tag them "Wonders Pack"
        persist(); draw();
      } else if (b.dataset.act === 'next') {
        d.started = true; persist(); goStep('expansions');
      }
    };
    handlers.submit = () => {
      const input = root.querySelector('#newName');
      const name = input.value.trim().replace(/\s+/g, ' ');
      if (!name) return;
      const existing = players().find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        if (!d.selected.includes(existing.id)) d.selected = [...d.selected, existing.id];
        toast(`${existing.name} is already in the list`);
      } else {
        const id = store.addPlayer(name).id; // (emits → redraw reassigns d.selected, so push afterwards)
        d.selected = [...d.selected, id];
      }
      input.value = '';
      persist(); draw();
    };
    cleanups.push(store.subscribe(draw));
    draw();
  }

  /* ================================================================ STEP 2: expansions */
  function stepExpansions() {
    const draw = () => {
      const count = availableWonders(d.expansions).length;
      root.innerHTML = layout(
        'What are you playing?',
        'The base game is always included. Turn on any expansions on the table.',
        `<div class="tile on locked"><div class="grow"><div class="name">Base game</div><div class="desc">7 wonders, ages I–III</div></div><span class="switch"></span></div>
         ${EXPANSIONS.filter((x) => !(d.past && x.key === 'wondersPack')).map((x) => `
           <div class="tile ${d.expansions[x.key] ? 'on' : ''}" data-act="exp" data-key="${x.key}" role="button" tabindex="0">
             <div class="grow"><div class="name">${esc(x.name)}</div><div class="desc">${esc(x.desc)}</div></div><span class="switch"></span>
           </div>`).join('')}
         ${d.past ? '' : `<p class="muted" style="text-align:center;margin-top:6px">${count} wonders in the pool</p>`}`,
        `<button class="btn primary block" data-act="next">${d.past ? 'Next · Enter scores' : 'Next · Randomize'}</button>`
      );
    };
    handlers.click = (e, b) => {
      if (!b) return;
      if (b.dataset.act === 'exp') { d.expansions[b.dataset.key] = !d.expansions[b.dataset.key]; persist(); draw(); }
      else if (b.dataset.act === 'next') goStep(d.past ? 'scores' : 'setup');
    };
    draw();
  }

  /* ================================================================ STEP 3: setup */
  const pool = () => availableWonders(d.expansions).filter((w) => !d.excluded.includes(w.id));
  const wonderSig = () => JSON.stringify([d.expansions, d.excluded, d.sideMode]);

  function shuffleSeating() {
    d.seating = shuffle(d.seating);
  }
  function shuffleWonders() {
    const p = shuffle(pool());
    d.seating.forEach((s, i) => {
      const w = p[i];
      s.wonder = w ? w.id : null;
      s.side = d.sideMode === 'random' ? (Math.random() < 0.5 ? 'A' : 'B') : d.sideMode;
    });
    d.wonderSig = wonderSig();
  }
  function ensureSetup() {
    const ids = d.seating.map((s) => s.playerId);
    const same = ids.length === d.selected.length && d.selected.every((id) => ids.includes(id));
    if (!same) {
      d.seating = shuffle(d.selected).map((id) => ({ playerId: id, name: nameOf(id), wonder: null, side: null }));
      shuffleWonders();
    } else if (d.wonderSig !== wonderSig()) {
      shuffleWonders();
    }
    d.seating.forEach((s) => { s.name = nameOf(s.playerId) || s.name; });
  }

  function stepSetup() {
    if (!store.isReady()) { // refresh: wait for the player list so names resolve
      root.innerHTML = '<div class="page"><div class="skeleton"></div></div>';
      const unsub = store.subscribe(() => { if (store.isReady()) { unsub(); stepSetup(); } });
      cleanups.push(unsub);
      return;
    }
    ensureSetup();
    persist();
    let poolOpen = false;

    const draw = () => {
      const n = d.seating.length;
      const left = (i) => d.seating[(i + 1) % n];
      const right = (i) => d.seating[(i - 1 + n) % n];
      const wondersAvail = pool().length;
      const R = 34;

      const table = `
        <div class="round-table">
          <div class="ring"><div>Clockwise ↻<br>seat 1 → ${n}</div></div>
          ${d.seating.map((s, i) => {
            const th = (2 * Math.PI * i) / n;
            const w = s.wonder ? wonderById(s.wonder) : null;
            return `<div class="seat" style="left:${50 + R * Math.sin(th)}%;top:${50 - R * Math.cos(th)}%"><i>${i + 1}</i><b>${esc(s.name)}</b><small>${w ? esc(w.name) : '—'}</small></div>`;
          }).join('')}
        </div>`;

      const cards = d.seating.map((s, i) => {
        const w = s.wonder ? wonderById(s.wonder) : null;
        return `
          <div class="card seatcard">
            <div class="num">${i + 1}</div>
            <div class="grow" style="flex:1;min-width:0">
              <div class="nm">${esc(s.name)}</div>
              <div class="wonder">
                ${w ? `<b>${esc(w.name)}</b><span class="muted">${esc(w.title)}</span><span class="badge ${s.side}">${SIDES[s.side]}</span>` : '<span class="muted">No wonder left — add more to the pool</span>'}
              </div>
              <div class="nb">${n > 2 ? `Right: <b>${esc(right(i).name)}</b> · Left: <b>${esc(left(i).name)}</b>` : `Opponent: <b>${esc(left(i).name)}</b>`}</div>
            </div>
            <button class="dice-btn" data-act="rerollOne" data-i="${i}" aria-label="Re-roll wonder for ${esc(s.name)}" title="Re-roll this wonder">${icons.dice}</button>
          </div>`;
      }).join('');

      const groups = ['base', 'wondersPack', 'leaders', 'cities'].filter((k) => k === 'base' || d.expansions[k]);
      const poolHtml = groups.map((k) => `
        <div class="pool-group"><h4>${SET_LABELS[k]}</h4><div class="scroller" style="flex-wrap:wrap;margin:0;padding:0;overflow:visible">
          ${WONDERS.filter((w) => w.set === k).map((w) => `<button class="pill ${d.excluded.includes(w.id) ? '' : 'on'}" data-act="pool" data-id="${w.id}">${esc(w.name)}</button>`).join('')}
        </div></div>`).join('');

      root.innerHTML = layout(
        'Table setup',
        `Players are listed <b>clockwise</b> around the table. Your <b>left</b> neighbour is the next seat; your <b>right</b> neighbour is the previous one.`,
        `${wondersAvail < n ? `<div class="warn">Only ${wondersAvail} wonders in the pool for ${n} players. Re-enable some wonders below.</div>` : ''}
         ${table}
         <div class="tools">
           <button class="btn primary small" data-act="shuffleAll">${icons.shuffle} Shuffle all</button>
           <button class="btn ghost small" data-act="shuffleSeats">Seating</button>
           <button class="btn ghost small" data-act="shuffleWonders">Wonders</button>
           <button class="btn ghost small" data-act="copy">${icons.copy} Copy</button>
         </div>
         ${cards}
         <div class="h2">Options</div>
         <div class="card">
           <div style="font-weight:600;margin-bottom:8px">Wonder side</div>
           <div class="seg">
             ${[['random', 'Random'], ['A', 'Day (A)'], ['B', 'Night (B)']].map(([k, l]) => `<button class="${d.sideMode === k ? 'on' : ''}" data-act="side" data-k="${k}">${l}</button>`).join('')}
           </div>
         </div>
         <details class="pool" ${poolOpen ? 'open' : ''}>
           <summary><span>Wonder pool</span><span class="muted">${wondersAvail} / ${availableWonders(d.expansions).length}</span></summary>
           ${poolHtml}
         </details>`,
        `<button class="btn ghost" data-act="timer" style="flex:0 0 auto">${icons.timer}</button>
         <button class="btn primary" data-act="next">Game finished → Scores</button>`
      );
    };

    const reroll = (fn) => { fn(); persist(); draw(); };
    const asText = () => {
      const n = d.seating.length;
      return ['7 Wonders — table setup (clockwise)']
        .concat(d.seating.map((s, i) => {
          const w = s.wonder ? wonderById(s.wonder) : null;
          const nb = n > 2 ? ` | right: ${d.seating[(i - 1 + n) % n].name}, left: ${d.seating[(i + 1) % n].name}` : '';
          return `${i + 1}. ${s.name} — ${w ? `${w.name} (${SIDES[s.side]})` : 'no wonder'}${nb}`;
        })).join('\n');
    };

    handlers.click = async (e, b) => {
      const sum = e.target.closest('summary');
      if (sum) { poolOpen = !sum.parentElement.open; return; }
      if (!b) return;
      switch (b.dataset.act) {
        case 'shuffleAll': reroll(() => { shuffleSeating(); shuffleWonders(); }); break;
        case 'shuffleSeats': reroll(shuffleSeating); break;
        case 'shuffleWonders': reroll(shuffleWonders); break;
        case 'rerollOne': {
          // Give this player a different wonder that nobody else is holding.
          const s = d.seating[Number(b.dataset.i)];
          const taken = new Set(d.seating.map((x) => x.wonder));
          const options = pool().filter((w) => !taken.has(w.id));
          if (!options.length) { toast('No other wonder left in the pool'); break; }
          reroll(() => {
            s.wonder = options[Math.floor(Math.random() * options.length)].id;
            if (d.sideMode === 'random') s.side = Math.random() < 0.5 ? 'A' : 'B';
          });
          break;
        }
        case 'side': reroll(() => { d.sideMode = b.dataset.k; shuffleWonders(); }); break;
        case 'pool': reroll(() => {
          const id = b.dataset.id;
          d.excluded = d.excluded.includes(id) ? d.excluded.filter((x) => x !== id) : [...d.excluded, id];
          shuffleWonders();
        }); break;
        case 'copy':
          try { await navigator.clipboard.writeText(asText()); toast('Setup copied'); } catch { toast('Could not copy'); }
          break;
        case 'timer': go('#/timer'); break;
        case 'next': goStep('scores'); break;
      }
    };
    draw();
  }

  /* ================================================================ STEP 4: scores */
  function stepScores() {
    if (d.past && !edit) { // older game: seating is just the chosen players, no wonders
      if (!store.isReady()) {
        root.innerHTML = '<div class="page"><div class="skeleton"></div></div>';
        const unsub = store.subscribe(() => { if (store.isReady()) { unsub(); stepScores(); } });
        cleanups.push(unsub);
        return;
      }
      d.seating = d.selected.map((id) => d.seating.find((s) => s.playerId === id)
        || { playerId: id, name: nameOf(id), wonder: null, side: null });
    }
    for (const s of d.seating) d.scores[s.playerId] = { ...emptyScores(), ...(d.scores[s.playerId] || {}) };
    const cats = activeCategories(d.expansions);
    const catByKey = (k) => CATEGORIES.find((c) => c.key === k);
    if (!cats.some((c) => c.key === d.catKey)) d.catKey = cats[0].key;
    if (!d.seating.some((s) => s.playerId === d.playerId)) d.playerId = d.seating[0].playerId;

    const pts = (pid, key) => categoryPoints(key, d.scores[pid]);
    const total = (pid) => totalPoints(d.scores[pid], d.expansions);
    const wonderName = (s) => (s.wonder ? wonderById(s.wonder).name : '');
    const eqText = (pid, key) => {
      if (key === 'coins') return `= ${pts(pid, key)} pt${pts(pid, key) === 1 ? '' : 's'}`;
      if (key === 'debts') return `= ${pts(pid, key) < 0 ? '−' : ''}${Math.abs(pts(pid, key))} pts`;
      return '';
    };

    const stepper = (pid, key, label) => {
      const c = catByKey(key);
      return `<div class="stepper">
        <button type="button" tabindex="-1" class="st-btn" data-act="dec" data-pid="${esc(pid)}" data-key="${key}" aria-label="Decrease ${esc(label)}">−</button>
        <input class="st-in" type="number" ${c.allowNegative ? '' : 'inputmode="numeric" min="0"'} step="1" value="${d.scores[pid][key]}" data-pid="${esc(pid)}" data-key="${key}" aria-label="${esc(label)}">
        <button type="button" tabindex="-1" class="st-btn" data-act="inc" data-pid="${esc(pid)}" data-key="${key}" aria-label="Increase ${esc(label)}">+</button>
      </div>`;
    };
    const calcBtn = (pid) => `<button type="button" class="mini-btn" data-act="sci" data-pid="${esc(pid)}" aria-label="Science calculator">${icons.calc}</button>`;
    const eq = (pid, key) => (key === 'coins' || key === 'debts' ? `<span class="eq" data-eq="${esc(pid)}:${key}">${eqText(pid, key)}</span>` : '');

    const panelHtml = () => {
      if (d.scoreView === 'category') {
        const c = catByKey(d.catKey);
        return `<div class="cat-title"><span class="dot" style="background:${c.color}"></span>${c.label}</div>
          <div class="cat-hint">${HINTS[c.key]}</div>
          ${d.seating.map((s) => `
            <div class="srow">
              <div class="who"><b>${esc(s.name)}</b>${eq(s.playerId, c.key) || `<small>${esc(wonderName(s))}</small>`}</div>
              ${c.science ? calcBtn(s.playerId) : ''}${stepper(s.playerId, c.key, `${s.name} ${c.label}`)}
            </div>`).join('')}`;
      }
      const s = d.seating.find((x) => x.playerId === d.playerId);
      return `<div class="srow" style="padding-top:0"><div class="who"><b style="font-size:22px">${esc(s.name)}</b><small>${esc(wonderName(s))}</small></div><span class="ptotal" data-total="${esc(s.playerId)}">${total(s.playerId)}</span></div>
        ${cats.map((c) => `
          <div class="srow">
            <div class="who"><span style="display:flex;align-items:center;gap:10px"><span class="dot" style="background:${c.color}"></span><b>${c.key === 'coins' ? 'Coins' : c.label}</b></span>${eq(s.playerId, c.key)}</div>
            ${c.science ? calcBtn(s.playerId) : ''}${stepper(s.playerId, c.key, `${c.label}`)}
          </div>`).join('')}`;
    };

    const standingsHtml = () => {
      const ranked = rankPlayers(d.seating.map((s) => ({ id: s.playerId, name: s.name, total: total(s.playerId), scores: d.scores[s.playerId] })));
      const tied = tiedOnPoints(ranked);
      return ranked.map((p) => `
        <div class="srow ${p.rank === 1 ? 'first' : ''}">
          <span class="rk">${p.rank}</span><div class="who"><b>${esc(p.name)}</b>${tied.has(p.id) ? `<small>Tie-break · ${p.scores?.coins || 0} coins</small>` : ''}</div><span class="t">${p.total}</span>
        </div>`).join('');
    };

    const chipsHtml = () => (d.scoreView === 'category'
      ? cats.map((c) => `<button class="pill ${c.key === d.catKey ? 'on' : ''}" data-act="cat" data-key="${c.key}"><span class="dot" style="background:${c.color}"></span>${c.label}</button>`)
      : d.seating.map((s) => `<button class="pill ${s.playerId === d.playerId ? 'on' : ''}" data-act="pl" data-pid="${esc(s.playerId)}">${esc(s.name)}</button>`)
    ).join('');

    // navigation position within the current view
    const keys = () => (d.scoreView === 'category' ? cats.map((c) => c.key) : d.seating.map((s) => s.playerId));
    const cur = () => keys().indexOf(d.scoreView === 'category' ? d.catKey : d.playerId);
    const isLast = () => cur() === keys().length - 1;

    const dateBlock = (heading) => `${heading ? '<div class="h2">Date</div>' : ''}
      <input class="input" type="date" id="date" value="${esc(d.date)}" style="width:100%;margin-bottom:${heading ? 0 : 16}px" aria-label="Date played">`;

    const draw = () => {
      root.innerHTML = layout(
        edit ? 'Edit scores' : d.past ? 'Older game' : 'Scores',
        edit ? 'Change any value and save.' : d.past ? 'Pick the date it was played, then enter the points.' : 'Enter points category by category, or player by player.',
        `${d.past ? dateBlock(false) : ''}<div class="seg" style="margin-bottom:12px">
           <button class="${d.scoreView === 'category' ? 'on' : ''}" data-act="view" data-k="category">By category</button>
           <button class="${d.scoreView === 'player' ? 'on' : ''}" data-act="view" data-k="player">By player</button>
         </div>
         <div class="scroller" id="chips">${chipsHtml()}</div>
         <div class="card" id="panel">${panelHtml()}</div>
         <div class="h2">Standings</div>
         <div class="card standings" id="standings">${standingsHtml()}</div>
         ${d.past ? '' : dateBlock(true)}
         <div style="height:14px"></div>
         <button class="btn outline block" data-act="finish">${edit ? 'Save changes' : 'Finish & save'}</button>`,
        `<button class="btn ghost" data-act="prev" ${cur() === 0 ? 'disabled style="opacity:.4"' : ''}>${icons.back} Prev</button>
         <button class="btn primary" data-act="next">${isLast() ? (edit ? 'Save changes' : 'Finish & save') : 'Next'}</button>`
      );
      root.querySelector('#chips .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });
    };

    const refresh = () => {
      for (const s of d.seating) {
        root.querySelectorAll(`[data-total="${CSS.escape(s.playerId)}"]`).forEach((el) => { el.textContent = total(s.playerId); });
        for (const k of ['coins', 'debts']) {
          const el = root.querySelector(`[data-eq="${CSS.escape(s.playerId + ':' + k)}"]`);
          if (el) el.textContent = eqText(s.playerId, k);
        }
      }
      root.querySelector('#standings').innerHTML = standingsHtml();
    };

    const setScore = (pid, key, raw) => {
      let v = raw === '' || raw == null ? 0 : Number(raw);
      if (!Number.isFinite(v)) v = 0;
      v = Math.round(v);
      if (!catByKey(key).allowNegative) v = Math.max(0, v);
      d.scores[pid][key] = Math.min(v, 9999);
      persist();
      refresh();
    };
    const inputFor = (pid, key) => root.querySelector(`.st-in[data-pid="${CSS.escape(pid)}"][data-key="${key}"]`);

    const finish = async () => {
      const game = buildGame({ date: d.date, expansions: d.expansions, seating: d.seating, scores: d.scores, createdAt: d.createdAt, past: d.past });
      if (edit) game.id = d.editingId;
      const id = store.saveGame(game);
      if (!edit) resetDraft();
      toast(edit ? 'Changes saved' : 'Game saved 🏆');
      go('#/game/' + id);
    };

    const openScience = (pid) => {
      const s = d.seating.find((x) => x.playerId === pid);
      const v = { t: 0, c: 0, g: 0, w: 0 };
      const rows = [['t', 'Tablets', '#5e8f7c'], ['c', 'Compasses', '#6b8fb5'], ['g', 'Gears', '#b0824a'], ['w', 'Wild (any)', '#9e9e9e']];
      openModal(
        `<h3>Science · ${esc(s.name)}</h3><p>Count the science symbols. Wild symbols are placed for the best score.</p>
         ${rows.map(([k, l, col]) => `
           <div class="srow"><div class="who" style="display:flex;align-items:center;gap:10px"><span class="dot" style="background:${col}"></span><b>${l}</b></div>
             <div class="stepper"><button type="button" tabindex="-1" class="st-btn" data-k="${k}" data-d="-1">−</button>
             <input class="st-in" type="number" inputmode="numeric" min="0" value="0" data-k="${k}"><button type="button" tabindex="-1" class="st-btn" data-k="${k}" data-d="1">+</button></div></div>`).join('')}
         <div class="srow"><div class="who"><b>Score</b><small id="sc-detail"></small></div><span class="ptotal" id="sc-total">0</span></div>
         <div class="modal-actions"><button class="btn ghost" data-r="x">Cancel</button><button class="btn primary" data-r="use">Use score</button></div>`,
        (m, close) => {
          const calc = () => {
            const r = scienceScore(v.t, v.c, v.g, v.w);
            m.querySelector('#sc-total').textContent = r.score;
            m.querySelector('#sc-detail').textContent = v.w ? `Best split: ${r.t} tablets · ${r.c} compasses · ${r.g} gears` : '';
            return r.score;
          };
          m.addEventListener('click', (e) => {
            const b = e.target.closest('button');
            if (!b) return;
            if (b.dataset.d) {
              const k = b.dataset.k;
              v[k] = Math.max(0, v[k] + Number(b.dataset.d));
              m.querySelector(`.st-in[data-k="${k}"]`).value = v[k];
              calc();
            } else if (b.dataset.r === 'use') {
              const sc = calc();
              const inp = inputFor(pid, 'science');
              if (inp) inp.value = sc;
              setScore(pid, 'science', sc);
              close();
            } else if (b.dataset.r === 'x') close();
          });
          m.addEventListener('input', (e) => {
            const k = e.target.dataset?.k;
            if (!k) return;
            v[k] = Math.max(0, Math.round(Number(e.target.value)) || 0);
            calc();
          });
          m.addEventListener('focusin', (e) => e.target.classList?.contains('st-in') && setTimeout(() => e.target.select(), 0));
        }
      );
    };

    handlers.click = async (e, b) => {
      if (!b) return;
      const { act, pid, key } = b.dataset;
      switch (act) {
        case 'inc': case 'dec': {
          const inp = inputFor(pid, key);
          const next = (Number(inp.value) || 0) + (act === 'inc' ? 1 : -1);
          const allowNeg = catByKey(key).allowNegative;
          inp.value = allowNeg ? next : Math.max(0, next);
          setScore(pid, key, inp.value);
          break;
        }
        case 'sci': openScience(pid); break;
        case 'view': d.scoreView = b.dataset.k; persist(); draw(); break;
        case 'cat': d.catKey = key; persist(); draw(); break;
        case 'pl': d.playerId = pid; persist(); draw(); break;
        case 'prev': case 'next': {
          if (act === 'next' && isLast()) return finish();
          const i = cur() + (act === 'next' ? 1 : -1);
          if (i < 0) return;
          if (d.scoreView === 'category') d.catKey = keys()[i]; else d.playerId = keys()[i];
          persist(); draw(); window.scrollTo({ top: 0, behavior: 'smooth' });
          break;
        }
        case 'finish': finish(); break;
      }
    };
    handlers.input = (e) => {
      if (e.target.classList.contains('st-in')) setScore(e.target.dataset.pid, e.target.dataset.key, e.target.value);
    };
    handlers.change = (e) => {
      if (e.target.classList.contains('st-in')) {
        setScore(e.target.dataset.pid, e.target.dataset.key, e.target.value);
        e.target.value = d.scores[e.target.dataset.pid][e.target.dataset.key];
      } else if (e.target.id === 'date' && e.target.value) {
        d.date = e.target.value; persist();
      }
    };
    root.onkeydown = (e) => { if (e.key === 'Enter' && e.target.classList?.contains('st-in')) e.target.blur(); };
    draw();
  }

  ({ players: stepPlayers, expansions: stepExpansions, setup: stepSetup, scores: stepScores })[step]();
  return () => cleanups.forEach((fn) => fn());
}
