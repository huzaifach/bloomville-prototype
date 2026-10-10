// fx.js — particles, flying pickups, screen shake. DOM-only, no game imports.
// Perf: all motion via WAAPI transforms; hard cap on live particles.
const layer = () => document.getElementById('fx-layer');
let live = 0;
const MAX_LIVE = 80;

function spawn(el, x, y) {
  const L = layer();
  if (!L) return null;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  L.appendChild(el);
  live++;
  el.addEventListener('animationend', () => { el.remove(); live = Math.max(0, live - 1); }, { once: true });
  return el;
}

// radial particle burst at viewport coords
export function burst(x, y, colors = ['#ffd76e', '#fff3c4', '#ffb347'], n = 14) {
  n = Math.min(n, Math.max(0, MAX_LIVE - live));
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'fx-particle';
    const c = colors[i % colors.length];
    d.style.background = c;
    const ang = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 70;
    const dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist - 20;
    spawn(d, x, y);
    if (!d.isConnected) continue;
    d.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: `translate(${dx}px,${dy}px) scale(0.2)`, opacity: 0 },
    ], { duration: 500 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => { d.remove(); live = Math.max(0, live - 1); };
  }
}

export function floatText(x, y, text, cls = '') {
  const d = document.createElement('div');
  d.className = 'fx-float ' + cls;
  d.textContent = text;
  spawn(d, x, y);
  if (!d.isConnected) return;
  d.animate([
    { transform: 'translate(-50%,0)', opacity: 0 },
    { transform: 'translate(-50%,-36px)', opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%,-64px)', opacity: 0 },
  ], { duration: 1100, easing: 'ease-out' }).onfinish = () => { d.remove(); live = Math.max(0, live - 1); };
}

// fly n pickups from viewport point to a HUD element
export function flyTo(x, y, targetSel, cls, n = 5, stagger = 70) {
  const t = document.querySelector(targetSel);
  if (!t) return;
  const r = t.getBoundingClientRect();
  const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const d = document.createElement('div');
      d.className = 'fx-fly ' + cls;
      spawn(d, x, y);
      if (!d.isConnected) return;
      const mx = (x + tx) / 2, my = Math.min(y, ty) - 60;
      d.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${mx - x}px,${my - y}px) scale(0.9)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${tx - x}px,${ty - y}px) scale(0.4)`, opacity: 0.6 },
      ], { duration: 650, easing: 'cubic-bezier(.3,.6,.4,1)' }).onfinish = () => { d.remove(); live = Math.max(0, live - 1); };
    }, i * stagger);
  }
}
export const flyCoins = (x, y, n = 5) => flyTo(x, y, '#hud-coins', 'fx-coin', n);
export const flyDew = (x, y, n = 5) => flyTo(x, y, '#hud-dew', 'fx-dew', n);

// screen shake — ONLY used for Bloom Burst (permanent rule)
export function shakeScreen() {
  const s = document.getElementById('scene-wrap');
  if (!s) return;
  s.classList.remove('shake');
  void s.offsetWidth;
  s.classList.add('shake');
  setTimeout(() => s.classList.remove('shake'), 450);
}

export function popEl(el) {
  if (!el) return;
  el.classList.remove('pop');
  void el.offsetWidth;
  el.classList.add('pop');
}
