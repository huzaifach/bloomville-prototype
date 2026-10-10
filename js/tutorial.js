// tutorial.js — Pip-guided first minutes: sprout -> merge -> harvest -> fill order.
// Skippable, replayable from Settings. Never blocks: overlay is dismissible.
import { G, saveGame } from './state.js?v=1';
import { openPanel, closePanels, toast } from './ui.js?v=1';
import { say as pipSay } from './pip.js?v=1';
import { sfx } from './audio.js?v=1';

let D = null;
let stepIdx = 0;
let active = false;
let waitingFor = null;

const STEPS = () => [
  { text: D.tutorial[0].text, title: D.tutorial[0].title, next: true },
  { text: D.tutorial[1].text, title: D.tutorial[1].title, action: 'openNursery', target: '#seed-packets .packet', wait: 'seed' },
  { text: D.tutorial[2].text, title: D.tutorial[2].title, target: '#nursery-board', wait: 'merge' },
  { text: D.tutorial[3].text, title: D.tutorial[3].title, next: true },
  { text: D.tutorial[4].text, title: D.tutorial[4].title, action: 'openFarm', target: '#plots .plot:not(.locked)', wait: 'plant' },
  { text: D.tutorial[5].text, title: D.tutorial[5].title, wait: 'harvest' },
  { text: D.tutorial[6].text, title: D.tutorial[6].title, target: '#stand-btn', wait: 'order' },
  { text: D.tutorial[7].text, title: D.tutorial[7].title, next: true },
  { text: D.tutorial[8].text, title: D.tutorial[8].title, next: true },
  { text: D.tutorial[9].text, title: D.tutorial[9].title, next: true, finish: true },
];

export function initTutorial(data) { D = data; }

export function startTutorial() {
  if (active) return;
  active = true; stepIdx = 0;
  G.tutorial.done = false;
  document.getElementById('tutorial-bar').classList.add('show');
  showStep();
  saveGame();
}

export function skipTutorial() {
  endTutorial(true);
  toast('Tutorial skipped — have fun, farmer! (Replay anytime in ⚙️ Menu.)');
}

function endTutorial(skipped) {
  active = false; waitingFor = null;
  document.getElementById('tutorial-bar').classList.remove('show');
  hideHighlight();
  G.tutorial.done = true; G.tutorial.step = 0;
  saveGame();
  if (!skipped) pipSay('You did it! Bloomville is officially blooming! 🌸');
}

function showStep() {
  const steps = STEPS();
  const s = steps[stepIdx];
  if (!s) { endTutorial(false); return; }
  if (s.action === 'openNursery') openPanel('panel-nursery');
  if (s.action === 'openFarm') closePanels();
  pipSay(`${s.title} — ${s.text}`, s.wait ? 9000 : 7000);
  const bar = document.getElementById('tutorial-bar');
  bar.querySelector('.tut-text').innerHTML = `<b>${s.title}</b><br>${s.text}`;
  const nextBtn = bar.querySelector('#tut-next');
  nextBtn.style.display = s.next ? '' : 'none';
  nextBtn.textContent = s.finish ? 'Finish 🎉' : 'Next →';
  waitingFor = s.wait || null;
  if (s.target) highlight(s.target); else hideHighlight();
  sfx('click');
}

function highlight(sel) {
  hideHighlight();
  // wait a tick for panels to open
  setTimeout(() => {
    const t = document.querySelector(sel);
    const h = document.getElementById('tutorial-highlight');
    if (!t || !h) return;
    const r = t.getBoundingClientRect();
    h.style.display = 'block';
    h.style.left = (r.left - 6) + 'px';
    h.style.top = (r.top - 6) + 'px';
    h.style.width = (r.width + 12) + 'px';
    h.style.height = (r.height + 12) + 'px';
  }, 350);
}
function hideHighlight() {
  const h = document.getElementById('tutorial-highlight');
  if (h) h.style.display = 'none';
}

// called by game actions via BV.tutorialTap(type)
export function onGameTap(type) {
  if (!active || !waitingFor) return;
  if (type === waitingFor) {
    waitingFor = null;
    stepIdx++;
    G.tutorial.step = stepIdx;
    saveGame();
    setTimeout(showStep, 600);
  }
}

export function wireTutorialBar() {
  document.getElementById('tut-next').onclick = () => {
    if (!active) return;
    stepIdx++;
    G.tutorial.step = stepIdx;
    saveGame();
    showStep();
  };
  document.getElementById('tut-skip').onclick = skipTutorial;
}
