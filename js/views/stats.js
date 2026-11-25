import * as store from '../store.js';
import { esc, go, fmtNum, fmtDateShort } from '../ui.js';
import { activeCategories, categoryPoints, CATEGORIES, wonderById } from '../data.js';

/** One entry per (game, player). */
function buildEntries(games) {
  const out = [];
  for (const g of games) {
    for (const p of g.players || []) {
      out.push({ g, p, win: (g.winnerIds || []).includes(p.id) });
    }
  }
  return out;
}

/** Average points per category over entries where that category was in play. */
function breakdown(entries) {
  const acc = new Map(CATEGORIES.map((c) => [c.key, { sum: 0, n: 0 }]));
  for (const { g, p } of entries) {
    for (const c of activeCategories(g.expansions)) {
      const a = acc.get(c.key);
      a.sum += categoryPoints(c.key, p.scores);
      a.n++;
    }
  }
  return CATEGORIES.map((c) => ({ ...c, avg: acc.get(c.key).n ? acc.get(c.key).sum / acc.get(c.key).n : null, n: acc.get(c.key).n }))
    .filter((c) => c.n > 0);
}

export function statsView(root, [playerId]) {
  let mode = 'wins'; // wins | all

  const render = () => {
    const { games, players } = store.getState();
    if (!store.isReady()) { root.innerHTML = '<div class="page"><header class="head"><h1 class="h1 big">Stats</h1></header><div class="skeleton"></div></div>'; return; }

    // everyone who ever played, plus saved players
    const known = new Map();
    for (const p of players) known.set(p.id, p.name);
    for (const g of games) for (const p of g.players || []) if (!known.has(p.id)) known.set(p.id, p.name);
    const people = [...known].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
    const sel = playerId && known.has(playerId) ? playerId : null;
    const selName = sel ? known.get(sel) : null;

    const all = buildEntries(games);
    const mine = sel ? all.filter((e) => e.p.id === sel) : all;
    const subset = mode === 'wins' ? mine.filter((e) => e.win) : mine;

    const chips = `<div class="scroller">
      <button class="pill ${!sel ? 'on' : ''}" data-act="who" data-id="">Everyone</button>
      ${people.map((p) => `<button class="pill ${p.id === sel ? 'on' : ''}" data-act="who" data-id="${esc(p.id)}">${esc(p.name)}</button>`).join('')}
    </div>`;

    if (!games.length) {
      root.innerHTML = `<div class="page"><header class="head"><h1 class="h1 big">Stats</h1></header>
        <div class="empty"><div class="big">📊</div><p>Stats appear after you save your first game.</p></div></div>`;
      return;
    }

    // ---- summary tiles
    let tiles;
    if (sel) {
      const wins = mine.filter((e) => e.win).length;
      const avg = mine.length ? mine.reduce((s, e) => s + e.p.total, 0) / mine.length : 0;
      const best = mine.length ? Math.max(...mine.map((e) => e.p.total)) : 0;
      tiles = [
        [mine.length, 'Games played'],
        [`${wins}`, `Wins${mine.length ? ` · ${Math.round((wins / mine.length) * 100)}%` : ''}`],
        [mine.length ? fmtNum(avg) : '–', 'Average score'],
        [mine.length ? best : '–', 'Best score'],
      ];
    } else {
      const winners = all.filter((e) => e.win);
      const avgWin = winners.length ? winners.reduce((s, e) => s + e.p.total, 0) / winners.length : 0;
      tiles = [
        [games.length, 'Games'],
        [new Set(all.map((e) => e.p.id)).size, 'Players'],
        [winners.length ? fmtNum(avgWin) : '–', 'Avg winning score'],
        [winners.length ? Math.max(...winners.map((e) => e.p.total)) : '–', 'Highest score'],
      ];
    }

    // ---- leaderboard
    let leaderboard = '';
    if (!sel) {
      const by = new Map();
      for (const e of all) {
        const r = by.get(e.p.id) || { name: known.get(e.p.id) || e.p.name, n: 0, w: 0, sum: 0 };
        r.n++; r.w += e.win ? 1 : 0; r.sum += e.p.total;
        by.set(e.p.id, r);
      }
      const rows = [...by.entries()].map(([id, r]) => ({ id, ...r })).sort((a, b) => b.w / b.n - a.w / a.n || b.w - a.w || b.sum / b.n - a.sum / a.n);
      leaderboard = `<div class="h2">Leaderboard</div><div class="card">
        <div class="lb-row hd"><span>Player</span><span class="num">Wins</span><span class="num">Win %</span><span class="num">Avg</span></div>
        ${rows.map((r) => `<a class="lb-row" href="#/stats/${esc(r.id)}"><b>${esc(r.name)}</b><span class="num">${r.w}/${r.n}</span><span class="num">${Math.round((r.w / r.n) * 100)}%</span><span class="num">${fmtNum(r.sum / r.n)}</span></a>`).join('')}
      </div>`;
    }

    // ---- breakdown
    const bd = breakdown(subset);
    const overallWinners = sel ? breakdown(all.filter((e) => e.win)) : null;
    const positive = bd.filter((c) => c.avg > 0);
    const posSum = positive.reduce((s, c) => s + c.avg, 0);
    const avgTotal = subset.length ? subset.reduce((s, e) => s + e.p.total, 0) / subset.length : 0;
    const title = sel
      ? (mode === 'wins' ? `Where ${esc(selName)} scores in wins` : `Where ${esc(selName)} scores`)
      : (mode === 'wins' ? 'Where winners score' : 'Where everyone scores');
    const breakdownHtml = !subset.length
      ? `<p class="muted">No ${mode === 'wins' ? 'wins' : 'games'} yet.</p>`
      : `<div class="stack">${positive.map((c) => `<span style="width:${(c.avg / posSum) * 100}%;background:${c.color}" title="${c.label}"></span>`).join('')}</div>
         ${bd.map((c) => {
           const share = c.avg > 0 && posSum ? Math.round((c.avg / posSum) * 100) + '%' : '';
           const cmp = overallWinners && mode === 'all' ? overallWinners.find((x) => x.key === c.key) : null;
           return `<div class="brow"><span class="lbl"><span class="dot" style="background:${c.color}"></span>${c.label}</span>
              ${cmp && cmp.avg != null ? `<span class="cmp" title="Average of all winners">win ${fmtNum(cmp.avg)}</span>` : ''}
              <span class="v">${fmtNum(c.avg)}</span><span class="pc">${share}</span></div>`;
         }).join('')}
         <div class="brow" style="border-top:1px solid var(--line);margin-top:6px;padding-top:12px"><span class="lbl"><b>Average total</b></span><span class="v"><b>${fmtNum(avgTotal)}</b></span><span class="pc"></span></div>
         <p class="muted" style="font-size:12px;margin-top:6px">Averages only count games where the category was in play (e.g. Debts and Cities need the Cities expansion).</p>`;

    // ---- trend
    const trendEntries = (sel ? mine : all.filter((e) => e.win))
      .sort((a, b) => (a.g.date || '').localeCompare(b.g.date || '') || (a.g.createdAt || 0) - (b.g.createdAt || 0));
    const trendHtml = trendEntries.length >= 2 ? lineChart(trendEntries, !!sel) : '';

    // ---- wonders
    const wm = new Map();
    for (const e of mine) {
      if (!e.p.wonder) continue;
      const r = wm.get(e.p.wonder) || { n: 0, wins: 0, sum: 0 };
      r.n++; r.wins += e.win ? 1 : 0; r.sum += e.p.total; wm.set(e.p.wonder, r);
    }
    const wonderRows = [...wm.entries()].map(([id, r]) => ({ wonder: wonderById(id), ...r })).filter((r) => r.wonder).sort((a, b) => b.n - a.n || b.wins - a.wins);
    const wonderHtml = wonderRows.length ? `<div class="h2">Wonders</div><div class="card">
      <div class="lb-row hd"><span>Wonder</span><span class="num">Played</span><span class="num">Wins</span><span class="num">Avg</span></div>
      ${wonderRows.map((r) => `<div class="lb-row"><b>${esc(r.wonder.name)}</b><span class="num">${r.n}</span><span class="num">${r.wins}</span><span class="num">${fmtNum(r.sum / r.n)}</span></div>`).join('')}
    </div>` : '';

    root.innerHTML = `
      <div class="page">
        <header class="head"><h1 class="h1 big">Stats</h1></header>
        ${chips}
        <div class="tiles">${tiles.map(([n, l]) => `<div class="statbox"><div class="n">${n}</div><div class="l">${l}</div></div>`).join('')}</div>
        ${leaderboard}
        <div class="h2">Points breakdown</div>
        <div class="card">
          <div class="seg" style="margin-bottom:14px">
            <button class="${mode === 'wins' ? 'on' : ''}" data-act="mode" data-k="wins">Winning games</button>
            <button class="${mode === 'all' ? 'on' : ''}" data-act="mode" data-k="all">All games</button>
          </div>
          <div style="font-weight:600;margin-bottom:4px">${title}</div>
          ${breakdownHtml}
        </div>
        ${trendHtml}
        ${wonderHtml}
      </div>`;
  };

  root.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'who') go('#/stats' + (b.dataset.id ? '/' + b.dataset.id : ''));
    else if (b.dataset.act === 'mode') { mode = b.dataset.k; render(); }
  };

  render();
  return store.subscribe(render);
}

function lineChart(entries, personal) {
  const W = 320, H = 170, L = 30, R = 10, T = 12, B = 22;
  const vals = entries.map((e) => e.p.total);
  const lo = Math.floor(Math.min(...vals) / 10) * 10 - 0;
  const hi = Math.ceil(Math.max(...vals) / 10) * 10;
  const span = Math.max(hi - lo, 10);
  const x = (i) => L + (i * (W - L - R)) / (entries.length - 1);
  const y = (v) => T + (1 - (v - lo) / span) * (H - T - B);
  const pts = entries.map((e, i) => `${x(i).toFixed(1)},${y(e.p.total).toFixed(1)}`).join(' ');
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return `<div class="h2">${personal ? 'Score over time' : 'Winning score over time'}</div>
    <div class="card"><svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Score trend">
      ${[lo, lo + span / 2, hi].map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 5}" y="${y(v) + 3}" text-anchor="end">${Math.round(v)}</text>`).join('')}
      <line x1="${L}" x2="${W - R}" y1="${y(avg)}" y2="${y(avg)}" stroke="var(--muted)" stroke-dasharray="3 3" stroke-width="1"/>
      <polyline points="${pts}" fill="none" stroke="var(--gold)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
      ${entries.map((e, i) => `<circle cx="${x(i)}" cy="${y(e.p.total)}" r="${personal && e.win ? 5 : 3.5}" fill="${personal && !e.win ? 'var(--card)' : 'var(--gold)'}" stroke="var(--gold)" stroke-width="2"><title>${fmtDateShort(e.g.date)}: ${e.p.total}</title></circle>`).join('')}
      <text x="${L}" y="${H - 6}">${fmtDateShort(entries[0].g.date)}</text>
      <text x="${W - R}" y="${H - 6}" text-anchor="end">${fmtDateShort(entries.at(-1).g.date)}</text>
    </svg>
    <div class="legend"><span>- - average ${fmtNum(avg)}</span>${personal ? '<span>● win · ○ no win</span>' : ''}</div></div>`;
}
