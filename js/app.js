import { Stage } from './stage.js';
import { PhotoSim } from './photosim.js';
import { CHAPTERS } from './chapters/index.js';
import { GLOSSARY } from './glossary.js';
import * as O from './optics.js';
import { buildControl, toast, sfx, audio, confetti, esc } from './ui.js';
import { STORYBOARD } from './reel.js';

// ---------------------------------------------------------------- state
const LEVELS = [[0, 'Pinhole Rookie'], [150, 'Shutterbug'], [400, 'Hobbyist'], [800, 'Enthusiast'], [1300, 'Pro Shooter'], [2000, 'Master of Light']];
const KEY = 'cameraclear.v1';
const store = { xp: 0, missions: {}, quiz: {}, welcomed: false, muted: false };
try { Object.assign(store, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage unavailable */ }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* ignore */ } };
audio.muted = !!store.muted;

const BASE = { scene: 'cloudy', aperture: 4, shutter: 1 / 125, iso: 100, focal: 50, focus: 2.5, sensor: 36, camZ: 0, motion: false, tripod: true, zebra: false };

const $ = (sel) => document.querySelector(sel);
const el = {
  nav: $('#chapters'), panel: $('#panel'), lcd: $('#lcd'), photo: $('#photo'), info: $('#lcdInfo'), mode: $('#lcdMode'),
  needle: $('#meterNeedle'), histo: $('#histo'), roll: $('#roll'), reticle: $('#reticle'), flash: $('#flash'),
  modal: $('#modal'), card: $('#modalCard'), stKicker: $('#stKicker'), stTitle: $('#stTitle'), hint: $('#stageHint'),
};

let stage;
try { stage = new Stage($('#stage')); } catch (e) { console.error(e); $('#noGL').hidden = false; throw e; }
let photo = null;
try { photo = new PhotoSim(el.photo); } catch (e) { console.error('Photo simulator unavailable', e); }

let ch = null, inst = {}, s = {}, ctrls = [], time = 0, shots = [], lastM = null;

// ---------------------------------------------------------------- helpers
const levelFor = (xp) => { let i = 0; LEVELS.forEach(([t], k) => { if (xp >= t) i = k; }); return i; };
function renderXP() {
  const i = levelFor(store.xp), [lo] = LEVELS[i], hi = LEVELS[i + 1]?.[0];
  $('#lvlName').textContent = LEVELS[i][1];
  $('#xpFill').style.width = (hi ? ((store.xp - lo) / (hi - lo)) * 100 : 100) + '%';
  $('#xpText').textContent = store.xp + ' XP';
}
function addXP(n) {
  const before = levelFor(store.xp);
  store.xp += n; save(); renderXP();
  const after = levelFor(store.xp);
  if (after > before) { setTimeout(() => { sfx('level'); toast(`<b>Level up!</b> You're now a <b>${LEVELS[after][1]}</b>.`, 'good'); confetti(90); }, 500); }
}
const doneMap = (id) => (store.missions[id] ||= {});
const chapterDone = (c) => c.missions.every((mi) => doneMap(c.id)[mi.id]);

function metrics() {
  const m = O.metrics(s);
  Object.assign(m, inst.metrics ? inst.metrics(s) : {});
  lastM = m;
  return m;
}

// ---------------------------------------------------------------- missions
function evalMissions(kind, event = null) {
  if (!ch) return;
  const m = metrics();
  const done = doneMap(ch.id);
  for (const mi of ch.missions) {
    if (done[mi.id]) continue;
    const when = mi.when || 'live';
    if (kind === 'live' && when !== 'live') continue;
    if (kind === 'shot' && when === 'event') continue;
    if (kind === 'event' && when === 'shot') continue;
    let ok = false;
    try { ok = !!mi.check({ s, m, shot: kind === 'shot', event }); } catch (e) { console.warn(e); }
    if (ok) completeMission(mi);
  }
}
function completeMission(mi) {
  const done = doneMap(ch.id);
  if (done[mi.id]) return;
  done[mi.id] = true;
  save();
  sfx('ding');
  toast(`<b>Mission complete!</b> ${mi.text.replace(/<[^>]+>/g, '')} <em>+${mi.xp} XP</em>`, 'good');
  addXP(mi.xp);
  renderMissions(mi.id);
  renderNav();
  if (chapterDone(ch)) {
    setTimeout(() => { confetti(); toast(`<b>Chapter mastered ⭐</b> ${ch.title} <em>+50 XP</em>`, 'good'); addXP(50); }, 700);
  }
}
const emit = (event) => evalMissions('event', event);

// ---------------------------------------------------------------- chapter lifecycle
function openChapter(id) {
  const idx = Math.max(0, CHAPTERS.findIndex((c) => c.id === id));
  const c = CHAPTERS[idx];
  inst?.dispose?.();
  stage.clear();
  ch = c;
  s = { ...BASE, ...(c.defaults || {}) };
  lastM = null;
  c.onChange?.(s, null);
  stage.setWorldMode(!!c.world);
  inst = c.build({ stage, s, emit, photo }) || {};
  stage.onPick = inst.pick ? (o) => inst.pick(o) : null;
  stage.setView(c.view.pos, c.view.target, 1.1);
  el.stKicker.textContent = `Chapter ${idx + 1}`;
  el.stTitle.textContent = c.title;
  document.title = `${c.title} — CameraClear`;
  history.replaceState(null, '', '#' + c.id);
  renderPanel(idx);
  renderNav();
  setupLCD();
  el.panel.scrollTop = 0;
}

function onControl(key, value) {
  s[key] = value;
  ch.onChange?.(s, key);
  ctrls.forEach((c) => c.sync());
  updateLCDInfo();
}
function onAction(item) {
  item.act?.(s, metrics());
  ch.onChange?.(s, 'action');
  ctrls.forEach((c) => c.sync());
  if (item.event) emit(item.event);
  sfx('click');
}

// ---------------------------------------------------------------- panel
function renderNav() {
  const cur = ch?.id;
  el.nav.innerHTML = '<h4>Chapters</h4>' + CHAPTERS.map((c, i) => {
    const total = c.missions.length, done = c.missions.filter((mi) => doneMap(c.id)[mi.id]).length;
    return `<button class="chap ${c.id === cur ? 'active' : ''} ${done === total ? 'done' : ''}" data-id="${c.id}" title="${esc(c.title)}">
      <span class="num">${done === total ? '★' : i + 1}</span>
      <span class="t">${c.title}</span>
      <span class="p"><i><b style="width:${(done / total) * 100}%"></b></i><small>${done}/${total}</small></span>
    </button>`;
  }).join('');
}
el.nav.addEventListener('click', (e) => { const b = e.target.closest('.chap'); if (b) openChapter(b.dataset.id); });

function renderPanel(idx) {
  const c = ch;
  const prev = CHAPTERS[idx - 1], next = CHAPTERS[idx + 1];
  el.panel.innerHTML = `
    <div class="kicker">Chapter ${idx + 1} of ${CHAPTERS.length}</div>
    <h1>${c.title}</h1>
    <p class="sub">${c.subtitle}</p>
    <section class="learn">${c.learn}</section>
    <section><h3>Play</h3><div class="controls"></div></section>
    <section><h3>Live readout</h3><div class="readout" id="readout"></div></section>
    <section><h3>Missions <span class="count" id="mcount"></span></h3><ul class="missions" id="missions"></ul></section>
    <section><h3>Key terms</h3><div class="terms">${c.terms.map((t) => GLOSSARY[t] ? `<button class="term" data-t="${t}"><b>${GLOSSARY[t].t}</b><p>${GLOSSARY[t].s}</p></button>` : '').join('')}</div></section>
    <section class="quizbox"><button class="btn" id="btnQuiz">Take the quiz</button><small id="quizBest"></small></section>
    <div class="chapnav">
      ${prev ? `<button class="btn ghost" data-go="${prev.id}">← ${prev.title}</button>` : '<span></span>'}
      ${next ? `<button class="btn" data-go="${next.id}">${next.title} →</button>` : ''}
    </div>`;
  const box = el.panel.querySelector('.controls');
  ctrls = c.controls.map((d) => buildControl(d, s, onControl, onAction));
  ctrls.forEach((k) => box.appendChild(k.el));
  el.panel.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => openChapter(b.dataset.go)));
  $('#btnQuiz').addEventListener('click', openQuiz);
  renderMissions();
  renderQuizBest();
  updateReadout();
}
function renderMissions(popId) {
  const list = $('#missions'); if (!list) return;
  const done = doneMap(ch.id);
  list.innerHTML = ch.missions.map((mi) => `
    <li class="${done[mi.id] ? 'done' : ''} ${mi.id === popId ? 'pop' : ''}">
      <span class="box">${done[mi.id] ? '✓' : ''}</span>
      <span class="txt">${mi.text}${mi.when === 'shot' ? '<span class="kind">📷 shot</span>' : ''}</span>
      <span class="xp-tag">+${mi.xp}</span>
    </li>`).join('');
  $('#mcount').textContent = `${ch.missions.filter((mi) => done[mi.id]).length}/${ch.missions.length}`;
}
function renderQuizBest() {
  const b = store.quiz[ch.id];
  $('#quizBest').textContent = b === undefined ? `${ch.quiz.length} questions · +20 XP each` : `Best: ${b}/${ch.quiz.length}`;
}
function updateReadout() {
  const r = $('#readout'); if (!r || !inst.readout) { if (r) r.parentElement.hidden = true; return; }
  r.innerHTML = inst.readout(s, metrics());
}

// ---------------------------------------------------------------- camera screen
const lcdMin = { v: false };
function setupLCD() {
  const on = !!(ch.photo && photo);
  el.lcd.hidden = !on;
  document.querySelector('.stage-wrap').classList.toggle('has-lcd', on);
  el.lcd.classList.toggle('min', lcdMin.v);
  $('#zebra').classList.toggle('on', !!s.zebra);
  updateLCDInfo();
  placeLCD();
  stage.setShift(on && !lcdMin.v && window.innerWidth > 820 ? 0.14 : 0, on && !lcdMin.v && window.innerWidth > 820 ? 0.12 : 0);
}
function updateLCDInfo() {
  if (!ch?.photo) return;
  const m = lastM || metrics();
  const warn = (c, t) => (c ? `<span class="warn">${t}</span>` : t);
  el.info.innerHTML = [
    O.fmtF(s.aperture), warn(!s.tripod && m.shakePx > 1.5, O.fmtShutter(s.shutter)), warn(s.iso >= 6400, O.fmtISO(s.iso)),
    O.fmtMM(s.focal), '◎ ' + O.fmtDist(s.focus),
  ].map((x) => `<span>${x}</span>`).join('');
  el.mode.textContent = ch.modeLabel ? ch.modeLabel(s) : 'M';
  const st = Math.max(-3.2, Math.min(3.2, m.stops));
  el.needle.style.left = `calc(8px + (100% - 16px) * ${(st + 3) / 6})`;
  el.needle.classList.toggle('off', Math.abs(m.stops) > 0.7);
}
(function buildMeter() {
  const ticks = $('#meterTicks');
  let h = '';
  for (let i = 0; i <= 18; i++) { const maj = i % 3 === 0; const v = i / 3 - 3; h += `<i class="${maj ? 'maj' : ''}" data-l="${maj ? (v > 0 ? '+' + v : v) : ''}"></i>`; }
  ticks.innerHTML = h;
})();
function drawHisto(hist) {
  const g = el.histo.getContext('2d'), W = el.histo.width, H = el.histo.height;
  g.clearRect(0, 0, W, H);
  const max = Math.max(...hist.bins) || 1, bw = W / hist.bins.length;
  g.fillStyle = 'rgba(233,236,243,.75)';
  hist.bins.forEach((b, i) => { const h = Math.sqrt(b / max) * (H - 4); g.fillRect(i * bw, H - h, bw + 0.5, h); });
  if (hist.hi > 0.01) { g.fillStyle = '#ff6b6b'; g.fillRect(W - 3, 0, 3, H); }
  if (hist.lo > 0.05) { g.fillStyle = '#5ad1ff'; g.fillRect(0, 0, 3, H); }
}

function shoot() {
  if (!photo || !ch?.photo) return;
  sfx('shutter', Math.min(0.45, s.shutter));
  el.flash.classList.remove('go'); void el.flash.offsetWidth; el.flash.classList.add('go');
  photo.render(s, time);
  const url = photo.snapshot();
  const m = metrics();
  shots.unshift({ url, s: { ...s }, m, title: ch.title });
  if (shots.length > 14) shots.length = 14;
  renderRoll();
  evalMissions('shot');
}
function renderRoll() {
  el.roll.innerHTML = shots.map((sh, i) => `<img src="${sh.url}" data-i="${i}" alt="Photo ${i + 1}" title="${esc(sh.title)}">`).join('');
}
el.roll.addEventListener('click', (e) => {
  const img = e.target.closest('img'); if (!img) return;
  const sh = shots[+img.dataset.i];
  openModal(`<div class="shot-view"><img src="${sh.url}" alt="Your photo">
    <div class="exif"><span>${O.fmtF(sh.s.aperture)}</span><span>${O.fmtShutter(sh.s.shutter)}</span><span>${O.fmtISO(sh.s.iso)}</span><span>${O.fmtMM(sh.s.focal)}</span><span>focus ${O.fmtDist(sh.s.focus)}</span><span>exposure ${O.fmtStops(sh.m.stops)}</span></div>
    <p style="color:var(--muted);margin:10px 0 0">Taken in: ${esc(sh.title)}. Right-click the image to save it.</p></div>`, true);
});
$('#shoot').addEventListener('click', shoot);
$('#zebra').addEventListener('click', () => { s.zebra = !s.zebra; $('#zebra').classList.toggle('on', s.zebra); });
$('#lcdMin').addEventListener('click', () => { lcdMin.v = !lcdMin.v; el.lcd.classList.toggle('min', lcdMin.v); $('#lcdMin').textContent = lcdMin.v ? '+' : '–'; setupLCD(); });

el.photo.addEventListener('click', (e) => {
  if (!photo || !ch?.photo) return;
  const b = el.photo.getBoundingClientRect();
  const u = (e.clientX - b.left) / b.width, v = (e.clientY - b.top) / b.height;
  const hit = photo.pick(s, u, v);
  s.focus = hit.dist;
  ch.onChange?.(s, 'focus');
  ctrls.forEach((c) => c.sync());
  el.reticle.style.left = u * 100 + '%';
  el.reticle.style.top = v * 100 + '%';
  el.reticle.querySelector('span').textContent = `${hit.name ? hit.name + ' · ' : ''}${O.fmtDist(hit.dist)}`;
  el.reticle.classList.remove('show'); void el.reticle.offsetWidth; el.reticle.classList.add('show');
  clearTimeout(el.reticle._t); el.reticle._t = setTimeout(() => el.reticle.classList.remove('show'), 1600);
  sfx('click');
  updateLCDInfo();
  emit('tapfocus');
});

// On narrow screens the camera screen sits below the 3D stage instead of over it.
function placeLCD() {
  const narrow = window.innerWidth <= 820;
  const wrap = document.querySelector('.stage-wrap');
  if (narrow && el.lcd.parentElement === wrap) wrap.after(el.lcd);
  if (!narrow && el.lcd.parentElement !== wrap) wrap.appendChild(el.lcd);
}
window.addEventListener('resize', () => { if (ch) setupLCD(); });

// ---------------------------------------------------------------- modal, glossary, quiz
function openModal(html, wide = false) {
  el.card.className = 'modal-card' + (wide ? ' wide' : '');
  el.card.innerHTML = `<button class="x" aria-label="Close">✕</button>` + html;
  el.modal.hidden = false;
  el.card.querySelector('.x').addEventListener('click', closeModal);
}
function closeModal() { el.modal.hidden = true; el.card.innerHTML = ''; }
el.modal.addEventListener('click', (e) => { if (e.target === el.modal) closeModal(); });

function showTerm(id) {
  const g = GLOSSARY[id]; if (!g) return;
  const c = CHAPTERS.find((x) => x.id === g.ch);
  openModal(`<div class="term-card"><div class="kicker" style="font:600 11px var(--display);letter-spacing:.14em;text-transform:uppercase;color:var(--accent)">Definition</div>
    <h2>${g.t}</h2><p><b>${g.s}</b></p><p class="long">${g.l}</p>
    ${c && c.id !== ch.id ? `<div class="from"><button class="btn ghost" data-go="${c.id}">Explore it in “${c.title}” →</button></div>` : ''}</div>`);
  el.card.querySelector('[data-go]')?.addEventListener('click', (e) => { closeModal(); openChapter(e.target.dataset.go); });
}
document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-t]');
  if (t) { e.preventDefault(); showTerm(t.dataset.t); }
});

function openGlossary() {
  const items = Object.entries(GLOSSARY).sort((a, b) => a[1].t.localeCompare(b[1].t));
  openModal(`<h2>Glossary</h2><p style="color:var(--muted);margin:0">${items.length} camera terms, in plain English.</p>
    <input class="gloss-search" placeholder="Search: aperture, bokeh, ISO…" aria-label="Search the glossary">
    <div class="gloss-list">${items.map(([id, g]) => `<div class="gloss-item" data-k="${esc((g.t + ' ' + g.s).toLowerCase())}"><b class="t-link" data-t="${id}">${g.t}</b><p>${g.s}</p></div>`).join('')}</div>`, true);
  const inp = el.card.querySelector('.gloss-search');
  inp.focus();
  inp.addEventListener('input', () => {
    const q = inp.value.trim().toLowerCase();
    el.card.querySelectorAll('.gloss-item').forEach((it) => { it.hidden = q && !it.dataset.k.includes(q); });
  });
}
$('#btnGlossary').addEventListener('click', openGlossary);

function openQuiz() {
  const qs = ch.quiz; let i = 0, score = 0;
  const step = () => {
    if (i >= qs.length) {
      const prev = store.quiz[ch.id] ?? 0;
      const gain = Math.max(0, score - prev) * 20;
      store.quiz[ch.id] = Math.max(prev, score); save();
      if (gain) addXP(gain);
      if (score === qs.length) confetti(50);
      openModal(`<div class="quiz"><div class="qn">Quiz complete</div><div class="qq">You scored ${score} / ${qs.length}</div>
        <p style="color:var(--muted)">${score === qs.length ? 'Perfect! You really get it.' : 'Play with the 3D model a bit more and try again.'}${gain ? ` <b style="color:var(--accent)">+${gain} XP</b>` : ''}</p>
        <div class="foot"><button class="btn" id="qDone">Done</button></div></div>`);
      $('#qDone').addEventListener('click', closeModal);
      renderQuizBest();
      return;
    }
    const q = qs[i];
    openModal(`<div class="quiz"><div class="qn">${ch.title} · question ${i + 1} of ${qs.length}</div><div class="qq">${q.q}</div>
      <div class="opts">${q.options.map((o, k) => `<button data-k="${k}">${o}</button>`).join('')}</div><div class="why" hidden></div>
      <div class="foot"><button class="btn" id="qNext" hidden>${i + 1 < qs.length ? 'Next →' : 'See score'}</button></div></div>`);
    el.card.querySelectorAll('.opts button').forEach((b) => b.addEventListener('click', () => {
      const k = +b.dataset.k, right = k === q.answer;
      if (right) score++;
      sfx(right ? 'right' : 'wrong');
      el.card.querySelectorAll('.opts button').forEach((x) => { x.disabled = true; if (+x.dataset.k === q.answer) x.classList.add('right'); });
      if (!right) b.classList.add('wrong');
      const why = el.card.querySelector('.why'); why.hidden = false; why.innerHTML = (right ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + q.why;
      const nx = $('#qNext'); nx.hidden = false; nx.focus();
      nx.addEventListener('click', () => { i++; step(); });
    }));
  };
  step();
}

function welcome() {
  openModal(`<div class="welcome"><div class="hero"></div><h2>Welcome to CameraClear</h2>
    <p style="color:#cfd4df">Learn how a camera really works by playing with it. Every chapter has a 3D model you can rotate and poke, a real simulated camera you can shoot with, missions that earn XP, and a quick quiz.</p>
    <ol><li><b>Drag</b> the 3D view to orbit, <b>scroll</b> to zoom.</li><li>Move the <b>sliders</b> on the right and watch what changes.</li>
    <li>Complete <b>missions</b> — some need you to take a photo with the red shutter button (or Space).</li><li>Tap any <span class="t-link">highlighted term</span> for its definition.</li></ol>
    <div class="foot" style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn" id="wGo">Start chapter 1 →</button></div></div>`);
  $('#wGo').addEventListener('click', () => { store.welcomed = true; save(); closeModal(); });
}

// ---------------------------------------------------------------- misc wiring
const soundBtn = $('#btnSound');
const renderSound = () => { soundBtn.classList.toggle('muted', audio.muted); soundBtn.title = audio.muted ? 'Sound off' : 'Sound on'; };
soundBtn.addEventListener('click', () => { audio.muted = !audio.muted; store.muted = audio.muted; save(); renderSound(); if (!audio.muted) sfx('click'); });
renderSound();
$('#btnResetView').addEventListener('click', () => stage.resetView());
$('#brand').addEventListener('click', (e) => { e.preventDefault(); openChapter(CHAPTERS[0].id); });
stage.onOrbit = () => { el.hint.classList.add('gone'); emit('orbit'); };
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !el.modal.hidden) closeModal();
  if (e.code === 'Space' && el.modal.hidden && !/INPUT|TEXTAREA|BUTTON/.test(document.activeElement?.tagName || '') ) { e.preventDefault(); shoot(); }
  if (e.code === 'Space' && el.modal.hidden && document.activeElement?.type === 'range') { e.preventDefault(); shoot(); }
});
window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== ch?.id) openChapter(id); });

// ---------------------------------------------------------------- main loop
let last = performance.now(), frame = 0, tick = 0;
function loop(now) {
  requestAnimationFrame(loop);
  if (!reel) frameStep(now);
}
function frameStep(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  time += dt;
  stage.update(dt);
  inst.update?.(dt, s, time);
  stage.render();
  if (ch?.photo && photo && !lcdMin.v && frame % 2 === 0) {
    photo.render(s, time);
    if (frame % 10 === 0) drawHisto(photo.histogram());
  }
  frame++;
  if (!reel && now - tick > 220) {
    tick = now;
    evalMissions('live');
    updateReadout();
    updateLCDInfo();
  }
}

// ---------------------------------------------------------------- Glassbox director
// Lets the Glassbox studio record the storyboard (js/reel.js) frame by frame:
// setup() hides the UI and sizes the 3D stage, frame() renders one exact frame.
let reel = null;
const smooth = (k) => k * k * (3 - 2 * k);
const tween = (a, b, k, log) => (typeof a === 'boolean' ? (k > 0.3 ? b : a) : log ? a * Math.pow(b / a, k) : a + (b - a) * k);
window.glassbox = {
  director: {
    scenes: STORYBOARD.map(({ caption, ms }) => ({ caption, ms })),
    setup({ width, height }) {
      reel = { scene: -1 };
      closeModal();
      document.body.classList.add('gb-reel');
      const host = $('#stage');
      host.style.width = width + 'px';
      host.style.height = height + 'px';
      stage.renderer.setPixelRatio(1);
      stage.resize();
    },
    frame(i, t, dtMs = 1000 / 30) {
      const sc = STORYBOARD[i];
      if (reel.scene !== i) {
        const first = reel.scene < 0;
        reel.scene = i;
        if (first || ch?.id !== sc.chapter) openChapter(sc.chapter);
        Object.assign(s, sc.set);
        ch.onChange?.(s, null);
        stage.setShift(0, 0);
        stage.controls.autoRotate = true;
        stage.controls.autoRotateSpeed = sc.spin ?? 0.5;
      }
      const k = smooth(Math.min(1, Math.max(0, (t - 0.1) / 0.75)));
      for (const [key, [a, b, log]] of Object.entries(sc.anim || {})) { s[key] = tween(a, b, k, log); ch.onChange?.(s, key); }
      frameStep(last + dtMs);
      const withPhoto = !!(ch.photo && photo);
      if (withPhoto) photo.render(s, time);
      return { main: stage.renderer.domElement, inset: withPhoto ? el.photo : null, insetLabel: 'CAMERA SCREEN' };
    },
  },
};

// handy for debugging from the devtools console
window.cameraclear = { stage, photo, get settings() { return s; }, get chapter() { return ch; },
  // advance n frames by hand (useful when the tab is hidden and rAF is paused)
  step(n = 1, ms = 16) { let t = last; for (let i = 0; i < n; i++) frameStep((t += ms)); },
};

renderXP();
openChapter(location.hash.slice(1) || CHAPTERS[0].id);
requestAnimationFrame(loop);
if (!store.welcomed) welcome();
