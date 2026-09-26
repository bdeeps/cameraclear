// DOM helpers: control widgets, toasts, sounds, confetti.
import { nearestIndex } from './optics.js';

export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function setFill(input) {
  const p = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--p', p + '%');
}

// def: { key, type: 'stops'|'log'|'range'|'toggle'|'seg'|'buttons', label, term, hint, ... }
export function buildControl(def, s, onChange, onAction) {
  const el = document.createElement('div');
  el.className = 'ctl ctl-' + def.type;
  const q = def.term ? ` <button class="q" data-t="${def.term}" title="What is this?" aria-label="What is ${esc(def.label)}?">?</button>` : '';
  const head = `<div class="ctl-head"><label>${def.label}${q}</label><output></output></div>`;
  let sync = () => {};

  if (def.type === 'stops' || def.type === 'log' || def.type === 'range') {
    let min, max, step, toV, fromV;
    if (def.type === 'stops') {
      min = 0; max = def.values.length - 1; step = 1;
      toV = (x) => def.values[x]; fromV = (v) => nearestIndex(def.values, v);
    } else if (def.type === 'log') {
      min = 0; max = 1000; step = 1;
      toV = (x) => (def.inf && x >= 1000 ? def.inf : def.min * Math.pow(def.max / def.min, x / 1000));
      fromV = (v) => (def.inf && v >= def.inf ? 1000 : Math.round((Math.log(v / def.min) / Math.log(def.max / def.min)) * 1000));
    } else {
      min = def.min; max = def.max; step = def.step ?? 0.01;
      toV = (x) => +x; fromV = (v) => v;
    }
    const ends = def.ends ? `<div class="ends"><span>${def.ends[0]}</span><span>${def.ends[1]}</span></div>` : '';
    el.innerHTML = head + `<input type="range" min="${min}" max="${max}" step="${step}" aria-label="${esc(def.label)}">` + ends + (def.hint ? `<div class="hint">${def.hint}</div>` : '');
    const input = el.querySelector('input'), out = el.querySelector('output');
    input.addEventListener('input', () => {
      setFill(input);
      onChange(def.key, toV(+input.value));
      out.textContent = def.fmt ? def.fmt(s[def.key], s) : s[def.key];
    });
    sync = () => {
      const v = s[def.key];
      input.value = fromV(v); setFill(input);
      out.textContent = def.fmt ? def.fmt(v, s) : v;
      input.disabled = !!(def.disabled && def.disabled(s));
    };
  } else if (def.type === 'toggle') {
    el.innerHTML = head.replace('<output></output>', '') + `<label class="switch"><input type="checkbox" aria-label="${esc(def.label)}"><span></span></label>`;
    const input = el.querySelector('input');
    input.addEventListener('change', () => onChange(def.key, input.checked));
    sync = () => { input.checked = !!s[def.key]; };
  } else if (def.type === 'seg') {
    el.innerHTML = head + `<div class="seg">${def.options.map((o) => `<button data-v="${o.v}">${o.label}</button>`).join('')}</div>`;
    const out = el.querySelector('output');
    const num = typeof def.options[0].v === 'number';
    el.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => onChange(def.key, num ? +b.dataset.v : b.dataset.v)));
    sync = () => {
      el.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(s[def.key])));
      out.textContent = def.fmt ? def.fmt(s[def.key], s) : '';
    };
  } else if (def.type === 'buttons') {
    el.innerHTML = `<div class="ctl-head"><label>${def.label}${q}</label></div><div class="btnrow">${def.items.map((it, i) => `<button data-i="${i}">${it.label}</button>`).join('')}</div>`;
    el.querySelectorAll('.btnrow button').forEach((b) => b.addEventListener('click', () => onAction(def.items[+b.dataset.i])));
  }
  sync();
  return { el, sync, def };
}

// ---------- toasts
export function toast(html, kind = '') {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.innerHTML = html;
  box.appendChild(t);
  while (box.children.length > 4) box.firstChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, 3600);
}

// ---------- sounds (synthesised, no files)
let ac = null;
export const audio = { muted: false };
function ctx() {
  if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
function noiseBurst(a, t, dur, freq, gain) {
  const len = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const g = a.createGain(); g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination); src.start(t);
}
function tone(a, t, freq, dur, gain = 0.12, type = 'sine') {
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
}
export function sfx(name, extra = 0) {
  if (audio.muted) return;
  const a = ctx(); if (!a) return;
  const t = a.currentTime;
  if (name === 'shutter') {
    noiseBurst(a, t, 0.05, 2600, 0.9);
    noiseBurst(a, t + Math.min(0.5, 0.06 + extra), 0.06, 1800, 0.7);
  } else if (name === 'ding') {
    tone(a, t, 880, 0.3); tone(a, t + 0.09, 1318.5, 0.45);
  } else if (name === 'level') {
    [523, 659, 784, 1046].forEach((f, i) => tone(a, t + i * 0.09, f, 0.35, 0.1, 'triangle'));
  } else if (name === 'right') {
    tone(a, t, 660, 0.18, 0.1); tone(a, t + 0.08, 990, 0.25, 0.1);
  } else if (name === 'wrong') {
    tone(a, t, 196, 0.25, 0.08, 'square');
  } else if (name === 'click') {
    tone(a, t, 1400, 0.04, 0.04, 'square');
  }
}

export function confetti(n = 70) {
  const cols = ['#ffb547', '#5ad1ff', '#4ade80', '#ff6b6b', '#e9ecf3'];
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i');
    c.className = 'confetti';
    c.style.left = Math.random() * 100 + 'vw';
    c.style.background = cols[i % cols.length];
    c.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
    c.style.setProperty('--r', (Math.random() * 900 - 450) + 'deg');
    c.style.animationDuration = 1.6 + Math.random() * 1.6 + 's';
    c.style.animationDelay = Math.random() * 0.3 + 's';
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 3800);
  }
}
