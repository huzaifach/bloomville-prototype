// solarium.js — 5 slots for tier-4+ plants. Passive Dewdrops + offline gains (12h cap).
import { G, saveGame } from './state.js?v=1';
import { solariumDewPerSec, offlineGains, pickRandomEmpty, SOLARIUM_SLOTS, SOLARIUM_MIN_TIER } from './logic.js?v=1';
import { img, plantImg, toast, addDew, updateHUD, modal, closeModal, confirmDlg } from './ui.js?v=1';
import { burst } from './fx.js?v=1';
import { sfx } from './audio.js?v=1';
import { say as pipSay, celebrate as pipCelebrate } from './pip.js?v=1';

let D = null;
let dewAcc = 0;

export function initSolarium(data) {
  D = data;
  renderSolarium();
  // passive accrual tick — rewards, not waiting
  setInterval(() => {
    const rate = totalRate();
    if (rate <= 0) return;
    dewAcc += rate;
    if (dewAcc >= 1) {
      const n = Math.floor(dewAcc);
      dewAcc -= n;
      G.dew += n;
      G.stats.dewEarned += n;
      updateHUD();
    }
  }, 1000);
}

function dewMult() { return (window.BV && window.BV.weather && window.BV.weather.dewMult) || 1; }

export function totalRate() {
  let r = 0;
  for (const s of G.solarium) {
    if (!s) continue;
    const t = D.familyById[s.f].tiers[s.t - 1];
    r += solariumDewPerSec(t.dew) * (s.gold ? 2 : 1);
  }
  return r * dewMult();
}

export function transferIn(plant) {
  const i = G.solarium.findIndex(s => !s);
  if (i < 0) { toast('Solarium is full! (5 slots) ☀️'); sfx('error'); return false; }
  G.solarium[i] = { f: plant.f, t: plant.t, gold: !!plant.gold };
  G.stats.solariumPlaced = (G.stats.solariumPlaced || 0) + 1;
  renderSolarium();
  saveGame();
  return true;
}

export function collectOffline() {
  const elapsed = (Date.now() - (G.lastSeen || Date.now())) / 1000;
  if (elapsed < 60) return; // been gone less than a minute — nothing to say
  const gains = offlineGains(totalRate(), elapsed);
  if (gains > 0) {
    G.dew += gains;
    G.stats.dewEarned += gains;
    updateHUD(); saveGame();
    const hrs = Math.min(12, elapsed / 3600);
    const m = modal(`<h3>🌙 Welcome back, farmer!</h3>
      <p>Pip kept the Solarium cozy while you were away (${hrs >= 1 ? hrs.toFixed(1) + 'h' : Math.round(elapsed / 60) + 'm'}).</p>
      <p class="big-reward">+${gains} 💧 Dewdrops</p>
      <div class="modal-btns"><button class="btn" id="wb-ok">Lovely!</button></div>`);
    m.querySelector('#wb-ok').onclick = closeModal;
    pipCelebrate(`Welcome back! Your Solarium made ${gains} dewdrops while you were gone!`);
    sfx('chime');
  }
}

export function renderSolarium() {
  const wrap = document.getElementById('solarium-slots');
  if (!wrap || !D) return;
  wrap.innerHTML = G.solarium.map((s, i) => {
    if (!s) return `<button class="sol-slot empty" data-i="${i}" aria-label="empty solarium slot"><span>+</span></button>`;
    const f = D.familyById[s.f];
    const t = f.tiers[s.t - 1];
    const rate = solariumDewPerSec(t.dew) * (s.gold ? 2 : 1) * dewMult();
    return `<button class="sol-slot" data-i="${i}" aria-label="${t.name} in solarium">
      ${plantImg(D, s.f, s.t, 'sol-img' + (s.gold ? ' golden' : ''))}
      <span class="sol-name">${t.name}${s.gold ? ' ✨' : ''}</span>
      <span class="sol-rate">💧 ${(rate * 3600).toFixed(0)}/h</span>
    </button>`;
  }).join('');
  const info = document.getElementById('solarium-info');
  if (info) {
    const r = totalRate();
    info.innerHTML = r > 0
      ? `☀️ Earning <b>💧${(r * 3600).toFixed(0)}/hour</b> passively — even while you're away (up to 12h).`
      : `☀️ The Solarium is empty. Move tier ${SOLARIUM_MIN_TIER}+ plants here from the nursery!`;
  }
  wrap.querySelectorAll('.sol-slot').forEach(b => {
    b.onclick = () => slotTap(+b.dataset.i);
  });
}

function slotTap(i) {
  const s = G.solarium[i];
  if (!s) { toast('Empty slot — send a tier 4+ plant here from the nursery! ☀️'); return; }
  const t = D.familyById[s.f].tiers[s.t - 1];
  confirmDlg(t.name, 'Move this plant back to the nursery board? (Needs an empty cell.)', 'Move').then(ok => {
    if (!ok) return;
    const idx = pickRandomEmpty(G.board, Math.random);
    if (idx < 0) { toast('Nursery board is full!'); sfx('error'); return; }
    G.board[idx] = { f: s.f, t: s.t, gold: s.gold, hap: 60 };
    G.solarium[i] = null;
    sfx('click');
    renderSolarium();
    if (window.BV && window.BV.nursery) window.BV.nursery.renderBoard();
    saveGame();
  });
}
