// Turn timer. State lives at module level so the countdown keeps running (and can still sound the
// alarm) while you look at another tab.
import { icons, toast } from '../ui.js';

const KEY = 'sw_timer';
const TURNS_PER_AGE = 6;
const AGE_NAMES = ['Age I', 'Age II', 'Age III'];

const defaults = { ages: [60, 60, 60], age: 0, turn: 1, auto: false, sound: true, vibrate: true };
let cfg = (() => {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(KEY)) }; } catch { return { ...defaults }; }
})();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch { /* ignore */ } };

const T = { running: false, endAt: 0, remaining: cfg.ages[cfg.age] * 1000, up: false };
let handle = null, lastSec = null, audio = null, wakeLock = null, autoTimer = null;
let onChange = null; // set by the mounted view: full re-render
let onTick = null;   // set by the mounted view: cheap display update

const duration = () => cfg.ages[cfg.age] * 1000;

function beep(freq = 880, len = 0.18, vol = 0.25) {
  if (!cfg.sound) return;
  try {
    audio = audio || new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + len);
    o.connect(g); g.connect(audio.destination);
    o.start(); o.stop(audio.currentTime + len);
  } catch { /* audio unavailable */ }
}

async function lock() {
  try { if ('wakeLock' in navigator && !wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* ignore */ }
}
function unlock() { try { wakeLock && wakeLock.release(); } catch { /* ignore */ } wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && T.running) lock(); });

function start() {
  clearTimeout(autoTimer);
  if (T.remaining <= 0) T.remaining = duration();
  T.up = false;
  T.endAt = Date.now() + T.remaining;
  T.running = true;
  lastSec = null;
  beep(660, 0.06, 0.12); // unlocks audio on iOS (inside the tap)
  lock();
  clearInterval(handle);
  handle = setInterval(tick, 200);
  onChange && onChange();
}

function pause() {
  T.remaining = Math.max(0, T.endAt - Date.now());
  T.running = false;
  clearInterval(handle);
  unlock();
  onChange && onChange();
}

function reset() {
  clearTimeout(autoTimer);
  T.running = false; T.up = false;
  clearInterval(handle);
  unlock();
  T.remaining = duration();
  onChange && onChange();
}

function nextTurn(autostart = false) {
  cfg.turn++;
  if (cfg.turn > TURNS_PER_AGE) { cfg.turn = 1; cfg.age = (cfg.age + 1) % 3; }
  save();
  reset();
  if (autostart) start();
}

function tick() {
  if (!T.running) return;
  const rem = T.endAt - Date.now();
  T.remaining = Math.max(0, rem);
  const sec = Math.ceil(T.remaining / 1000);
  if (sec !== lastSec) {
    lastSec = sec;
    if (sec > 0 && sec <= 3) beep(660, 0.08, 0.15);
  }
  if (rem <= 0) {
    T.running = false; T.up = true;
    clearInterval(handle);
    unlock();
    [0, 260, 520].forEach((ms) => setTimeout(() => beep(990, 0.22, 0.35), ms));
    if (cfg.vibrate && navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 400]);
    if (cfg.auto) autoTimer = setTimeout(() => nextTurn(true), 2500);
    onChange && onChange();
    return;
  }
  onTick && onTick();
}

const fmt = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtSec = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function timerView(root) {
  const C = 2 * Math.PI * 46; // ring circumference (r = 46 in a 100 viewBox)

  const render = () => {
    const total = duration() / 1000;
    const low = (T.running && T.remaining <= 10000) || T.up;
    const frac = T.up ? 0 : Math.min(1, T.remaining / duration());
    const toggle = (k, on) => `<button class="toggle ${on ? 'on' : ''}" data-act="tog" data-k="${k}" role="switch" aria-checked="${on}"><span class="switch"></span></button>`;

    root.innerHTML = `
      <div class="page t-wrap">
        <header class="head"><h1 class="h1 big">Timer</h1></header>
        <div class="seg">
          ${AGE_NAMES.map((n, i) => `<button class="${cfg.age === i ? 'on' : ''}" data-act="age" data-i="${i}">${n}</button>`).join('')}
        </div>
        <div class="ring-box ${low ? 'low' : ''} ${T.up ? 'up' : ''}" id="ring">
          <svg viewBox="0 0 100 100"><circle class="ring-bg" cx="50" cy="50" r="46" fill="none" stroke-width="5"/>
            <circle class="ring-fg" id="arc" cx="50" cy="50" r="46" fill="none" stroke-width="5" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - frac)}"/></svg>
          <div class="center"><div class="time" id="time">${T.up ? '0:00' : fmt(T.remaining)}</div><div class="lab" id="lab">${T.up ? "Time's up!" : `Turn ${cfg.turn} of ${TURNS_PER_AGE}`}</div></div>
        </div>
        <div class="t-ctrl">
          <button class="round-btn" data-act="reset" aria-label="Reset">${icons.reset}</button>
          <button class="round-btn main" data-act="toggle" aria-label="${T.running ? 'Pause' : 'Start'}">${T.running ? icons.pause : icons.play}</button>
          <button class="round-btn" data-act="next" aria-label="Next turn">${icons.next}</button>
        </div>
        <div class="t-meta">
          <button class="btn ghost small" data-act="turn" data-d="-1">${icons.minus}</button>
          <span class="muted">${AGE_NAMES[cfg.age]} · turn ${cfg.turn}</span>
          <button class="btn ghost small" data-act="turn" data-d="1">${icons.plus}</button>
        </div>

        <div class="h2" style="text-align:left">Time per turn</div>
        <div class="card" style="text-align:left">
          ${AGE_NAMES.map((n, i) => `<div class="setrow"><b>${n}</b>
            <div class="stepper"><button class="st-btn" data-act="dur" data-i="${i}" data-d="-5" aria-label="Less time for ${n}">−</button>
            <span class="tm">${fmtSec(cfg.ages[i])}</span>
            <button class="st-btn" data-act="dur" data-i="${i}" data-d="5" aria-label="More time for ${n}">+</button></div></div>`).join('')}
          <div style="margin-top:12px"><div class="muted" style="font-size:13px;margin-bottom:6px">Set all ages to</div>
            <div class="scroller" style="margin:0;padding:0">${[20, 30, 45, 60, 90, 120].map((s) => `<button class="pill ${cfg.ages.every((a) => a === s) ? 'on' : ''}" data-act="preset" data-s="${s}">${fmtSec(s)}</button>`).join('')}</div></div>
        </div>
        <div class="card" style="text-align:left">
          <div class="setrow"><span>Start next turn automatically</span>${toggle('auto', cfg.auto)}</div>
          <div class="setrow"><span>Sound</span>${toggle('sound', cfg.sound)}</div>
          <div class="setrow"><span>Vibration</span>${toggle('vibrate', cfg.vibrate)}</div>
        </div>
        <p class="muted" style="font-size:13px">Each age has ${TURNS_PER_AGE} turns. The ring turns red for the last 10 seconds. The screen stays awake while the timer runs.</p>
      </div>`;
    void total;
  };

  const update = () => {
    const ring = root.querySelector('#ring');
    if (!ring) return;
    const frac = Math.min(1, T.remaining / duration());
    root.querySelector('#arc').style.strokeDashoffset = C * (1 - frac);
    root.querySelector('#time').textContent = fmt(T.remaining);
    ring.classList.toggle('low', T.running && T.remaining <= 10000);
  };

  onChange = render;
  onTick = update;

  root.onclick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const { act } = b.dataset;
    switch (act) {
      case 'toggle': T.running ? pause() : start(); break;
      case 'reset': reset(); break;
      case 'next': nextTurn(false); break;
      case 'age': pause_if(); cfg.age = Number(b.dataset.i); cfg.turn = 1; save(); reset(); break;
      case 'turn': cfg.turn = Math.min(TURNS_PER_AGE, Math.max(1, cfg.turn + Number(b.dataset.d))); save(); render(); break;
      case 'dur': {
        const i = Number(b.dataset.i);
        cfg.ages[i] = Math.min(600, Math.max(5, cfg.ages[i] + Number(b.dataset.d)));
        save();
        if (!T.running && i === cfg.age) T.remaining = duration();
        render();
        break;
      }
      case 'preset': cfg.ages = [Number(b.dataset.s), Number(b.dataset.s), Number(b.dataset.s)]; save(); if (!T.running) T.remaining = duration(); render(); break;
      case 'tog':
        cfg[b.dataset.k] = !cfg[b.dataset.k]; save(); render();
        if (b.dataset.k === 'sound' && cfg.sound) beep(660, 0.1, 0.2);
        if (b.dataset.k === 'vibrate' && cfg.vibrate && navigator.vibrate) navigator.vibrate(60);
        else if (b.dataset.k === 'vibrate' && cfg.vibrate) toast("Vibration isn't supported on this device");
        break;
    }
  };
  function pause_if() { if (T.running) pause(); }

  render();
  return () => { onChange = null; onTick = null; };
}
