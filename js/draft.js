// The "game in progress" draft: players → expansions → setup → scores. Persisted in localStorage
// so a refresh (or a walk to the Timer tab) doesn't lose anything.
import { todayISO } from './data.js';

const KEY = 'sw_draft';

export function freshDraft() {
  return {
    started: false,
    editingId: null,
    createdAt: null,
    step: 'players',
    date: todayISO(),
    expansions: { leaders: false, cities: false, wondersPack: true },
    selected: [],          // player ids
    sideMode: 'random',    // random | A | B
    excluded: [],          // wonder ids removed from the pool
    seating: [],           // [{ playerId, name, wonder, side }] in clockwise order
    scores: {},            // { [playerId]: { military: 0, ... } }
    scoreView: 'category', // category | player
    catKey: 'military',
    playerId: null,
  };
}

let draft = load();

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.expansions) return { ...freshDraft(), ...d };
  } catch { /* ignore */ }
  return freshDraft();
}

export const getDraft = () => draft;
export function saveDraft() { try { localStorage.setItem(KEY, JSON.stringify(draft)); } catch { /* ignore */ } }
export function resetDraft() { draft = freshDraft(); saveDraft(); return draft; }
export const hasProgress = () => draft.started && !draft.editingId && draft.selected.length > 0;
