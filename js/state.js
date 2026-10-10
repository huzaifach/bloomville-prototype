// state.js — save/load, export/import. DOM-free except localStorage access
// (guarded so node import doesn't crash).
import { SAVE_VERSION, createSave, migrate, rollDay } from './logic.js?v=1';

const KEY = SAVE_VERSION; // 'bloomville_v1'

// The live game state singleton. main.js populates it via loadGame().
export let G = null;

function ls() {
  try { return window.localStorage; } catch (e) { return null; }
}

export function loadGame() {
  const store = ls();
  let raw = null;
  if (store) {
    try { raw = JSON.parse(store.getItem(KEY)); } catch (e) { raw = null; }
  }
  G = migrate(raw);
  rollDay(G);
  return G;
}

export function setState(s) { G = s; }

let saveTimer = null;
export function saveGame() {
  if (!G) return;
  G.lastSeen = Date.now();
  const store = ls();
  if (!store) return;
  try { store.setItem(KEY, JSON.stringify(G)); } catch (e) { /* storage full/blocked */ }
}

export function startAutosave() {
  if (saveTimer) return;
  saveTimer = setInterval(saveGame, 10000);
  try {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) saveGame();
    });
  } catch (e) { /* node */ }
}

export function exportJSON() { return JSON.stringify(G); }

export function importJSON(text) {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== 'object') throw new Error('Not a Bloomville save file.');
  const s = migrate(raw);
  rollDay(s);
  G = s;
  saveGame();
  return G;
}

export function newGame() {
  G = createSave();
  saveGame();
  return G;
}
