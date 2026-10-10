// nursery.js — Potting House interior: REAL 5x5 merge board.
// 2 families x 8 tiers, per-family seed packets, drag AND tap-tap merge,
// combos, Bloom Burst full cascade, golden merges, happiness.
import { G, saveGame } from './state.js?v=1';
import {
  canMerge, mergeTier, rollGolden, sellValue, seedCost, pickRandomEmpty,
  BOARD_SIZE, MAX_TIER, COMBO_WINDOW_MS,
} from './logic.js?v=1';
import { img, plantImg, toast, addCoins, addDew, addXP, centerOf, confirmDlg } from './ui.js?v=1';
import { burst, floatText, flyCoins, popEl, shakeScreen } from './fx.js?v=1';
import { sfx } from './audio.js?v=1';
import { say as pipSay, celebrate as pipCelebrate } from './pip.js?v=1';

let D = null;
let selected = -1;
let burstRunning = false;
let boardLocked = false;
let lastMergeAt = 0, combo = 0;
let dragFrom = -1, dragStartXY = null;

export function initNursery(data) {
  D = data;
  buildShell();
  renderPackets();
  renderBoard();
  // happiness decay — gentle, every 30s
  setInterval(() => {
    let changed = false;
    for (const c of G.board) if (c && c.hap > 0) { c.hap = Math.max(0, c.hap - 4); changed = true; }
    if (changed) { renderBoard(); }
  }, 30000);
}

function buildShell() {
  const root = document.getElementById('nursery-board');
  if (!root || root.dataset.built) return;
  root.dataset.built = '1';
  let html = '';
  for (let i = 0; i < BOARD_SIZE; i++) html += `<div class="cell" data-i="${i}"></div>`;
  root.innerHTML = html;

  root.addEventListener('pointerdown', e => {
    const cell = e.target.closest('.cell');
    if (!cell) return;
    dragFrom = +cell.dataset.i;
    dragStartXY = { x: e.clientX, y: e.clientY };
  });
  root.addEventListener('pointerup', e => {
    const cell = e.target.closest('.cell');
    if (!cell || dragFrom < 0) { dragFrom = -1; return; }
    const to = +cell.dataset.i;
    const moved = dragStartXY && Math.hypot(e.clientX - dragStartXY.x, e.clientY - dragStartXY.y) > 12;
    if (moved && to !== dragFrom) dropOn(dragFrom, to);
    else tapCell(to);
    dragFrom = -1; dragStartXY = null;
  });
  root.addEventListener('pointercancel', () => { dragFrom = -1; dragStartXY = null; });

  document.getElementById('btn-sell').onclick = sellSelected;
  document.getElementById('btn-solarium').onclick = sendToSolarium;
  document.getElementById('btn-burst').onclick = doBloomBurst;
}

function cellEl(i) { return document.querySelector(`#nursery-board .cell[data-i="${i}"]`); }
function cellCenter(i) {
  const el = cellEl(i);
  if (!el) return { x: innerWidth / 2, y: innerHeight / 2 };
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
function tierOf(f, t) { return D.familyById[f].tiers[t - 1]; }

// ---------- packets (per-family pricing — never global) ----------
export function renderPackets() {
  const bar = document.getElementById('seed-packets');
  if (!bar || !D) return;
  bar.innerHTML = D.families.map(f => {
    const bought = (G.packets[f.id] && G.packets[f.id].bought) || 0;
    const cost = seedCost(f.baseSeed, bought);
    const empty = G.board.some(c => !c);
    return `<button class="packet" data-f="${f.id}" ${!empty ? 'disabled' : ''} style="--fam:${f.color}">
      ${plantImg(D, f.id, 1, 'packet-img')}
      <span class="packet-name">${f.name}</span>
      <span class="packet-cost">🪙 ${cost}</span>
      ${bought > 0 ? `<span class="packet-bought">x${bought + 1} today</span>` : ''}
    </button>`;
  }).join('');
  bar.querySelectorAll('.packet').forEach(b => {
    b.onclick = () => buySeed(b.dataset.f);
  });
}

export function buySeed(familyId) {
  if (boardLocked) return;
  const f = D.familyById[familyId];
  if (!f) return;
  const bought = (G.packets[familyId] && G.packets[familyId].bought) || 0;
  const cost = seedCost(f.baseSeed, bought);
  const idx = pickRandomEmpty(G.board, Math.random);
  if (idx < 0) { toast('Board is full! Merge or sell something. 🌱'); sfx('error'); return; }
  if (G.coins < cost) { toast(`Not enough coins! Need 🪙${cost}.`); sfx('error'); return; }
  G.coins -= cost;
  G.packets[familyId] = { bought: bought + 1 };
  G.board[idx] = { f: familyId, t: 1, gold: false, hap: 40 };
  sfx('plant');
  const p = cellCenter(idx);
  burst(p.x, p.y, [f.color, '#ffffff'], 8);
  BV_discover(`${familyId}:1`);
  renderPackets(); renderBoard();
  saveGame();
  if (window.BV && window.BV.updateHUD) window.BV.updateHUD();
  if (window.BV && window.BV.checkMilestones) window.BV.checkMilestones();
  if (window.BV && window.BV.tutorialTap) window.BV.tutorialTap('seed');
}

// ---------- board rendering ----------
export function renderBoard() {
  const root = document.getElementById('nursery-board');
  if (!root || !D) return;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const cell = root.children[i];
    const c = G.board[i];
    cell.classList.toggle('sel', i === selected);
    if (!c) { cell.innerHTML = '<span class="cell-dot"></span>'; cell.classList.remove('filled'); continue; }
    cell.classList.add('filled');
    const t = tierOf(c.f, c.t);
    const hearts = c.hap >= 80 ? '<span class="hap">💛</span>' : '';
    const gold = c.gold ? '<span class="gold-ring" title="Golden! 3x value"></span>' : '';
    cell.innerHTML = `${plantImg(D, c.f, c.t, 'cell-plant' + (c.gold ? ' golden' : ''))}${gold}${hearts}<span class="tier-tag">T${c.t}</span>`;
  }
  const burstBtn = document.getElementById('btn-burst');
  if (burstBtn) burstBtn.classList.toggle('ready', !!findAnyMerge() && !burstRunning);
}

// ---------- tap / drag ----------
function tapCell(i) {
  if (boardLocked || burstRunning) return;
  const c = G.board[i];
  if (selected < 0) {
    if (c) { selected = i; sfx('click'); renderBoard(); }
    return;
  }
  if (i === selected) {
    // tap again = giggle + happiness
    if (c) {
      c.hap = Math.min(100, (c.hap || 0) + 12);
      sfx('giggle');
      const p = cellCenter(i);
      floatText(p.x, p.y - 10, ['hee!', 'teehee!', '*giggle*', '💛'][Math.floor(Math.random() * 4)], 'giggle');
      burst(p.x, p.y, ['#ffd1e8', '#fff'], 5);
      popEl(cellEl(i));
      renderBoard(); saveGame();
    }
    return;
  }
  const s = G.board[selected];
  if (s && canMerge(s, c)) { doMerge(selected, i); selected = -1; return; }
  if (c) { selected = i; sfx('click'); }
  else selected = -1;
  renderBoard();
}

function dropOn(from, to) {
  if (boardLocked || burstRunning) return;
  const a = G.board[from], b = G.board[to];
  if (!a) return;
  if (canMerge(a, b)) { doMerge(from, to); selected = -1; return; }
  if (!b) {
    G.board[to] = a; G.board[from] = null;
    sfx('click'); renderBoard(); saveGame(); selected = -1; return;
  }
  selected = to; sfx('click'); renderBoard();
}

// ---------- merging ----------
function findPair(f, tier) {
  let first = -1;
  for (let i = 0; i < BOARD_SIZE; i++) {
    const c = G.board[i];
    if (c && c.f === f && c.t === tier) {
      if (first < 0) first = i;
      else return { from: first, to: i };
    }
  }
  return null;
}
function findAnyMerge() {
  for (const f of D.families) for (let t = 1; t < MAX_TIER; t++) if (findPair(f.id, t)) return true;
  return false;
}

// applies one merge to STATE; returns {newTier, golden}
export function applyMerge(from, to) {
  const a = G.board[from], b = G.board[to];
  if (!canMerge(a, b)) return null;
  const golden = rollGolden(Math.random);
  const newTier = mergeTier(a.t);
  const hap = Math.round(((a.hap || 0) + (b.hap || 0)) / 2);
  G.board[to] = { f: a.f, t: newTier, gold: golden, hap };
  G.board[from] = null;
  G.stats.merges++;
  if (golden) G.stats.goldens++;
  BV_discover(`${a.f}:${newTier}`);
  return { newTier, golden, family: a.f };
}

function doMerge(from, to) {
  const res = applyMerge(from, to);
  if (!res) return;
  const t = tierOf(res.family, res.newTier);
  const now = Date.now();
  if (now - lastMergeAt < COMBO_WINDOW_MS) combo++;
  else combo = 1;
  lastMergeAt = now;

  const p = cellCenter(to);
  if (res.golden) {
    sfx('golden');
    pipCelebrate(`GOLDEN ${t.name}! Worth 3x! ✨`);
    burst(p.x, p.y, ['#ffd700', '#fff7cc', '#ffb700'], 26);
  } else {
    sfx('merge');
    burst(p.x, p.y, [D.familyById[res.family].color, '#ffffff'], 12);
  }
  if (combo >= 3) {
    const bonus = combo * 2;
    G.coins += bonus;
    floatText(p.x, p.y - 24, `Combo x${combo}! +${bonus}🪙`, 'combo');
    sfx('coin');
  }
  floatText(p.x, p.y - 8, t.name + (res.golden ? ' ✨' : ''), res.golden ? 'goldname' : '');
  addXP(2);
  renderBoard(); renderPackets(); saveGame();
  if (window.BV && window.BV.tutorialTap) window.BV.tutorialTap('merge');
}

// ---------- Bloom Burst: full cascade, wave by wave, tier 1 upward ----------
const sleep = ms => new Promise(r => setTimeout(r, ms));
export async function doBloomBurst() {
  if (burstRunning || boardLocked) return;
  if (!findAnyMerge()) { toast('No merges available — plant more seeds first! 🌱'); sfx('error'); return; }
  burstRunning = true; boardLocked = true; selected = -1;
  renderBoard();
  sfx('burst');
  shakeScreen();
  pipCelebrate('🌸 BLOOM BURST! Watch them pop! 🌸');
  let count = 0, goldens = 0;
  let changed = true;
  while (changed) {
    changed = false;
    for (let tier = 1; tier < MAX_TIER; tier++) {
      for (const f of D.families) {
        let pair;
        while ((pair = findPair(f.id, tier))) {
          const res = applyMerge(pair.from, pair.to);
          if (!res) break;
          count++; if (res.golden) goldens++;
          changed = true;
          renderBoard();
          const p = cellCenter(pair.to);
          burst(p.x, p.y, res.golden ? ['#ffd700', '#fff7cc'] : [f.color, '#ffffff'], res.golden ? 22 : 10);
          if (res.golden) sfx('golden'); else sfx('merge');
          await sleep(150);
        }
      }
    }
  }
  G.stats.bursts++;
  addXP(10 + count * 2);
  toast(`🌸 Bloom Burst! ${count} merge${count === 1 ? '' : 's'}${goldens ? ` — ${goldens} GOLDEN ✨` : ''}!`);
  burstRunning = false; boardLocked = false;
  renderBoard(); renderPackets(); saveGame();
  if (window.BV && window.BV.checkMilestones) window.BV.checkMilestones();
}

// ---------- sell / solarium ----------
function weatherSellMult() { return (window.BV && window.BV.weather && window.BV.weather.sellMult) || 1; }

export function sellSelected() {
  if (selected < 0 || !G.board[selected]) { toast('Tap a plant first, then Sell. 🌱'); sfx('error'); return; }
  const c = G.board[selected];
  const t = tierOf(c.f, c.t);
  const value = Math.round(sellValue(t.sell, c.gold, c.hap) * weatherSellMult());
  const p = cellCenter(selected);
  G.board[selected] = null;
  selected = -1;
  sfx('sell');
  burst(p.x, p.y, ['#ffd76e', '#fff3c4'], 14);
  floatText(p.x, p.y - 10, `+${value} 🪙${c.hap >= 80 ? ' 💛 joyful!' : ''}`, 'coins');
  window.BV.addCoins(value);
  if (c.gold) pipCelebrate(`Sold a golden ${t.name} for ${value} coins! Cha-ching!`);
  renderBoard(); renderPackets(); saveGame();
}

export function sendToSolarium() {
  if (selected < 0 || !G.board[selected]) { toast('Tap a plant first, then Solarium. ☀️'); sfx('error'); return; }
  const c = G.board[selected];
  if (c.t < 4) { toast('Only tier 4+ plants can enter the Solarium. Merge it up! 🌱'); sfx('error'); return; }
  const ok = window.BV.solarium.transferIn({ f: c.f, t: c.t, gold: c.gold });
  if (ok) {
    G.board[selected] = null;
    selected = -1;
    sfx('chime');
    toast('☀️ Plant moved to the Solarium — it will make Dewdrops passively!');
    renderBoard(); renderPackets(); saveGame();
    if (window.BV && window.BV.checkMilestones) window.BV.checkMilestones();
  }
}

function BV_discover(key) { if (window.BV && window.BV.discover) window.BV.discover(key); }
