// orders.js — Orders 2.0 (basic): 3 dynamic visitor orders, crop+plant bundles,
// coin/dew/Renown rewards, slot refresh with chime + Pip announcement.
import { G, saveGame } from './state.js?v=1';
import { checkOrder, consumeBoardPlants, levelFromXp } from './logic.js?v=1';
import { img, plantImg, toast, addCoins, addDew, addRenown, addXP } from './ui.js?v=1';
import { burst } from './fx.js?v=1';
import { sfx } from './audio.js?v=1';
import { say as pipSay } from './pip.js?v=1';

let D = null;

export function initOrders(data) {
  D = data;
  if (!Array.isArray(G.orders) || G.orders.length !== 3) {
    G.orders = [genOrder(), genOrder(), genOrder()];
    saveGame();
  }
}

function genOrder() {
  const visitor = D.visitors[Math.floor(Math.random() * D.visitors.length)];
  const tpl = D.templates[Math.floor(Math.random() * D.templates.length)];
  // avoid immediate duplicate of the same template in the 3 slots
  return { visitorId: visitor.id, templateId: tpl.id, key: Math.random().toString(36).slice(2) };
}
function orderDef(o) {
  return {
    visitor: D.visitors.find(v => v.id === o.visitorId),
    tpl: D.templates.find(t => t.id === o.templateId),
  };
}

function itemIcon(item) {
  if (item.kind === 'crop') {
    const c = D.cropById[item.id];
    return img(c.art, c.name, 'order-item-img', '#a8d86e', c.name);
  }
  const f = D.familyById[item.family];
  const t = f.tiers[item.tier - 1];
  return plantImg(D, item.family, item.tier, 'order-item-img');
}
function itemName(item) {
  if (item.kind === 'crop') return D.cropById[item.id].name;
  const f = D.familyById[item.family];
  return `${f.tiers[item.tier - 1].name} <small>(${f.name})</small>`;
}

export function renderOrders() {
  const wrap = document.getElementById('orders-list');
  if (!wrap || !D) return;
  wrap.innerHTML = G.orders.map((o, si) => {
    const { visitor, tpl } = orderDef(o);
    const inv = { crops: G.inv.crops, board: G.board };
    const check = checkOrder(tpl, inv);
    const items = tpl.items.map(it => {
      const miss = check.missing.find(m => m.item === it);
      return `<div class="order-item ${miss ? 'missing' : 'have'}">
        ${itemIcon(it)}
        <span>${itemName(it)} × ${it.qty}${miss ? ` <em>(have ${miss.have})</em>` : ' ✓'}</span>
      </div>`;
    }).join('');
    const r = tpl.rewards;
    return `<div class="order-card">
      <div class="order-head">
        ${img(visitor.art, visitor.name, 'visitor-img', '#d8a05f', visitor.name)}
        <div><b>${visitor.name}</b><br><small>${visitor.tagline}</small></div>
      </div>
      <div class="order-quirk">"${visitor.hello}"</div>
      <div class="order-items">${items}</div>
      <div class="order-rewards">🎁 🪙${r.coins} 💧${r.dew} ⭐${r.renown}</div>
      <button class="btn btn-fill" data-slot="${si}" ${check.ok ? '' : 'disabled'}>
        ${check.ok ? '✅ Fill Order' : 'Missing items'}
      </button>
    </div>`;
  }).join('');
  wrap.querySelectorAll('.btn-fill').forEach(b => {
    b.onclick = () => fillOrder(+b.dataset.slot, b);
  });
}

export function fillOrder(slot, btnEl) {
  const o = G.orders[slot];
  if (!o) return;
  const { visitor, tpl } = orderDef(o);
  const check = checkOrder(tpl, { crops: G.inv.crops, board: G.board });
  if (!check.ok) { toast('You are missing some items!'); sfx('error'); return; }

  // consume
  for (const it of tpl.items) {
    if (it.kind === 'crop') G.inv.crops[it.id] -= it.qty;
    else consumeBoardPlants(G.board, it.family, it.tier, it.qty);
  }
  const r = tpl.rewards;
  G.stats.ordersFilled++;
  sfx('chime');
  setTimeout(() => sfx('fanfare'), 250);
  if (btnEl) {
    const rc = btnEl.getBoundingClientRect();
    burst(rc.left + rc.width / 2, rc.top, ['#ffd76e', '#fff3c4', '#a8d86e'], 18);
  }
  const { addCoins: ac, addDew: ad, addRenown: ar } = window.BV;
  ac(r.coins); ad(r.dew); ar(r.renown);
  addXP(10);
  const quirk = visitor.quirks[Math.floor(Math.random() * visitor.quirks.length)];
  pipSay(`Order filled for ${visitor.name}! "${quirk}"`);
  toast(`✅ Order filled! +${r.coins} 🪙 +${r.dew} 💧 +${r.renown} ⭐`);
  if (window.BV && window.BV.nursery) window.BV.nursery.renderBoard();
  renderOrders();
  saveGame();
  if (window.BV && window.BV.checkMilestones) window.BV.checkMilestones();
  if (window.BV && window.BV.tutorialTap) window.BV.tutorialTap('order');

  // refresh the slot with a fresh order + chime + Pip announcement
  setTimeout(() => {
    G.orders[slot] = genOrder();
    renderOrders();
    saveGame();
    sfx('chime');
    const v = D.visitors.find(x => x.id === G.orders[slot].visitorId);
    pipSay(`New order! ${v.name} is at the stand: "${v.hello}"`);
  }, 1500);
}
