// ui.js — HUD, panels, modals, toasts, economy helpers. Imports pip+audio (no cycles).
import { G, saveGame } from './state.js?v=1';
import { fmt, levelFromXp, levelUpGift } from './logic.js?v=1';
import { say as pipSay, celebrate as pipCelebrate } from './pip.js?v=1';
import { sfx } from './audio.js?v=1';
import { flyCoins, flyDew, floatText } from './fx.js?v=1';

// ---- image helper: every game <img> goes through this so a missing art file
// ---- degrades to a cute colored blob instead of a broken-image icon.
window.__imgFallback = function (img) {
  img.onerror = null;
  const color = img.dataset.color || '#9fd08a';
  const label = img.dataset.label || '?';
  const d = document.createElement('div');
  d.className = img.className + ' img-fallback';
  d.style.background = `radial-gradient(circle at 35% 30%, ${color}, ${shade(color)})`;
  d.textContent = label.charAt(0).toUpperCase();
  d.setAttribute('role', 'img');
  d.setAttribute('aria-label', label);
  img.replaceWith(d);
};
function shade(hex) {
  try {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.max(0, Math.min(255, Math.round(v * 0.72)));
    return '#' + [f(n >> 16), f((n >> 8) & 255), f(n & 255)].map(v => v.toString(16).padStart(2, '0')).join('');
  } catch (e) { return '#6a8f5f'; }
}
export function img(src, alt, cls, color, label) {
  const c = (color || '#9fd08a').replace(/"/g, '');
  const l = (label || alt || '?').replace(/"/g, '');
  return `<img src="${src}?v=1" alt="${l}" class="${cls || ''}" draggable="false" data-color="${c}" data-label="${l}" onerror="__imgFallback(this)">`;
}
export function plantImg(data, familyId, tier, cls) {
  const f = data.familyById[familyId];
  const t = f.tiers[tier - 1];
  return img(t.art, t.name, (cls || 'plant-img') + (''), f.color, t.name);
}

// ---- HUD ----
export function updateHUD() {
  if (!G) return;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('hud-coins', fmt(G.coins));
  set('hud-dew', fmt(Math.floor(G.dew)));
  set('hud-renown', fmt(G.renown));
  const { level, intoLevel, need } = levelFromXp(G.xp);
  set('hud-level', 'Lv ' + level);
  const bar = document.getElementById('hud-xpfill');
  if (bar) bar.style.width = Math.min(100, (intoLevel / need) * 100) + '%';
}

// ---- economy (single choke point: HUD refresh + milestone hook) ----
function afterEcon() {
  updateHUD();
  saveGame();
  if (window.BV && window.BV.checkMilestones) window.BV.checkMilestones();
}
export function addCoins(n, fxFrom) {
  G.coins = Math.max(0, G.coins + n);
  if (n > 0 && fxFrom) flyCoins(fxFrom.x, fxFrom.y, Math.min(8, 3 + Math.floor(n / 50)));
  afterEcon();
}
export function addDew(n, fxFrom) {
  G.dew = Math.max(0, G.dew + n);
  if (n > 0) { G.stats.dewEarned += n; if (fxFrom) flyDew(fxFrom.x, fxFrom.y, 4); }
  afterEcon();
}
export function addRenown(n) { G.renown = Math.max(0, G.renown + n); afterEcon(); }
export function addXP(n) {
  const before = levelFromXp(G.xp).level;
  G.xp += n;
  const after = levelFromXp(G.xp).level;
  afterEcon();
  if (after > before) {
    const gift = levelUpGift(after);
    G.coins += gift.coins; G.dew += gift.dew; G.stats.dewEarned += gift.dew;
    updateHUD(); saveGame();
    sfx('fanfare');
    pipCelebrate(`Level ${after}! The valley cheers for you! Here's ${fmt(gift.coins)} coins and ${fmt(gift.dew)} dew!`);
    toast(`🎉 Farm Level ${after}! Gift: ${fmt(gift.coins)} 🪙 + ${fmt(gift.dew)} 💧`);
    if (window.BV && window.BV.checkMilestones) window.BV.checkMilestones();
  }
}

// ---- panels ----
export function openPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
  const p = document.getElementById(id);
  if (p) { p.classList.add('open'); sfx('click'); }
  const ov = document.getElementById('panel-veil');
  if (ov) ov.classList.add('show');
}
export function closePanels() {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('open'));
  const ov = document.getElementById('panel-veil');
  if (ov) ov.classList.remove('show');
}
export function isPanelOpen(id) {
  const p = document.getElementById(id);
  return !!(p && p.classList.contains('open'));
}

// ---- modal ----
export function modal(html, cls) {
  closeModal();
  const m = document.createElement('div');
  m.id = 'modal';
  m.className = 'modal ' + (cls || '');
  m.innerHTML = `<div class="modal-card">${html}</div>`;
  m.addEventListener('click', e => { if (e.target === m) closeModal(); });
  document.body.appendChild(m);
  return m;
}
export function closeModal() {
  const m = document.getElementById('modal');
  if (m) m.remove();
}
export function confirmDlg(title, body, okLabel = 'Yes') {
  return new Promise(resolve => {
    const m = modal(`
      <h3>${title}</h3>
      <p>${body}</p>
      <div class="modal-btns">
        <button class="btn btn-ghost" id="cf-no">Cancel</button>
        <button class="btn btn-danger" id="cf-yes">${okLabel}</button>
      </div>`);
    m.querySelector('#cf-no').onclick = () => { closeModal(); resolve(false); };
    m.querySelector('#cf-yes').onclick = () => { closeModal(); resolve(true); };
  });
}

// ---- toast ----
let toastTimer = null;
export function toast(msg, ms = 2600) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    document.body.appendChild(t);
  }
  t.innerHTML = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

export function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}
