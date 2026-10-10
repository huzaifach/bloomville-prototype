// cropsys.js — crop fields: buy seed -> plant -> INSTANT juicy grow -> tap harvest.
// Zero waiting: the "grow" is a 0.6s pop animation, not a timer.
import { G, saveGame } from './state.js?v=1';
import { img, toast, addCoins, addXP, modal, closeModal } from './ui.js?v=1';
import { burst, floatText, popEl } from './fx.js?v=1';
import { sfx } from './audio.js?v=1';

let D = null;
export function initCrops(data) { D = data; }

export function plotTap(i) {
  const plot = G.plots[i];
  if (!plot || !plot.owned) return;
  if (!plot.crop) { openCropPicker(i); return; }
  if (plot.crop.growing) {
    // tap a growing crop = wiggle
    const el = document.querySelector(`.plot[data-i="${i}"] .crop-img`);
    if (el) { el.classList.remove('wiggle'); void el.offsetWidth; el.classList.add('wiggle'); }
    sfx('click');
    return;
  }
  harvest(i);
}

function openCropPicker(i) {
  sfx('click');
  const cards = D.crops.map(c => `
    <button class="crop-card" data-id="${c.id}" ${G.coins < c.seed ? 'disabled' : ''}>
      ${img(c.art, c.name, 'crop-card-img', '#a8d86e', c.name)}
      <span class="crop-card-name">${c.name}</span>
      <span class="crop-card-blurb">${c.blurb}</span>
      <span class="crop-card-meta">🌱 ${c.seed} 🪙 → sells ${c.sell} 🪙</span>
    </button>`).join('');
  const m = modal(`<h3>🌱 Plant a seed — Plot ${i + 1}</h3>
    <p class="modal-sub">Instant grow. No waiting, just juice.</p>
    <div class="crop-grid">${cards}</div>
    <div class="modal-btns"><button class="btn btn-ghost" id="cp-close">Close</button></div>`);
  m.querySelector('#cp-close').onclick = closeModal;
  m.querySelectorAll('.crop-card').forEach(b => {
    b.onclick = () => { closeModal(); plantCrop(i, b.dataset.id); };
  });
}

export function plantCrop(i, cropId) {
  const plot = G.plots[i];
  const crop = D.cropById[cropId];
  if (!plot || !plot.owned || plot.crop || !crop) return;
  if (G.coins < crop.seed) { toast('Not enough coins for that seed! 🪙'); sfx('error'); return; }
  G.coins -= crop.seed;
  plot.crop = { id: cropId, growing: true };
  sfx('plant');
  renderPlots();
  // juicy instant grow — animation only, ~0.6s
  setTimeout(() => {
    const p2 = G.plots[i];
    if (!p2 || !p2.crop) return;
    p2.crop.growing = false;
    sfx('pop');
    renderPlots();
    const el = document.querySelector(`.plot[data-i="${i}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top + r.height / 2, ['#a8d86e', '#ffffff', '#ffd76e'], 10);
      popEl(el);
    }
    saveGame();
  }, 650);
  saveGame();
  if (window.BV && window.BV.updateHUD) window.BV.updateHUD();
  if (window.BV && window.BV.tutorialTap) window.BV.tutorialTap('plant');
}

export function harvest(i) {
  const plot = G.plots[i];
  if (!plot || !plot.crop || plot.crop.growing) return;
  const crop = D.cropById[plot.crop.id];
  plot.crop = null;
  G.inv.crops[crop.id] = (G.inv.crops[crop.id] || 0) + 1;
  G.stats.harvests++;
  sfx('harvest');
  const el = document.querySelector(`.plot[data-i="${i}"]`);
  if (el) {
    const r = el.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top + r.height / 2, ['#ffd76e', '#a8d86e', '#ffffff'], 14);
    floatText(r.left + r.width / 2, r.top, `+1 ${crop.name}`, 'coins');
  }
  addXP(crop.xp);
  if (window.BV && window.BV.discover) window.BV.discover('crop:' + crop.id);
  renderPlots();
  saveGame();
  if (window.BV && window.BV.checkMilestones) window.BV.checkMilestones();
  if (window.BV && window.BV.tutorialTap) window.BV.tutorialTap('harvest');
}

// farm.js owns renderPlots; cropsys calls through BV to avoid a cycle
function renderPlots() { if (window.BV && window.BV.farm) window.BV.farm.renderPlots(); }
