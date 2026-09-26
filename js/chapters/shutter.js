import * as THREE from 'three';
import { M } from '../kit.js';
import { SHUTTERS, fmtShutter, fmtISO, autoISO, shutterNorm } from '../optics.js';

const W = 3.1, Hh = 2.0;       // opening size
const SLATS = 5;
const TRAVEL = 0.8;            // seconds (slow motion) for a curtain to cross

export default {
  id: 'shutter',
  title: 'Shutter Speed',
  subtitle: 'How long the light gets in — and what moves meanwhile.',
  view: { pos: [3.8, 3.4, 7.4], target: [0, 2.1, 0] },
  learn: `
    <p>The <dfn data-t="shutter">shutter</dfn> is a pair of curtains in front of the sensor. The first curtain drops to start the exposure; the second follows to end it. The time between them is the <dfn data-t="shutter-speed">shutter speed</dfn>.</p>
    <p>At very fast speeds the second curtain chases the first so closely that only a <b>slit</b> sweeps across the sensor — every row still gets the same tiny exposure. This is a <dfn data-t="focal-plane-shutter">focal-plane shutter</dfn>.</p>
    <p class="tip"><b>The side effects:</b> fast speeds freeze the bouncing ball. Slow speeds blur it (<dfn data-t="motion-blur">motion blur</dfn>) — and if you're hand-holding, blur everything (<dfn data-t="camera-shake">camera shake</dfn>). Rule of thumb: hand-held, stay faster than 1/focal length (the <dfn data-t="reciprocal-rule">reciprocal rule</dfn>).</p>
    <p>Auto ISO is on, so brightness stays constant while you explore — only the blur changes.</p>`,
  terms: ['shutter', 'shutter-speed', 'focal-plane-shutter', 'sync-speed', 'motion-blur', 'camera-shake', 'reciprocal-rule', 'tripod'],
  photo: true,
  defaults: { shutter: 1 / 125, aperture: 4, scene: 'cloudy', motion: true, tripod: false, autoIso: true, focus: 4.5, focal: 50 },
  onChange(s) { if (s.autoIso) s.iso = autoISO(s); },
  modeLabel: (s) => (s.autoIso ? 'Tv · Auto ISO' : 'M'),
  controls: [
    { key: 'shutter', type: 'stops', label: 'Shutter speed', values: SHUTTERS, fmt: fmtShutter, term: 'shutter-speed', ends: ['30″ slow', '1/8000 fast'] },
    { key: 'tripod', type: 'toggle', label: 'Camera on a tripod', term: 'tripod' },
    { key: 'autoIso', type: 'toggle', label: 'Auto ISO (keep brightness)', term: 'iso' },
  ],
  missions: [
    { id: 'freeze', text: 'Freeze the bouncing ball: shoot at 1/1000 or faster.', xp: 60, when: 'shot', check: ({ s }) => s.shutter <= 1 / 999 },
    { id: 'shake', text: 'Hand-held, shoot at 1/8 or slower. See the camera shake?', xp: 50, when: 'shot', check: ({ s }) => !s.tripod && s.shutter >= 1 / 8.1 },
    { id: 'streak', text: 'On a tripod, shoot at 1/15 or slower: sharp scene, streaky ball.', xp: 60, when: 'shot', check: ({ s }) => s.tripod && s.shutter >= 1 / 15.1 },
    { id: 'slit', text: 'Set 1/2000 or faster and watch the shutter become a travelling slit.', xp: 30, check: ({ s }) => s.shutter <= 1 / 1999 },
  ],
  quiz: [
    { q: 'Which shutter speed best freezes a running dog?', options: ['1/15', '1/1000', '1″', '1/4'], answer: 1, why: '1/1000 s is so short that the dog barely moves while the shutter is open.' },
    { q: 'Going from 1/250 to 1/125 does what to the light?', options: ['Halves it', 'Doubles it', 'Nothing', 'Quadruples it'], answer: 1, why: 'The shutter stays open twice as long, so twice the light arrives — one stop brighter.' },
    { q: 'Hand-holding a 200 mm lens, the slowest safe shutter speed is about…', options: ['1/30', '1/200', '1″', '1/8'], answer: 1, why: 'The reciprocal rule: 1 ÷ focal length. Longer lenses magnify shake.' },
  ],

  build({ stage }) {
    const g = new THREE.Group(); g.position.y = 2.1; stage.root.add(g);

    // sensor behind the curtains
    const sensorTex = (() => {
      const c = document.createElement('canvas'); c.width = 310; c.height = 200; const x = c.getContext('2d');
      x.fillStyle = '#243044'; x.fillRect(0, 0, 310, 200);
      const cols = ['#b33', '#3a3', '#3a3', '#36c'];
      for (let yy = 0; yy < 200; yy += 5) for (let xx = 0; xx < 310; xx += 5) { x.fillStyle = cols[((yy / 5) % 2) * 2 + ((xx / 5) % 2)]; x.globalAlpha = 0.35; x.fillRect(xx, yy, 4, 4); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const sensorMat = new THREE.MeshStandardMaterial({ map: sensorTex, emissive: 0xffffff, emissiveMap: sensorTex, emissiveIntensity: 0.1, metalness: 0.5, roughness: 0.3 });
    const sensor = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), sensorMat); sensor.position.z = -0.08; g.add(sensor);
    const board = new THREE.Mesh(new THREE.BoxGeometry(4.2, 3.3, 0.06), M.matte(0x1f4d35)); board.position.z = -0.14; g.add(board);

    // light band hitting the sensor
    const bandMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const band = new THREE.Mesh(new THREE.PlaneGeometry(W, 1), bandMat); band.position.z = -0.07; g.add(band);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd48a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(W, 1, 2.6), beamMat); g.add(beam);

    // frame (hides stowed curtains)
    const shape = new THREE.Shape(); shape.moveTo(-2.5, -1.95); shape.lineTo(2.5, -1.95); shape.lineTo(2.5, 1.95); shape.lineTo(-2.5, 1.95); shape.closePath();
    const hole = new THREE.Path(); hole.moveTo(-W / 2, -Hh / 2); hole.lineTo(-W / 2, Hh / 2); hole.lineTo(W / 2, Hh / 2); hole.lineTo(W / 2, -Hh / 2); hole.closePath(); shape.holes.push(hole);
    const fgeo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
    const frame = new THREE.Mesh(fgeo, M.metal(0x2a2d35, { roughness: 0.5 })); frame.position.z = 0.2; frame.castShadow = true; g.add(frame);

    // curtains
    const mkCurtain = (color, z) => {
      const mat = M.metal(color, { roughness: 0.55, metalness: 0.6 });
      return Array.from({ length: SLATS }, () => { const m = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, Hh / SLATS + 0.06, 0.015), mat); m.position.z = z; g.add(m); return m; });
    };
    const first = mkCurtain(0x131419, 0.06);
    const second = mkCurtain(0x2a2c34, 0.12);
    const spread = (i) => Hh / 2 - (i + 0.5) * (Hh / SLATS);
    const stackLow = (i) => -Hh / 2 - 0.26 - i * 0.05;
    const stackHigh = (i) => Hh / 2 + 0.26 + (SLATS - 1 - i) * 0.05;

    stage.label('1st curtain opens ↓', [-2.1, -2.3, 0.3], g);
    stage.label('2nd curtain closes ↓', [2.1, 2.3, 0.3], g);
    const hud = stage.label('', [0, -2.75, 0.3], g, 'big accent');
    const slitLbl = stage.label('Travelling slit!', [2.9, 0, 0.3], g, 'bad');

    let cycle = 0;
    const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
    return {
      update(dt, s) {
        const D = 0.1 + Math.pow(shutterNorm(s.shutter), 1.25) * 3.4;   // visual open time
        const pre = 0.5, hold = 0.9;
        const total = pre + D + TRAVEL + hold;
        cycle = (cycle + dt) % total;
        const p = ease((cycle - pre) / TRAVEL);          // first curtain open fraction
        const q = ease((cycle - pre - D) / TRAVEL);      // second curtain close fraction
        first.forEach((m, i) => { m.position.y = spread(i) + (stackLow(i) - spread(i)) * p; });
        second.forEach((m, i) => { m.position.y = stackHigh(i) + (spread(i) - stackHigh(i)) * q; });
        // uncovered band between curtains
        const yTop = Hh / 2 - q * Hh;   // bottom edge of 2nd curtain
        const yBot = Hh / 2 - p * Hh;   // top edge of 1st curtain
        const h = Math.max(0, yTop - yBot);
        band.scale.y = beam.scale.y = Math.max(0.001, h);
        band.position.y = beam.position.y = (yTop + yBot) / 2;
        bandMat.opacity = h > 0.001 ? 0.55 : 0;
        beamMat.opacity = h > 0.001 ? 0.12 : 0;
        beam.position.z = 1.3;
        sensorMat.emissiveIntensity = 0.08 + 0.5 * (h / Hh);
        const slit = D < TRAVEL;
        slitLbl.visible = !!(slit);
        const factor = D / s.shutter;
        hud.element.innerHTML = `${fmtShutter(s.shutter)} <small>${factor >= 1 ? 'slowed down ×' + Math.round(factor).toLocaleString() : 'sped up ×' + (1 / factor).toFixed(0)} so you can see it</small>`;
      },
      readout(s, m) {
        const frozen = m.motionPx < 1.5;
        const handOk = s.tripod || s.shutter <= 1 / s.focal * 1.05;
        return `
          <div class="row"><span>Shutter open for</span><b>${fmtShutter(s.shutter)}</b></div>
          <div class="row"><span>Ball moves during exposure</span><b>${m.motionPx.toFixed(1)} px</b></div>
          <div class="bar ${frozen ? 'good' : 'bad'}"><i style="width:${Math.min(100, m.motionPx * 2)}%"></i></div>
          <div class="row"><span>Camera shake</span><b>${s.tripod ? 'none (tripod)' : m.shakePx.toFixed(1) + ' px'}</b></div>
          <div class="bar ${m.shakePx < 1.5 ? 'good' : 'bad'}"><i style="width:${Math.min(100, m.shakePx * 4)}%"></i></div>
          <div class="row"><span>Reciprocal rule (1/${s.focal})</span><b>${handOk ? 'OK ✓' : 'too slow ✗'}</b></div>
          <div class="row"><span>ISO ${s.autoIso ? '(auto)' : ''}</span><b>${fmtISO(s.iso)}</b></div>
          <div class="status ${frozen ? 'good' : 'mid'}">${frozen ? 'Motion frozen.' : 'The ball smears across the frame.'}</div>`;
      },
    };
  },
};
