// Static game data + pure scoring helpers for 7 Wonders.

export const CATEGORIES = [
  { key: 'military',   label: 'Military',   color: '#b0524a', allowNegative: true },
  { key: 'coins',      label: 'Coins',      color: '#c9a65c', coins: true },
  { key: 'debts',      label: 'Debts',      color: '#8e4249', requires: 'cities', negative: true },
  { key: 'civilian',   label: 'Civilian',   color: '#6b8fb5' },
  { key: 'commercial', label: 'Commercial', color: '#e3b72f' },
  { key: 'guilds',     label: 'Guilds',     color: '#7a55a3' },
  { key: 'wonder',     label: 'Wonder',     color: '#7f9171' },
  { key: 'leaders',    label: 'Leaders',    color: '#9e9e9e', requires: 'leaders' },
  { key: 'cities',     label: 'Cities',     color: '#4a4a4a', requires: 'cities' },
  { key: 'science',    label: 'Science',    color: '#5e8f7c', science: true },
];

export const EXPANSIONS = [
  { key: 'leaders',     name: 'Leaders',      desc: 'Leader cards and the Rome wonder' },
  { key: 'cities',      name: 'Cities',       desc: 'Black cards, debts, and the Byzantium & Petra wonders' },
  { key: 'wondersPack', name: 'Wonders Pack', desc: '4 extra wonders: Stonehenge, Abu Simbel, Great Wall, Manneken Pis' },
];

export const SET_LABELS = { base: 'Base game', wondersPack: 'Wonders Pack', leaders: 'Leaders', cities: 'Cities' };

// `set` = which box the wonder comes from ('base' is always available).
export const WONDERS = [
  { id: 'alexandria',    name: 'Alexandria',    title: 'Lighthouse',          set: 'base' },
  { id: 'babylon',       name: 'Babylon',       title: 'Hanging Gardens',     set: 'base' },
  { id: 'ephesos',       name: 'Ephesos',       title: 'Temple of Artemis',   set: 'base' },
  { id: 'gizah',         name: 'Gizah',         title: 'Great Pyramid',       set: 'base' },
  { id: 'halikarnassos', name: 'Halikarnassos', title: 'Mausoleum',           set: 'base' },
  { id: 'olympia',       name: 'Olympia',       title: 'Statue of Zeus',      set: 'base' },
  { id: 'rhodos',        name: 'Rhodos',        title: 'Colossus',            set: 'base' },
  { id: 'stonehenge',    name: 'Stonehenge',    title: 'Wonders Pack',        set: 'wondersPack' },
  { id: 'abusimbel',     name: 'Abu Simbel',    title: 'Wonders Pack',        set: 'wondersPack' },
  { id: 'greatwall',     name: 'Great Wall',    title: 'Wonders Pack',        set: 'wondersPack' },
  { id: 'manneken',      name: 'Manneken Pis',  title: 'Wonders Pack',        set: 'wondersPack' },
  { id: 'rome',          name: 'Rome',          title: 'Colosseum',           set: 'leaders' },
  { id: 'byzantium',     name: 'Byzantium',     title: 'Hagia Sophia',        set: 'cities' },
  { id: 'petra',         name: 'Petra',         title: 'Al Khazneh',          set: 'cities' },
];

export const wonderById = (id) => WONDERS.find((w) => w.id === id);

export const SIDES = { A: 'Day (A)', B: 'Night (B)' };

export function availableWonders(exp) {
  return WONDERS.filter((w) => w.set === 'base' || exp[w.set]);
}

export function activeCategories(exp) {
  return CATEGORIES.filter((c) => !c.requires || exp[c.requires]);
}

export function emptyScores(exp) {
  const s = {};
  for (const c of CATEGORIES) s[c.key] = 0;
  return s;
}

/** Victory points a single category is worth, given the raw entered value. */
export function categoryPoints(key, scores) {
  const v = Number(scores?.[key]) || 0;
  if (key === 'coins') return Math.floor(Math.max(v, 0) / 3);
  if (key === 'debts') return -Math.abs(v);
  return v;
}

export function totalPoints(scores, exp) {
  return activeCategories(exp).reduce((sum, c) => sum + categoryPoints(c.key, scores), 0);
}

/**
 * Ranks players by total, tie-broken by coins (official rule).
 * Returns a new array of { ...player, rank } sorted best-first. Equal total AND coins share a rank.
 */
export function rankPlayers(players) {
  const sorted = [...players].sort(
    (a, b) => b.total - a.total || (b.scores?.coins || 0) - (a.scores?.coins || 0)
  );
  let prev = null;
  return sorted.map((p, i) => {
    const same = prev && prev.total === p.total && (prev.scores?.coins || 0) === (p.scores?.coins || 0);
    const rank = same ? prev.rank : i + 1;
    const out = { ...p, rank };
    prev = out;
    return out;
  });
}

/** Builds the persisted game document from a draft-like object. */
export function buildGame({ date, expansions, seating, scores, createdAt }) {
  const players = seating.map((s, i) => {
    const sc = {};
    for (const c of activeCategories(expansions)) sc[c.key] = Number(scores[s.playerId]?.[c.key]) || 0;
    return {
      id: s.playerId,
      name: s.name,
      seat: i,
      wonder: s.wonder || null,
      side: s.side || null,
      scores: sc,
      total: totalPoints(sc, expansions),
    };
  });
  const ranked = rankPlayers(players);
  const winners = ranked.filter((p) => p.rank === 1);
  return {
    date,
    createdAt: createdAt || Date.now(),
    expansions: { leaders: !!expansions.leaders, cities: !!expansions.cities, wondersPack: !!expansions.wondersPack },
    players: ranked.map(({ rank, ...p }) => p), // stored in rank order (best first)
    winnerIds: winners.map((w) => w.id),
    winnerName: winners.map((w) => w.name).join(' & '),
    winnerScore: winners[0].total,
  };
}

/** Best science score for given symbol counts, placing wild symbols optimally. */
export function scienceScore(tablet, compass, gear, wild = 0) {
  let best = { score: -1, t: 0, c: 0, g: 0 };
  for (let a = 0; a <= wild; a++) {
    for (let b = 0; a + b <= wild; b++) {
      const t = tablet + a, c = compass + b, g = gear + (wild - a - b);
      const score = t * t + c * c + g * g + 7 * Math.min(t, c, g);
      if (score > best.score) best = { score, t, c, g };
    }
  }
  return best;
}

export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
