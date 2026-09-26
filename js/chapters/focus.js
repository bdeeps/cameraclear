import * as THREE from 'three';
import { M, Rays, makeLens, pushSeg, glowSprite, axisLine } from '../kit.js';
import { fmtDist, INF, autoShutter } from '../optics.js';

const F = 2;            // lens focal length in diagram units
const SENSOR_X = 5;     // sensor position
const H = 0.8;          // height of the light source above the axis
const SHARP = 0.035;    // blur-circle radius counted as "sharp"

function optics(s) {
  const u = s.lensPos + s.obj;              // object → lens
  const v = (F * u) / (u - F);             // lens → image
  const vs = SENSOR_X - s.lensPos;          // lens → sensor
  const coc = (s.open * Math.abs(vs - v)) / v;
  const uf = vs > F ? (F * vs) / (vs - F) : Infinity; // distance that is in focus
  return { u, v, vs, coc, uf, sharp: coc < SHARP };
}

export default {
  id: 'focus',
  title: 'Focus',
  subtitle: 'Making the rays meet exactly on the sensor.',
  view: { pos: [-0.8, 4.4, 12], target: [-0.8, 1.1, 0] },
  learn: `
    <p>A lens catches a whole cone of rays from each point of your subject and bends them so they meet again at a single point behind it. <dfn data-t="focus">Focusing</dfn> means moving the lens until that meeting point lands <b>exactly on the sensor</b>.</p>
    <p>If they meet too early or too late, the point is recorded as a disc — the <dfn data-t="circle-of-confusion">blur circle</dfn>. Big disc, blurry picture.</p>
    <p>The <dfn data-t="thin-lens">lens equation</dfn> <b>1/f = 1/u + 1/v</b> tells you where they meet: closer objects (small <i>u</i>) focus further back (big <i>v</i>), so the lens has to move <i>forward</i> to focus close.</p>
    <p class="tip"><b>Then try the real thing:</b> tap anything on the camera screen to focus on it — that's how <dfn data-t="autofocus">autofocus</dfn> points work.</p>`,
  terms: ['focus', 'thin-lens', 'focal-point', 'circle-of-confusion', 'plane-of-focus', 'front-back-focus', 'autofocus', 'min-focus'],
  photo: true,
  defaults: { lensPos: 3.0, obj: 6, open: 0.9, focus: 12, aperture: 2.8, iso: 100, scene: 'cloudy', focal: 50 },
  onChange(s) { s.shutter = autoShutter(s); },
  modeLabel: () => 'Av · AF',
  controls: [
    { key: 'lensPos', type: 'range', label: 'Focus ring (moves the lens)', min: 0.2, max: 3.2, step: 0.01, term: 'focus', fmt: (v) => (SENSOR_X - v).toFixed(2) + ' to sensor', ends: ['lens far from sensor', 'close to sensor'] },
    { key: 'obj', type: 'range', label: 'Light-source distance', min: 2.5, max: 10, step: 0.05, fmt: (v) => v.toFixed(1) + ' units', ends: ['near', 'far'] },
    { key: 'open', type: 'range', label: 'Lens opening', min: 0.25, max: 1.1, step: 0.01, term: 'aperture', fmt: (v) => Math.round(v * 100) + '%', hint: 'Notice: a smaller opening makes a smaller blur circle — a teaser for chapter 4.' },
    { key: 'focus', type: 'log', label: 'Camera: focus distance', min: 0.5, max: 100, inf: INF, term: 'focus-distance', fmt: (v) => fmtDist(v), hint: 'Or just tap the camera screen.' },
  ],
  missions: [
    { id: 'sharp', text: 'Turn the focus ring until the blur circle shrinks to a point.', xp: 50, check: ({ m }) => m.sharp },
    { id: 'front', text: 'Make the rays cross before they reach the sensor.', xp: 30, check: ({ m }) => m.v < m.vs - 0.4 },
    { id: 'refocus', text: 'Bring the light closer than 3.5 units, then refocus until sharp.', xp: 50, check: ({ s, m }) => s.obj <= 3.5 && m.sharp },
    { id: 'tap', text: 'On the camera screen, tap the hiker in red to focus on them.', xp: 50, check: ({ s, m }) => Math.abs(s.focus - m.distHiker) < 0.35 },
    { id: 'far', text: 'Focus on the far autumn tree and take a photo.', xp: 50, when: 'shot', check: ({ s }) => s.focus >= 15 && s.focus < 60 },
  ],
  quiz: [
    { q: 'An out-of-focus point of light appears on the sensor as…', options: ['A sharper point', 'A disc called the blur circle (circle of confusion)', 'A line', 'Nothing at all'], answer: 1, why: 'The cone of rays is cut by the sensor before or after it converges, leaving a disc.' },
    { q: 'You move closer to your subject. To stay focused, the lens must move…', options: ['Towards the sensor', 'Away from the sensor', 'Nowhere', 'Sideways'], answer: 1, why: '1/f = 1/u + 1/v: smaller u means bigger v, so the image forms further back and the lens must move forward.' },
    { q: 'What is the plane of focus?', options: ['The sensor surface', 'The slice of the scene at the focus distance that is perfectly sharp', 'The front glass of the lens', 'The horizon'], answer: 1, why: 'Only things at exactly the focus distance are perfectly sharp; depth of field extends a little either side.' },
  ],

  build({ stage }) {
    const g = new THREE.Group(); g.position.y = 2.0; stage.root.add(g);
    g.add(axisLine([-11, 0, 0], [6.5, 0, 0]));

    // sensor
    const gridTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
      x.fillStyle = '#10151e'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#26324a'; x.lineWidth = 1;
      for (let i = 0; i <= 256; i += 16) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 256); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(256, i); x.stroke(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    const sensor = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshStandardMaterial({ map: gridTex, roughness: 0.4, metalness: 0.4, side: THREE.DoubleSide }));
    sensor.rotation.y = -Math.PI / 2; sensor.position.x = SENSOR_X + 0.02; g.add(sensor);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.9, 2.9), M.metal(0x23262e)); frame.position.x = SENSOR_X + 0.1; g.add(frame);
    stage.label('Sensor', [SENSOR_X, 1.65, 0], g, 'cyan');

    // blur circle on the sensor
    const cocMat = new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const coc = new THREE.Mesh(new THREE.CircleGeometry(1, 64), cocMat); coc.rotation.y = -Math.PI / 2; coc.position.x = SENSOR_X - 0.01; g.add(coc);
    const cocRing = new THREE.Mesh(new THREE.RingGeometry(0.96, 1, 64), M.glow(0xffe8b0, { side: THREE.DoubleSide })); cocRing.rotation.y = -Math.PI / 2; cocRing.position.x = SENSOR_X - 0.015; g.add(cocRing);
    const cocLabel = stage.label('', [SENSOR_X, -1.6, 0], g, 'accent');

    // lens assembly
    const lensG = new THREE.Group(); g.add(lensG);
    const lens = makeLens(1.15, 0.5, 'x'); lensG.add(lens);
    const barrel = new THREE.Mesh((() => { const geo = new THREE.CylinderGeometry(1.35, 1.35, 0.5, 64, 1, true, 0, Math.PI * 1.3); geo.rotateZ(Math.PI / 2); return geo; })(), M.metal(0x20232b, { side: THREE.DoubleSide }));
    lensG.add(barrel);
    const stop = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.33, 64), M.metal(0x15171c, { side: THREE.DoubleSide })); stop.rotation.y = Math.PI / 2; stop.position.x = -0.3; lensG.add(stop);
    stage.label('Lens', [0, 1.55, 0], lensG);
    const fDots = [-1, 1].map((sgn) => {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), M.glow(0x5ad1ff)); d.position.x = sgn * F; lensG.add(d);
      stage.label('F', [0, 0.25, 0], d, 'cyan plain'); return d;
    });
    void fDots;

    // the light source
    const src = new THREE.Group(); g.add(src);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 14), M.glow(0xfff0c0)); bulb.position.y = H; src.add(bulb);
    const halo = glowSprite(0xffc860, 1.4, 0.9); halo.position.y = H; src.add(halo);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.0 + H), M.metal(0x3a3f4a)); pole.position.y = (H - 2.0) / 2; src.add(pole);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.4, 0.06, 24), M.metal(0x3a3f4a)); foot.position.y = -1.97; src.add(foot);
    stage.label('Point of light', [0, H + 0.45, 0], src);

    // plane of focus
    const pof = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), M.ghost(0x4ade80, 0.13)); pof.rotation.y = Math.PI / 2; g.add(pof);
    const pofEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.6, 2.6)), new THREE.LineBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.6 })); pofEdge.rotation.y = Math.PI / 2; g.add(pofEdge);
    const pofLabel = stage.label('Plane of sharp focus', [0, -1.55, 0], pof, 'good');

    const rays = new Rays(stage, { width: 2, opacity: 0.8 });
    g.add(rays.group);
    const ghost = new Rays(stage, { width: 1.4, opacity: 0.35 });
    g.add(ghost.group);

    let last = '';
    let stopR = -1;
    const rebuild = (s) => {
      const o = optics(s);
      lensG.position.x = s.lensPos;
      src.position.x = -s.obj;
      if (Math.abs(stopR - s.open) > 1e-4) {
        stopR = s.open; stop.geometry.dispose(); stop.geometry = new THREE.RingGeometry(s.open, 1.33, 64);
      }

      const P = new THREE.Vector3(-s.obj, H, 0);
      const I = new THREE.Vector3(s.lensPos + o.v, (-H * o.v) / o.u, 0);
      const pos = [], col = [], gpos = [], gcol = [];
      const warm = [1, 0.78, 0.35], dim = [0.55, 0.42, 0.2];
      const L = new THREE.Vector3(), E = new THREE.Vector3(), D = new THREE.Vector3();
      const N = 18;
      for (let k = 0; k < N; k++) {
        const a = (k / N) * Math.PI * 2;
        L.set(s.lensPos, s.open * 0.97 * Math.cos(a), s.open * 0.97 * Math.sin(a));
        D.copy(I).sub(L);
        E.copy(L).addScaledVector(D, (SENSOR_X - s.lensPos) / o.v);
        pushSeg(pos, col, P, L, dim, warm);
        pushSeg(pos, col, L, E, warm, warm);
        if (o.v > o.vs) pushSeg(gpos, gcol, E, I, warm, [0.2, 0.15, 0.05]);
      }
      // chief ray through the centre
      const C = new THREE.Vector3(s.lensPos, 0, 0);
      const chief = C.clone().add(C.clone().sub(P).multiplyScalar((SENSOR_X - s.lensPos) / (s.lensPos + s.obj)));
      pushSeg(pos, col, P, C, [0.4, 0.4, 0.4], [0.6, 0.6, 0.6]);
      pushSeg(pos, col, C, chief, [0.6, 0.6, 0.6], [0.6, 0.6, 0.6]);
      rays.set(pos, col);
      ghost.set(gpos, gcol);

      // blur disc
      const r = Math.max(0.03, o.coc);
      const cy = H * (1 - (SENSOR_X + s.obj) / (s.lensPos + s.obj));
      [coc, cocRing].forEach((m) => { m.scale.setScalar(r); m.position.y = cy; });
      cocMat.opacity = Math.min(0.95, Math.max(0.12, 0.012 / (r * r)));
      cocMat.color.set(o.sharp ? 0xb6ffcf : 0xffd27a);
      cocLabel.position.y = Math.min(cy - r - 0.25, -1.55);
      cocLabel.element.innerHTML = o.sharp ? 'Sharp point ✓' : `Blur circle ⌀ ${(o.coc * 2).toFixed(2)}`;
      cocLabel.element.className = 'lbl ' + (o.sharp ? 'good' : 'accent');

      // plane of focus
      const px = s.lensPos - o.uf;
      pof.visible = pofEdge.visible = isFinite(o.uf) && px > -11;
      pofLabel.visible = !!(pof.visible);
      pof.position.x = pofEdge.position.x = px;
    };

    return {
      update(dt, s, t) {
        const key = `${s.lensPos}|${s.obj}|${s.open}`;
        if (key !== last) { last = key; rebuild(s); }
        halo.material.opacity = 0.75 + 0.2 * Math.sin(t * 3);
      },
      metrics(s) { return optics(s); },
      readout(s, m) {
        const status = m.sharp
          ? '<div class="status good">In focus — all the rays meet on the sensor ✓</div>'
          : m.v < m.vs
            ? '<div class="status mid">Rays meet <b>in front of</b> the sensor → slide the lens towards the sensor.</div>'
            : m.v > 5.2
              ? '<div class="status bad">Too close! Even with the lens all the way forward it can\'t focus — the minimum focus distance.</div>'
              : '<div class="status mid">Rays would meet <b>behind</b> the sensor → slide the lens away from the sensor.</div>';
        return `
          <div class="eq">1/f = 1/u + 1/v<br>1/${F.toFixed(2)} = 1/${m.u.toFixed(2)} + 1/${m.v.toFixed(2)}</div>
          <div class="row"><span>u · light → lens</span><b>${m.u.toFixed(2)}</b></div>
          <div class="row"><span>v · lens → where rays meet</span><b>${m.v.toFixed(2)}</b></div>
          <div class="row"><span>lens → sensor</span><b>${m.vs.toFixed(2)}</b></div>
          <div class="row"><span>Blur circle diameter</span><b>${(m.coc * 2).toFixed(3)}</b></div>
          ${status}
          <div class="row" style="margin-top:8px"><span>Camera focused at</span><b>${fmtDist(s.focus)}</b></div>`;
      },
    };
  },
};
