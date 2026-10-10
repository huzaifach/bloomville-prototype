// logic.js — PURE game logic. Zero DOM, zero fetch, zero localStorage.
// Importable by node for headless tests. All game math lives here.

export const SAVE_VERSION = 'bloomville_v1';
export const OFFLINE_CAP_H = 12;
export const GOLDEN_CHANCE = 0.03;
export const GOLDEN_MULT = 3;
export const JOYFUL_HAPPINESS = 80;   // happiness >= this -> joyful sell bonus
export const JOYFUL_MULT = 1.25;
export const SEED_REPEAT_MULT = 1.04; // +4% per repeat buy, same family, same day
export const MAX_TIER = 8;
export const BOARD_SIZE = 25;         // 5x5
export const SOLARIUM_SLOTS = 5;
export const SOLARIUM_MIN_TIER = 4;
export const COMBO_WINDOW_MS = 4000;
export const TOTAL_PLOTS = 12;
export const START_PLOTS = 6;

// ---------- big numbers ----------
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
export function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '0';
  const neg = n < 0;
  let v = Math.abs(Math.floor(n));
  if (v < 1000) return (neg ? '-' : '') + String(v);
  let u = 0;
  while (v >= 1000 && u < UNITS.length - 1) { v /= 1000; u++; }
  const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return (neg ? '-' : '') + s.replace(/\.0+$|\.0$/, '').replace(/(\.\d)0$/, '$1') + UNITS[u];
}

// ---------- merging ----------
export function canMerge(a, b) {
  if (!a || !b) return false;
  return a.f === b.f && a.t === b.t && a.t < MAX_TIER;
}
export function mergeTier(tier) { return Math.min(tier + 1, MAX_TIER); }
export function rollGolden(rng) { return rng() < GOLDEN_CHANCE; }
export function happinessMult(hap) { return (hap || 0) >= JOYFUL_HAPPINESS ? JOYFUL_MULT : 1; }
export function sellValue(tierSell, golden, hap) {
  return Math.round(tierSell * (golden ? GOLDEN_MULT : 1) * happinessMult(hap));
}

// ---------- seed economy (per-family, per-day) ----------
export function todayKey(d = new Date()) {
  const p = x => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function seedCost(base, purchasesToday) {
  return Math.ceil(base * Math.pow(SEED_REPEAT_MULT, Math.max(0, purchasesToday || 0)));
}

// ---------- solarium / offline ----------
export function solariumDewPerSec(tierDew) { return tierDew * 0.008; }
export function offlineGains(perSec, elapsedSec, capH = OFFLINE_CAP_H) {
  const capped = Math.min(Math.max(0, elapsedSec), capH * 3600);
  return Math.floor(perSec * capped);
}

// ---------- farm xp / levels ----------
export function xpForNext(level) { return Math.round(60 * Math.pow(Math.max(1, level), 1.5)); }
export function levelFromXp(xp) {
  let level = 1, rest = Math.max(0, xp);
  while (rest >= xpForNext(level)) { rest -= xpForNext(level); level++; }
  return { level, intoLevel: rest, need: xpForNext(level) };
}
export function levelUpGift(level) { return { coins: 100 * level, dew: 20 * level }; }

// ---------- orders ----------
export function countBoardPlants(board, family, tier) {
  let n = 0;
  for (const c of board) if (c && c.f === family && c.t === tier) n++;
  return n;
}
// inv: { crops: {id: n}, board: [...] }
export function checkOrder(order, inv) {
  const missing = [];
  for (const item of order.items) {
    if (item.kind === 'crop') {
      const have = (inv.crops && inv.crops[item.id]) || 0;
      if (have < item.qty) missing.push({ item, have });
    } else if (item.kind === 'plant') {
      const have = countBoardPlants(inv.board, item.family, item.tier);
      if (have < item.qty) missing.push({ item, have });
    }
  }
  return { ok: missing.length === 0, missing };
}
// remove plants from board for an order item; returns removed cell indices
export function consumeBoardPlants(board, family, tier, qty) {
  const removed = [];
  for (let i = 0; i < board.length && removed.length < qty; i++) {
    const c = board[i];
    if (c && c.f === family && c.t === tier) { board[i] = null; removed.push(i); }
  }
  return removed;
}

// ---------- save schema ----------
export function createSave() {
  const plots = [];
  for (let i = 0; i < TOTAL_PLOTS; i++) plots.push({ owned: i < START_PLOTS, crop: null });
  return {
    version: SAVE_VERSION,
    day: todayKey(),
    coins: 150, dew: 20, renown: 0,
    xp: 0,
    plots,
    packets: { fh: { bought: 0 }, cs: { bought: 0 } },
    board: new Array(BOARD_SIZE).fill(null),
    solarium: new Array(SOLARIUM_SLOTS).fill(null),
    decor: [],               // {spot, id}
    inv: { crops: { sunberry: 0, moonmelon: 0, radish: 0, honeybloom: 0 } },
    stats: { merges: 0, harvests: 0, ordersFilled: 0, goldens: 0, bursts: 0, dewEarned: 0, discovered: [] },
    milestones: {},
    tutorial: { done: false, step: 0 },
    settings: { music: true, sfx: true },
    lastSeen: Date.now(),
  };
}
// migrate: returns a valid save (fills missing fields, bumps version)
export function migrate(raw) {
  const fresh = createSave();
  if (!raw || typeof raw !== 'object') return fresh;
  const s = Object.assign(fresh, raw);
  s.version = SAVE_VERSION;
  if (!Array.isArray(s.board) || s.board.length !== BOARD_SIZE) s.board = fresh.board;
  if (!Array.isArray(s.solarium) || s.solarium.length !== SOLARIUM_SLOTS) s.solarium = fresh.solarium;
  if (!Array.isArray(s.plots) || s.plots.length !== TOTAL_PLOTS) s.plots = fresh.plots;
  if (!s.inv || !s.inv.crops) s.inv = fresh.inv;
  if (!s.stats) s.stats = fresh.stats;
  if (!s.packets) s.packets = fresh.packets;
  if (!s.settings) s.settings = fresh.settings;
  if (!s.tutorial) s.tutorial = fresh.tutorial;
  if (!s.milestones) s.milestones = fresh.milestones;
  if (!Array.isArray(s.decor)) s.decor = [];
  if (typeof s.coins !== 'number') s.coins = 0;
  if (typeof s.dew !== 'number') s.dew = 0;
  if (typeof s.renown !== 'number') s.renown = 0;
  if (typeof s.xp !== 'number') s.xp = 0;
  return s;
}
// reset the per-day seed counters when the day rolls over
export function rollDay(save) {
  const k = todayKey();
  if (save.day !== k) {
    save.day = k;
    for (const f of Object.keys(save.packets)) save.packets[f] = { bought: 0 };
  }
  return save;
}

// ---------- misc ----------
export function emptyBoardCells(board) {
  const out = [];
  for (let i = 0; i < board.length; i++) if (!board[i]) out.push(i);
  return out;
}
export function pickRandomEmpty(board, rng) {
  const e = emptyBoardCells(board);
  if (!e.length) return -1;
  return e[Math.floor(rng() * e.length)];
}
