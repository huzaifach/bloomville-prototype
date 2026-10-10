// farm.js — 2.5D dollhouse farm scene: tilted ground plane, depth-sorted sprites,
// plots (6 -> 12 via land shop), Potting House, pond + ducks, fences, clouds,
// decorations on marked spots, day/night tint + fireflies, weather pill.
import { G, saveGame } from './state.js?v=1';
import { TOTAL_PLOTS, START_PLOTS } from './logic.js?v=1';
import { img, toast, openPanel, modal, closeModal, confirmDlg } from './ui.js?v=1';
import { burst } from './fx.js?v=1';
import { sfx, setNight as audioSetNight } from './audio.js?v=1';
import { say as pipSay, celebrate as pipCelebrate } from './pip.js?v=1';
import { plotTap } from './cropsys.js?v=1';

let D = null;

// plot slots: 12 positions (left%, bottom%) on the tilted plane
const PLOT_POS = [
  { x: 6, y: 8 }, { x: 29, y: 8 }, { x: 52, y: 8 }, { x: 75, y: 8 },
  { x: 6, y: 22 }, { x: 29, y: 22 }, { x: 52, y: 22 }, { x: 75, y: 22 },
  { x: 6, y: 36 }, { x: 29, y: 36 }, { x: 52, y: 36 }, { x: 75, y: 36 },
];
const DECOR_SPOTS = [
  { x: 30, y: 47 }, { x: 86, y: 30 }, { x: 8, y: 30 },
];
const WEATHERS = [
  { id: 'sunny', name: 'Sunny', icon: '☀️', sellMult: 1, dewMult: 1 },
  { id: 'breezy', name: 'Breezy', icon: '🍃', sellMult: 1.05, dewMult: 1 },
  { id: 'rainy', name: 'Rainy', icon: '🌧️', sellMult: 1, dewMult: 1.1 },
  { id: 'windy', name: 'Windy', icon: '💨', sellMult: 1, dewMult: 1 },
];

export function initFarm(data) {
  D = data;
  buildScene();
  renderPlots();
  renderDecorSpots();
  ensureWeather();
  renderWeatherPill();
  startDayNight();
}

export function currentWeather() {
  if (window.BV && window.BV.weather) return window.BV.weather;
  return WEATHERS[0];
}
function ensureWeather() {
  if (!G.weather || G.weather.day !== G.day) {
    const w = WEATHERS[Math.floor(Math.random() * WEATHERS.length)];
    G.weather = { id: w.id, day: G.day };
    saveGame();
  }
  window.BV.weather = WEATHERS.find(w => w.id === (G.weather && G.weather.id)) || WEATHERS[0];
}

function buildScene() {
  const scene = document.getElementById('farm-scene');
  if (!scene || scene.dataset.built) return;
  scene.dataset.built = '1';

  scene.innerHTML = `
    <div class="sky">
      ${img('assets/farm/cloud1.png', 'cloud', 'cloud c1', '#ffffff', 'cloud')}
      ${img('assets/farm/cloud2.png', 'cloud', 'cloud c2', '#ffffff', 'cloud')}
    </div>
    <div class="tilt">
      <div class="grass"></div>
      <div class="fence-strip">${img('assets/farm/fence.png', 'fence', 'fence-img', '#b08968', 'fence')}</div>
      <button class="sprite house" id="house-btn" style="left:2%;bottom:56%;z-index:56" aria-label="Potting House">
        ${img('assets/farm/house.png', 'Potting House', 'sprite-img', '#c98f5f', 'Potting House')}
        <span class="sprite-label">🏠 Potting House</span>
      </button>
      <button class="sprite stand" id="stand-btn" style="left:64%;bottom:54%;z-index:54" aria-label="Farm Stand">
        ${img('assets/farm/stand.png', 'Farm Stand', 'sprite-img', '#d8a05f', 'Farm Stand')}
        <span class="sprite-label">🧺 Farm Stand</span>
      </button>
      <div class="sprite pond" id="pond-wrap" style="left:56%;bottom:24%;z-index:24">
        ${img('assets/farm/pond.png', 'pond', 'sprite-img', '#7ec8e3', 'pond')}
        <button class="duck" id="duck1" aria-label="duck">${img('assets/farm/duck.png', 'duck', 'duck-img', '#ffd76e', 'duck')}</button>
        <button class="duck" id="duck2" aria-label="duck">${img('assets/farm/duck.png', 'duck', 'duck-img', '#ffd76e', 'duck')}</button>
      </div>
      <div id="plots"></div>
      <div id="decor-layer"></div>
    </div>
    <div class="night-tint" id="night-tint"></div>
    <div id="fireflies"></div>
    <button id="weather-pill" aria-label="weather"></button>
  `;

  document.getElementById('house-btn').onclick = () => {
    sfx('click');
    openPanel('panel-nursery');
    if (window.BV && window.BV.nursery) { window.BV.nursery.renderBoard(); window.BV.nursery.renderPackets(); }
  };
  document.getElementById('stand-btn').onclick = () => {
    sfx('click');
    openPanel('panel-stand');
    if (window.BV && window.BV.orders) window.BV.orders.renderOrders();
  };
  const quack = id => {
    const d = document.getElementById(id);
    if (d) d.onclick = e => {
      e.stopPropagation();
      sfx('quack');
      d.classList.remove('flip'); void d.offsetWidth; d.classList.add('flip');
      const r = d.getBoundingClientRect();
      burst(r.left + r.width / 2, r.top, ['#bfe8ff', '#ffffff'], 6);
    };
  };
  quack('duck1'); quack('duck2');

  document.getElementById('weather-pill').onclick = () => {
    const w = currentWeather();
    toast(`${w.icon} ${w.name} today! ${w.id === 'breezy' ? '+5% sell prices' : w.id === 'rainy' ? '+10% dew' : 'Perfect farming weather.'}`);
    sfx('click');
  };

  // fireflies
  const ff = document.getElementById('fireflies');
  let fhtml = '';
  for (let i = 0; i < 14; i++) {
    fhtml += `<span class="firefly" style="left:${5 + Math.random() * 90}%;top:${30 + Math.random() * 60}%;animation-delay:${(Math.random() * 4).toFixed(1)}s"></span>`;
  }
  ff.innerHTML = fhtml;
}

// ---------- plots ----------
export function renderPlots() {
  const wrap = document.getElementById('plots');
  if (!wrap) return;
  wrap.innerHTML = '';
  for (let i = 0; i < TOTAL_PLOTS; i++) {
    const p = G.plots[i];
    const pos = PLOT_POS[i];
    const b = document.createElement('button');
    b.className = 'plot' + (p.owned ? '' : ' locked');
    b.dataset.i = i;
    b.style.left = pos.x + '%';
    b.style.bottom = pos.y + '%';
    b.style.zIndex = Math.round(pos.y);
    if (!p.owned) {
      const price = plotPrice(i);
      b.setAttribute('aria-label', `buy plot ${i + 1} for ${price} coins`);
      b.innerHTML = `<span class="plot-lock">🔒<br>🪙${price}</span>`;
      b.onclick = () => buyPlot(i);
    } else {
      b.setAttribute('aria-label', `plot ${i + 1}`);
      let inner = img('assets/farm/plot-soil.png', 'soil', 'soil-img', '#8a5a33', 'soil');
      if (p.crop) {
        if (p.crop.growing) inner += img('assets/farm/plot-sprout.png', 'sprout', 'crop-img growing', '#7ec850', 'sprout');
        else {
          const c = D.cropById[p.crop.id];
          inner += img(c.art, c.name, 'crop-img', '#a8d86e', c.name);
        }
      } else {
        inner += '<span class="plot-plus">+</span>';
      }
      b.innerHTML = inner;
      b.onclick = () => plotTap(i);
    }
    wrap.appendChild(b);
  }
}

export function plotPrice(i) {
  const row = D.plots.find(p => p.plot === i + 1);
  return row ? row.price : 999999;
}

export function buyPlot(i) {
  const price = plotPrice(i);
  if (G.coins < price) { toast(`Need 🪙${price} for plot ${i + 1}. Keep farming!`); sfx('error'); return; }
  confirmDlg('Buy plot?', `Plot ${i + 1} costs <b>🪙${price}</b>. More soil, more harvests!`, 'Buy').then(ok => {
    if (!ok) return;
    if (G.coins < price) { toast('Not enough coins!'); return; }
    G.coins -= price;
    G.plots[i].owned = true;
    sfx('fanfare');
    const owned = G.plots.filter(p => p.owned).length;
    pipSay(`Plot ${i + 1} is yours! ${owned} plots and growing!`);
    renderPlots();
    if (window.BV && window.BV.updateHUD) window.BV.updateHUD();
    saveGame();
    if (window.BV && window.BV.checkMilestones) window.BV.checkMilestones();
  });
}

export function openLandShop() {
  const rows = D.plots.map(r => {
    const i = r.plot - 1;
    const owned = G.plots[i] && G.plots[i].owned;
    return `<div class="shop-row">
      <span>🌱 Plot ${r.plot}</span>
      ${owned ? '<span class="owned">Owned ✓</span>'
        : `<button class="btn btn-small" data-plot="${i}" ${G.coins < r.price ? 'disabled' : ''}>🪙 ${r.price}</button>`}
    </div>`;
  }).join('');
  const m = modal(`<h3>🏞️ Land Shop</h3><p class="modal-sub">More plots, more harvests. Prices only go up!</p>${rows}
    <div class="modal-btns"><button class="btn btn-ghost" id="ls-close">Close</button></div>`);
  m.querySelector('#ls-close').onclick = closeModal;
  m.querySelectorAll('[data-plot]').forEach(b => {
    b.onclick = () => { closeModal(); buyPlot(+b.dataset.plot); };
  });
}

// ---------- decorations ----------
function ownedUnplaced() {
  const bought = {};
  // bought counts are derived: placed + unplaced; track purchases in G.decorBought
  return bought;
}
function decorInventory() {
  // G.decorBought: {id: n}; G.decor: [{spot, id}]
  const bought = G.decorBought || {};
  const placed = {};
  for (const d of G.decor) placed[d.id] = (placed[d.id] || 0) + 1;
  const inv = {};
  for (const d of D.decorations) inv[d.id] = (bought[d.id] || 0) - (placed[d.id] || 0);
  return inv;
}

export function renderDecorSpots() {
  const layer = document.getElementById('decor-layer');
  if (!layer) return;
  layer.innerHTML = '';
  DECOR_SPOTS.forEach((s, si) => {
    const placed = G.decor.find(d => d.spot === si);
    const b = document.createElement('button');
    b.className = 'decor-spot' + (placed ? ' filled' : '');
    b.style.left = s.x + '%'; b.style.bottom = s.y + '%'; b.style.zIndex = Math.round(s.y);
    if (placed) {
      const dec = D.decorById[placed.id];
      b.innerHTML = img(dec.art, dec.name, 'decor-img', '#c9a06a', dec.name);
      b.setAttribute('aria-label', dec.name + ' (tap for options)');
      b.onclick = () => decorOptions(si, placed);
    } else {
      b.innerHTML = '<span class="spot-ring">✨</span>';
      b.setAttribute('aria-label', 'empty decoration spot');
      b.onclick = () => spotTap(si);
    }
    layer.appendChild(b);
  });
}

function spotTap(si) {
  const inv = decorInventory();
  const avail = D.decorations.filter(d => inv[d.id] > 0);
  if (!avail.length) { openDecorShop(); toast('Buy a decoration first, then tap a ✨ spot to place it!'); return; }
  const cards = avail.map(d => `
    <button class="crop-card" data-id="${d.id}">
      ${img(d.art, d.name, 'crop-card-img', '#c9a06a', d.name)}
      <span class="crop-card-name">${d.name}</span>
      <span class="crop-card-meta">owned: ${inv[d.id]}</span>
    </button>`).join('');
  const m = modal(`<h3>✨ Place decoration</h3><div class="crop-grid">${cards}</div>
    <div class="modal-btns"><button class="btn btn-ghost" id="dp-close">Close</button></div>`);
  m.querySelector('#dp-close').onclick = closeModal;
  m.querySelectorAll('.crop-card').forEach(b => {
    b.onclick = () => {
      G.decor.push({ spot: si, id: b.dataset.id });
      closeModal(); sfx('chime');
      const dec = D.decorById[b.dataset.id];
      pipSay(`The ${dec.name} looks perfect there!`);
      renderDecorSpots(); saveGame();
    };
  });
}

function decorOptions(si, placed) {
  const dec = D.decorById[placed.id];
  confirmDlg(dec.name, `${dec.blurb}<br><br>Remove it? You get back <b>🪙${Math.floor(dec.cost / 2)}</b> (half price).`, 'Remove').then(ok => {
    if (!ok) return;
    G.decor = G.decor.filter(d => d.spot !== si);
    G.coins += Math.floor(dec.cost / 2);
    sfx('sell');
    renderDecorSpots();
    if (window.BV && window.BV.updateHUD) window.BV.updateHUD();
    saveGame();
  });
}

export function openDecorShop() {
  const inv = decorInventory();
  const rows = D.decorations.map(d => `
    <div class="shop-row">
      ${img(d.art, d.name, 'shop-thumb', '#c9a06a', d.name)}
      <span class="shop-name">${d.name}<br><small>${d.blurb}</small>${inv[d.id] > 0 ? `<br><small>owned (unplaced): ${inv[d.id]}</small>` : ''}</span>
      <button class="btn btn-small" data-id="${d.id}" ${G.coins < d.cost ? 'disabled' : ''}>🪙 ${d.cost}</button>
    </div>`).join('');
  const m = modal(`<h3>🏡 Decor Shop</h3><p class="modal-sub">Buy, then tap a ✨ spot on the farm to place.</p>${rows}
    <div class="modal-btns"><button class="btn btn-ghost" id="ds-close">Close</button></div>`);
  m.querySelector('#ds-close').onclick = closeModal;
  m.querySelectorAll('[data-id]').forEach(b => {
    b.onclick = () => {
      const d = D.decorById[b.dataset.id];
      if (G.coins < d.cost) { toast('Not enough coins!'); sfx('error'); return; }
      G.coins -= d.cost;
      G.decorBought = G.decorBought || {};
      G.decorBought[d.id] = (G.decorBought[d.id] || 0) + 1;
      sfx('coin');
      toast(`${d.name} bought! Tap a ✨ spot to place it.`);
      if (window.BV && window.BV.updateHUD) window.BV.updateHUD();
      saveGame();
      closeModal(); openDecorShop();
    };
  });
}

// ---------- day/night + weather pill ----------
let nightNow = false;
function startDayNight() {
  const apply = () => {
    const phase = (Date.now() / 1000 % 240) / 240; // 4-min cycle
    const night = phase > 0.5;
    if (night !== nightNow) {
      nightNow = night;
      const tint = document.getElementById('night-tint');
      if (tint) tint.style.opacity = night ? '0.38' : '0';
      document.getElementById('farm-scene').classList.toggle('night', night);
      audioSetNight(night);
    }
  };
  apply();
  setInterval(apply, 5000);
}

function renderWeatherPill() {
  const w = currentWeather();
  const pill = document.getElementById('weather-pill');
  if (pill) pill.innerHTML = `${w.icon} ${w.name}`;
}
export function refreshWeather() { ensureWeather(); renderWeatherPill(); }
