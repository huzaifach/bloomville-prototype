// codex.js — discovered vs locked silhouettes: 16 plants + 4 crops.
import { G } from './state.js?v=1';
import { img, plantImg } from './ui.js?v=1';

let D = null;
export function initCodex(data) { D = data; renderCodex(); }

export function isDiscovered(key) {
  return G.stats.discovered.includes(key);
}

export function renderCodex() {
  const wrap = document.getElementById('codex-grid');
  if (!wrap || !D) return;
  let html = '';
  for (const f of D.families) {
    html += `<div class="codex-family">${f.name}</div>`;
    for (let t = 1; t <= 8; t++) {
      const key = `${f.id}:${t}`;
      const tier = f.tiers[t - 1];
      if (isDiscovered(key)) {
        html += `<div class="codex-cell found">${plantImg(D, f.id, t, 'codex-img')}<span>${tier.name}</span></div>`;
      } else {
        html += `<div class="codex-cell locked"><div class="silhouette" style="background:${f.color}"></div><span>???</span></div>`;
      }
    }
  }
  html += `<div class="codex-family">Crops</div>`;
  for (const c of D.crops) {
    const key = 'crop:' + c.id;
    if (isDiscovered(key)) {
      html += `<div class="codex-cell found">${img(c.art, c.name, 'codex-img', '#a8d86e', c.name)}<span>${c.name}</span></div>`;
    } else {
      html += `<div class="codex-cell locked"><div class="silhouette" style="background:#a8d86e"></div><span>???</span></div>`;
    }
  }
  wrap.innerHTML = html;
  const found = G.stats.discovered.length;
  const total = 20;
  const prog = document.getElementById('codex-progress');
  if (prog) prog.textContent = `${found} / ${total} discovered`;
}
