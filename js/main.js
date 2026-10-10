// main.js — boot + orchestration. Wires every module into window.BV.
import { loadData } from './data.js?v=1';
import { loadGame, saveGame, startAutosave, exportJSON, importJSON, newGame } from './state.js?v=1';
import { levelFromXp, rollDay } from './logic.js?v=1';
import {
  updateHUD, addCoins, addDew, addRenown, addXP,
  openPanel, closePanels, modal, closeModal, confirmDlg, toast, img,
} from './ui.js?v=1';
import { initPip, say as pipSay, celebrate as pipCelebrate, startChatter } from './pip.js?v=1';
import { unlock as audioUnlock, startMusic, setToggles as audioSetToggles, sfx } from './audio.js?v=1';
import { initFarm, openLandShop, openDecorShop, renderPlots, refreshWeather } from './farm.js?v=1';
import { initNursery, renderBoard, renderPackets } from './nursery.js?v=1';
import { initCrops } from './cropsys.js?v=1';
import { initSolarium, renderSolarium, collectOffline, transferIn as solariumTransferIn } from './solarium.js?v=1';
import { initOrders, renderOrders } from './orders.js?v=1';
import { initCodex, renderCodex } from './codex.js?v=1';
import { initTutorial, startTutorial, wireTutorialBar, onGameTap } from './tutorial.js?v=1';

window.BV = window.BV || {};
const BV = window.BV;

function bootError(msg) {
  document.body.innerHTML = `<div class="boot-error"><h2>🌱 Oh no!</h2><p>${msg}</p><button class="btn" onclick="location.reload()">Try again</button></div>`;
}

async function boot() {
  let data;
  try {
    data = await loadData();
  } catch (e) {
    bootError('Could not load game data. Check your connection and reload.<br><small>' + String(e.message || e) + '</small>');
    return false;
  }

  const G = loadGame();
  BV._G = G; // live state ref for module helpers (discover/checkMilestones)

  // ---- BV registry (cross-module calls go through here; no import cycles) ----
  BV.data = data;
  BV.updateHUD = updateHUD;
  BV.addCoins = addCoins; BV.addDew = addDew; BV.addRenown = addRenown; BV.addXP = addXP;
  BV.discover = discover;
  BV.checkMilestones = checkMilestones;
  BV.tutorialTap = onGameTap;
  BV.nursery = { renderBoard, renderPackets };
  BV.solarium = { transferIn: solariumTransferIn, renderSolarium };
  BV.farm = { renderPlots, openLandShop, openDecorShop };
  BV.orders = { renderOrders };

  audioSetToggles(!!G.settings.music, !!G.settings.sfx);

  initPip(data.chatter);
  initFarm(data);
  initNursery(data);
  initCrops(data);
  initSolarium(data);
  initOrders(data);
  initCodex(data);
  initTutorial(data);
  wireTutorialBar();
  wireNav();
  wireMenu();

  updateHUD();
  renderMilestones();

  // offline gains (needs solarium rates -> after initSolarium)
  collectOffline();

  // audio unlocks on first gesture
  const unlockOnce = () => {
    audioUnlock();
    startMusic();
    window.removeEventListener('pointerdown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce);

  document.getElementById('panel-veil').onclick = closePanels;

  startAutosave();
  startChatter(28000);
  checkMilestones();

  // day rollover watcher (weather + seed price resets)
  setInterval(() => {
    const before = G.day;
    rollDay(G);
    if (G.day !== before) {
      refreshWeather();
      renderPackets();
      pipSay('A brand-new day! Seed prices are back to cheap. 🌱');
      saveGame();
    }
  }, 60000);

  // (tutorial autostart is scheduled in bootOnce, after BV._G is set)
  return true;
}

// ---------- codex discovery ----------
function discover(key) {
  const G = BV_G();
  if (!G || G.stats.discovered.includes(key)) return;
  G.stats.discovered.push(key);
  saveGame();
  toast('📖 New Codex discovery!');
  sfx('chime');
  renderCodex();
}
function BV_G() {
  // G singleton lives in state.js; grab via BV ref set at boot
  return BV._G || null;
}

// ---------- milestones ----------
const MCOND = {
  first_sprout: G => G.stats.discovered.some(k => /^(fh|cs):1$/.test(k)),
  first_merge: G => G.stats.merges >= 1,
  merges_10: G => G.stats.merges >= 10,
  first_harvest: G => G.stats.harvests >= 1,
  first_order: G => G.stats.ordersFilled >= 1,
  orders_5: G => G.stats.ordersFilled >= 5,
  first_golden: G => G.stats.goldens >= 1,
  solarium_plant: G => (G.stats.solariumPlaced || 0) >= 1,
  plots_10: G => G.plots.filter(p => p.owned).length >= 10,
  farm_level_3: G => levelFromXp(G.xp).level >= 3,
  plants_16: G => G.stats.discovered.filter(k => /^(fh|cs):/.test(k)).length >= 16,
  dew_1000: G => G.stats.dewEarned >= 1000,
};
function checkMilestones() {
  const G = BV_G();
  if (!G || !BV.data) return;
  for (const m of BV.data.milestones) {
    if (G.milestones[m.id]) continue;
    const cond = MCOND[m.id];
    if (cond && cond(G)) {
      G.milestones[m.id] = true; // claim first: rewards below re-enter safely
      const r = m.rewards || {};
      if (r.coins) G.coins += r.coins;
      if (r.dew) { G.dew += r.dew; G.stats.dewEarned += r.dew; }
      if (r.renown) G.renown += r.renown;
      updateHUD(); saveGame();
      toast(`🏆 Milestone: <b>${m.name}</b>!`);
      sfx('fanfare');
      renderMilestones();
    }
  }
}
function renderMilestones() {
  const G = BV_G();
  const wrap = document.getElementById('milestones-list');
  if (!wrap || !G || !BV.data) return;
  wrap.innerHTML = BV.data.milestones.map(m => {
    const done = !!G.milestones[m.id];
    const r = m.rewards || {};
    const rw = [r.coins ? `🪙${r.coins}` : '', r.dew ? `💧${r.dew}` : '', r.renown ? `⭐${r.renown}` : ''].filter(Boolean).join(' ');
    return `<div class="ms-row ${done ? 'done' : ''}"><span>${done ? '✅' : '🔲'} <b>${m.name}</b><br><small>${m.desc}</small></span><span class="ms-rw">${rw}</span></div>`;
  }).join('');
}

// ---------- nav ----------
function wireNav() {
  const go = (id, fn) => {
    const b = document.getElementById(id);
    if (b) b.onclick = () => { sfx('click'); fn(); };
  };
  go('nav-farm', () => closePanels());
  go('nav-nursery', () => { openPanel('panel-nursery'); renderBoard(); renderPackets(); });
  go('nav-stand', () => { openPanel('panel-stand'); renderOrders(); });
  go('nav-solarium', () => { openPanel('panel-solarium'); renderSolarium(); });
  go('nav-codex', () => { openPanel('panel-codex'); renderCodex(); });
  go('nav-menu', () => { openPanel('panel-menu'); renderMilestones(); syncToggles(); });
}

// ---------- menu / settings ----------
function syncToggles() {
  const G = BV_G();
  const m = document.getElementById('set-music');
  const s = document.getElementById('set-sfx');
  if (m) m.innerHTML = `🔊 Music: <b>${G.settings.music ? 'On' : 'Off'}</b>`;
  if (s) s.innerHTML = `🔔 SFX: <b>${G.settings.sfx ? 'On' : 'Off'}</b>`;
}
function wireMenu() {
  const G0 = () => BV_G();
  document.getElementById('set-music').onclick = () => {
    const G = G0(); G.settings.music = !G.settings.music;
    audioSetToggles(G.settings.music, G.settings.sfx);
    if (G.settings.music) startMusic();
    saveGame(); syncToggles(); sfx('click');
  };
  document.getElementById('set-sfx').onclick = () => {
    const G = G0(); G.settings.sfx = !G.settings.sfx;
    audioSetToggles(G.settings.music, G.settings.sfx);
    saveGame(); syncToggles(); sfx('click');
  };
  document.getElementById('btn-landshop').onclick = () => { closePanels(); openLandShop(); };
  document.getElementById('btn-decorshop').onclick = () => { closePanels(); openDecorShop(); };
  document.getElementById('btn-tutorial').onclick = () => { closePanels(); setTimeout(startTutorial, 400); };
  document.getElementById('btn-export').onclick = () => {
    const json = exportJSON();
    const m = modal(`<h3>💾 Export save</h3><p class="modal-sub">Copy this text somewhere safe:</p>
      <textarea id="exp-text" readonly>${json}</textarea>
      <div class="modal-btns"><button class="btn btn-ghost" id="exp-close">Close</button><button class="btn" id="exp-copy">Copy</button></div>`);
    m.querySelector('#exp-close').onclick = closeModal;
    m.querySelector('#exp-copy').onclick = async () => {
      try { await navigator.clipboard.writeText(json); toast('Save copied! 📋'); }
      catch (e) { m.querySelector('#exp-text').select(); toast('Select the text and copy it manually.'); }
    };
  };
  document.getElementById('btn-import').onclick = () => {
    const m = modal(`<h3>📥 Import save</h3><p class="modal-sub">Paste a Bloomville save below:</p>
      <textarea id="imp-text" placeholder='{"version":"bloomville_v1",...}'></textarea>
      <div class="modal-btns"><button class="btn btn-ghost" id="imp-close">Close</button><button class="btn" id="imp-go">Import</button></div>`);
    m.querySelector('#imp-close').onclick = closeModal;
    m.querySelector('#imp-go').onclick = () => {
      try { importJSON(m.querySelector('#imp-text').value); toast('Save imported! Reloading...'); setTimeout(() => location.reload(), 800); }
      catch (e) { toast('That does not look like a Bloomville save. 😕'); sfx('error'); }
    };
  };
  document.getElementById('btn-newgame').onclick = async () => {
    const first = await confirmDlg('🔄 New Game?', 'Start completely over? Your farm, plants, and coins will be gone forever.', 'Yes, restart');
    if (!first) return;
    const second = await confirmDlg('Really sure?', 'This is the <b>last chance</b>. Everything will be erased.', 'Erase it all');
    if (!second) return;
    newGame();
    toast('Fresh soil! Welcome to Bloomville. 🌱');
    setTimeout(() => location.reload(), 800);
  };
}

// state.js owns the G singleton; boot() stores the live ref at BV._G.

let booted = false;
async function bootOnce() {
  if (booted) return;
  booted = true;
  const ok = await boot();
  if (!ok || !BV._G) return; // boot error screen is already showing
  renderMilestones();
  updateHUD();
  if (!BV_G().tutorial.done) setTimeout(() => { if (!document.getElementById('tutorial-bar').classList.contains('show')) startTutorial(); }, 1600);
  else setTimeout(() => pipSay('Welcome back to Bloomville! The farm missed you. 🌸'), 2000);
}

document.addEventListener('DOMContentLoaded', bootOnce);
// module scripts are deferred; if parsing already finished, boot now
if (document.readyState !== 'loading') bootOnce();
