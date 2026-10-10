// pip.js — Pip the fairy companion. Flies around, never blocks taps
// (container is pointer-events:none — permanent rule). Tutorial + chatter + celebrations.
let el = null, bubble = null, imgEl = null;
let chatter = [];
let sayTimer = null, flyTimer = null;
let mood = 'wave'; // 'wave' | 'cheer'
let busyUntil = 0;

export function initPip(lines) {
  chatter = lines || [];
  el = document.getElementById('pip');
  if (!el) return;
  bubble = el.querySelector('.pip-bubble');
  imgEl = el.querySelector('img');
  el.style.pointerEvents = 'none';
  startFlying();
}

function startFlying() {
  if (flyTimer) return;
  const tick = () => {
    if (!el) return;
    const w = window.innerWidth, h = window.innerHeight;
    const x = 20 + Math.random() * Math.max(40, w - 120);
    const y = 90 + Math.random() * Math.max(40, h - 320);
    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.transition = 'transform 6s ease-in-out';
    // gentle bobbing via inner img
    if (imgEl) imgEl.style.animation = 'pipbob 2.4s ease-in-out infinite';
  };
  tick();
  flyTimer = setInterval(tick, 7000);
}

export function setMood(m) {
  mood = m;
  if (imgEl) {
    const src = m === 'cheer' ? 'assets/pip-cheer.png?v=1' : 'assets/pip-wave.png?v=1';
    if (!imgEl.src.includes(src)) imgEl.src = src;
    imgEl.dataset.label = 'Pip';
  }
}

export function say(text, dur = 4200) {
  if (!el || !bubble) return;
  busyUntil = Date.now() + dur;
  bubble.textContent = text;
  bubble.classList.add('show');
  setMood('wave');
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => bubble.classList.remove('show'), dur);
}

export function celebrate(text, dur = 5200) {
  if (!el || !bubble) return;
  busyUntil = Date.now() + dur;
  setMood('cheer');
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(sayTimer);
  sayTimer = setTimeout(() => { bubble.classList.remove('show'); setMood('wave'); }, dur);
}

// ambient chatter — only speaks when not busy (tutorial/celebrations win)
export function startChatter(intervalMs = 26000) {
  if (!chatter.length) return;
  setInterval(() => {
    if (Date.now() < busyUntil) return;
    if (document.hidden) return;
    say(chatter[Math.floor(Math.random() * chatter.length)], 5000);
  }, intervalMs);
}

export function isBusy() { return Date.now() < busyUntil; }
