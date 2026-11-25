import * as store from '../store.js';
import { esc, go, icons, toast, confirmDialog } from '../ui.js';

export function playersView(root) {
  const render = () => {
    const { players, games } = store.getState();
    const rows = [...players].sort((a, b) => a.name.localeCompare(b.name)).map((p) => {
      let played = 0, wins = 0;
      for (const g of games) {
        if (g.players?.some((x) => x.id === p.id)) { played++; if (g.winnerIds?.includes(p.id)) wins++; }
      }
      return { ...p, played, wins };
    });

    root.innerHTML = `
      <div class="page">
        <header class="head"><h1 class="h1 big">Players</h1></header>
        ${!store.isReady() ? '<div class="skeleton"></div>' : rows.length ? rows.map((p) => `
          <div class="tile" style="cursor:pointer" data-act="stats" data-id="${esc(p.id)}" role="button" tabindex="0">
            <div class="grow"><div class="name">${esc(p.name)}</div>
              <div class="desc">${p.played} game${p.played === 1 ? '' : 's'} · ${p.wins} win${p.wins === 1 ? '' : 's'}</div></div>
            <button class="x" data-act="del" data-id="${esc(p.id)}" aria-label="Remove ${esc(p.name)}">${icons.close}</button>
          </div>`).join('') : '<div class="empty"><div class="big">👥</div><p>No players yet.</p></div>'}
        <form class="add-row" autocomplete="off">
          <input class="input" id="newName" placeholder="New player name" maxlength="24" enterkeyhint="done">
          <button class="btn primary" type="submit">Add</button>
        </form>
        <p class="muted" style="font-size:13px;margin-top:12px">Tap a player to see their stats. Removing a player never changes past games.</p>
      </div>`;
  };

  root.onclick = async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const id = b.dataset.id;
    if (b.dataset.act === 'stats') go('#/stats/' + id);
    else if (b.dataset.act === 'del') {
      e.stopPropagation();
      const p = store.getState().players.find((x) => x.id === id);
      if (await confirmDialog({ title: `Remove ${p?.name}?`, message: 'Games they already played keep their name and scores.', confirmLabel: 'Remove', danger: true })) store.deletePlayer(id);
    }
  };
  root.onsubmit = (e) => {
    e.preventDefault();
    const input = root.querySelector('#newName');
    const name = input.value.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (store.getState().players.some((p) => p.name.toLowerCase() === name.toLowerCase())) return toast('That player already exists');
    store.addPlayer(name);
  };

  render();
  return store.subscribe(render);
}
