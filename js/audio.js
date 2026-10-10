// audio.js — WebAudio synth SFX + generative cozy music. No assets, no imports.
// Separate mute toggles for music and sfx (persisted in state.settings by main.js).
let ctx = null;
let musicGain = null, sfxGain = null;
let musicOn = true, sfxOn = true;
let musicTimer = null;
let nightMode = false;

export function setToggles(m, s) { musicOn = m; sfxOn = s; applyGains(); }
export function isMusicOn() { return musicOn; }
export function isSfxOn() { return sfxOn; }

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = ctx.createGain(); musicGain.connect(ctx.destination);
    sfxGain = ctx.createGain(); sfxGain.connect(ctx.destination);
    applyGains();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function applyGains() {
  if (!ctx) return;
  musicGain.gain.value = musicOn ? 0.5 : 0;
  sfxGain.gain.value = sfxOn ? 0.9 : 0;
}
// must be called from a user gesture at least once
export function unlock() { try { ac(); } catch (e) { /* no audio */ } }

function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
  const c = ac();
  const t0 = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(sfxGain);
  o.start(t0); o.stop(t0 + dur + 0.05);
}

const SFX = {
  click()   { tone(600, 0.07, 'triangle', 0.12); },
  pop()     { tone(520, 0.12, 'sine', 0.22, 0, 880); },
  merge()   { tone(440, 0.1, 'sine', 0.22, 0, 660); tone(660, 0.14, 'sine', 0.2, 0.08, 990); },
  golden()  { [880, 1108, 1318, 1760].forEach((f, i) => tone(f, 0.25, 'triangle', 0.16, i * 0.07)); },
  coin()    { tone(988, 0.08, 'square', 0.08); tone(1319, 0.16, 'square', 0.08, 0.07); },
  harvest() { tone(392, 0.1, 'triangle', 0.2, 0, 523); tone(523, 0.14, 'triangle', 0.18, 0.09, 784); },
  giggle()  { [700, 900, 800, 1050].forEach((f, i) => tone(f, 0.07, 'sine', 0.1, i * 0.06, f * 1.3)); },
  fanfare() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.16, i * 0.1)); tone(1319, 0.5, 'sine', 0.12, 0.42); },
  chime()   { tone(1175, 0.3, 'sine', 0.14); tone(1568, 0.4, 'sine', 0.1, 0.12); },
  quack()   { tone(300, 0.12, 'sawtooth', 0.1, 0, 180); tone(280, 0.12, 'sawtooth', 0.1, 0.14, 170); },
  plant()   { tone(330, 0.09, 'sine', 0.16, 0, 495); },
  error()   { tone(160, 0.18, 'square', 0.08, 0, 120); },
  burst()   { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.35, 'triangle', 0.14, i * 0.05)); },
  sell()    { tone(784, 0.08, 'square', 0.07); tone(1047, 0.1, 'square', 0.07, 0.06); tone(1319, 0.18, 'square', 0.07, 0.12); },
};

export function sfx(name) {
  if (!sfxOn) return;
  try { (SFX[name] || SFX.click)(); } catch (e) { /* ignore */ }
}

// ---------- generative music ----------
const DAY_CHORDS = [[261.6, 329.6, 392.0], [220.0, 261.6, 329.6], [174.6, 220.0, 261.6], [196.0, 246.9, 293.7]];
const NIGHT_CHORDS = [[220.0, 261.6, 329.6], [164.8, 196.0, 246.9], [174.6, 220.0, 261.6], [164.8, 207.7, 246.9]];
const PENTA = [523.3, 587.3, 659.3, 784.0, 880.0, 1046.5];

function pad(freqs, dur) {
  const c = ac();
  const t0 = c.currentTime;
  for (const f of freqs) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = f * 0.5;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.035, t0 + dur * 0.3);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(musicGain);
    o.start(t0); o.stop(t0 + dur + 0.1);
  }
}
function pluck(freq) {
  const c = ac();
  const t0 = c.currentTime;
  const o = c.createOscillator(), g = c.createGain();
  o.type = 'sine';
  o.frequency.value = nightMode ? freq * 0.75 : freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
  o.connect(g); g.connect(musicGain);
  o.start(t0); o.stop(t0 + 1.6);
}

let chordIdx = 0;
export function startMusic() {
  if (musicTimer || !musicOn) return;
  try { ac(); } catch (e) { return; }
  const bar = () => {
    if (!musicOn) return;
    try {
      const chords = nightMode ? NIGHT_CHORDS : DAY_CHORDS;
      pad(chords[chordIdx % chords.length], 4.2);
      chordIdx++;
      if (Math.random() < 0.7) {
        const f = PENTA[Math.floor(Math.random() * PENTA.length)];
        setTimeout(() => { if (musicOn) pluck(f); }, 800 + Math.random() * 2000);
      }
    } catch (e) { /* ignore */ }
  };
  bar();
  musicTimer = setInterval(bar, 4000);
}
export function setNight(n) { nightMode = n; }
