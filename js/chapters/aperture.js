import * as THREE from 'three';
import { M, makeLens, makeIris } from '../kit.js';
import { APERTURES, fmtF, fmtShutter, fmtDist, autoShutter } from '../optics.js';

const R = 1.45;           // iris housing radius (= f/1.4 fully open)
const XF = 3.2;           // where the light converges after the iris
const SENSOR_X = 5.4;
const NP = 1600;

export default {
  id: 'aperture',
  title: 'Aperture',
  subtitle: 'The adjustable hole that controls light — and blur.',
  view: { pos: [-8.5, 3.6, 5.2], target: [0, 2.2, 0] },
  learn: `
    <p>Inside every lens is an <dfn data-t="iris">iris</dfn> of overlapping blades. The hole they form is the <dfn data-t="aperture">aperture</dfn>. It's measured as an <dfn data-t="f-number">f-number</dfn>: the focal length divided by the hole's diameter.</p>
    <p>So <b>small f-number = big hole</b>. f/1.4 is wide open; f/22 is a pinprick. Each step in the sequence f/1.4 → 2 → 2.8 → 4 → 5.6 → 8 → 11 → 16 → 22 halves the light — one <dfn data-t="stop">stop</dfn>.</p>
    <p class="tip"><b>The side effect:</b> a wide aperture gives a shallow <dfn data-t="depth-of-field">depth of field</dfn> — sharp subject, melted background (<dfn data-t="bokeh">bokeh</dfn>). A narrow one keeps near and far sharp.</p>
    <p>With <b>Av mode</b> on, the camera adjusts the shutter speed to keep brightness the same, so you only see the blur change. Switch it off to see the brightness change too.</p>`,
  terms: ['aperture', 'f-number', 'stop', 'iris', 'bokeh', 'depth-of-field'],
  photo: true,
  defaults: { aperture: 2.8, blades: 7, av: true, scene: 'cloudy', focus: 2.5, focal: 50, iso: 100 },
  onChange(s) { if (s.av) s.shutter = autoShutter(s); },
  modeLabel: (s) => (s.av ? 'Av' : 'M'),
  controls: [
    { key: 'aperture', type: 'stops', label: 'Aperture', values: APERTURES, fmt: fmtF, term: 'f-number', ends: ['f/1.4 wide open', 'f/22 tiny'] },
    { key: 'blades', type: 'range', label: 'Number of blades', min: 5, max: 9, step: 1, term: 'iris', fmt: (v) => v + ' blades' },
    { key: 'av', type: 'toggle', label: 'Av mode (auto shutter speed)', term: 'mode-dial' },
  ],
  missions: [
    { id: 'wide', text: 'Portrait look: shoot at f/2 or wider — watch the background melt.', xp: 60, when: 'shot', check: ({ s }) => s.aperture <= 2.05 },
    { id: 'narrow', text: 'Landscape look: shoot at f/11 or narrower — more stays sharp.', xp: 60, when: 'shot', check: ({ s }) => s.aperture >= 10.9 },
    { id: 'blades', text: 'Switch to 9 blades: a rounder opening.', xp: 30, check: ({ s }) => s.blades >= 9 },
    { id: 'dark', text: 'Turn Av mode off, then stop down to f/16. What happens to the picture?', xp: 40, check: ({ s }) => !s.av && s.aperture >= 15.9 },
  ],
  quiz: [
    { q: 'Which lets in MORE light?', options: ['f/16', 'f/2', 'They are the same', 'Depends on ISO'], answer: 1, why: 'f/2 is a much bigger opening — six stops (64×) more light than f/16.' },
    { q: 'Going from f/4 to f/5.6 does what to the light?', options: ['Doubles it', 'Halves it', 'Nothing', 'Quarters it'], answer: 1, why: 'Each full stop along the f-number sequence halves the light.' },
    { q: 'You want a blurry background for a portrait. You should…', options: ['Use a narrow aperture (f/16)', 'Use a wide aperture (f/1.8)', 'Raise ISO', 'Use a slower shutter'], answer: 1, why: 'Wide apertures give shallow depth of field, so the background falls out of focus.' },
  ],

  build({ stage }) {
    const g = new THREE.Group(); g.position.y = 2.2; stage.root.add(g);

    // housing (cut away)
    const housing = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.12, 20, 96), M.metal(0x1c1e24, { roughness: 0.45 })); housing.rotation.y = Math.PI / 2; housing.castShadow = true; g.add(housing);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.56, 0.07, 16, 80), M.metal(0x8a8f99, { roughness: 0.25 })); ring.rotation.y = Math.PI / 2; g.add(ring);

    const iris = makeIris({ R });
    iris.group.rotation.y = Math.PI / 2;
    g.add(iris.group);
    const front = makeLens(1.45, 0.35, 'x'); front.position.x = -1.2; g.add(front);
    const back = makeLens(1.35, 0.3, 'x'); back.position.x = 1.2; g.add(back);

    // "sensor" that glows with the amount of light
    const sensorMat = new THREE.MeshStandardMaterial({ color: 0x0e1420, emissive: 0xffd9a0, emissiveIntensity: 0.5, roughness: 0.4 });
    const sensor = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2), sensorMat); sensor.rotation.y = -Math.PI / 2; sensor.position.x = SENSOR_X; g.add(sensor);
    const sframe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 2.0), M.metal(0x23262e)); sframe.position.x = SENSOR_X + 0.07; g.add(sframe);

    stage.label('Iris blades', [0, 1.95, 0], g, 'accent');
    stage.label('Light in', [-6.5, 1.1, 0], g);
    stage.label('Sensor', [SENSOR_X, 0.95, 0], g, 'cyan');
    const openLbl = stage.label('', [0, -2.0, 0], g, 'big');

    // light particles
    const pos = new Float32Array(NP * 3);
    const st = Array.from({ length: NP }, () => ({ x: 0, y0: 0, z0: 0, passed: false }));
    const spawn = (p, x) => {
      const r = Math.sqrt(Math.random()) * 1.42, a = Math.random() * Math.PI * 2;
      p.y0 = r * Math.cos(a); p.z0 = r * Math.sin(a); p.x = x; p.passed = false;
    };
    st.forEach((p) => spawn(p, -7 + Math.random() * 7));
    const pgeo = new THREE.BufferGeometry(); pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(pgeo, new THREE.PointsMaterial({ color: 0xffdd99, size: 0.055, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    pts.frustumCulled = false; g.add(pts);

    let last = '', r = 1;
    return {
      update(dt, s) {
        const key = s.aperture + '|' + s.blades;
        if (key !== last) {
          last = key;
          r = R * (1.4 / s.aperture);
          iris.set(r, s.blades);
          const light = (1.4 / s.aperture) ** 2;
          sensorMat.emissiveIntensity = 0.05 + 1.4 * light;
          openLbl.element.innerHTML = `${fmtF(s.aperture)} <small>opening ⌀ ${(s.focal / s.aperture).toFixed(1)} mm on a ${s.focal} mm lens</small>`;
        }
        const speed = 4.2 * dt;
        for (let i = 0; i < NP; i++) {
          const p = st[i];
          const prev = p.x; p.x += speed;
          if (!p.passed && prev < 0 && p.x >= 0) {
            // iris plane: local blade coords are (-z, y)
            if (iris.inside(-p.z0, p.y0, r, s.blades)) p.passed = true;
            else { spawn(p, -7 - Math.random() * 0.5); }
          }
          if (p.x > SENSOR_X) spawn(p, -7 - Math.random() * 0.5);
          const k = p.x > 0 ? 1 - p.x / XF : 1;
          pos[i * 3] = p.x; pos[i * 3 + 1] = p.y0 * k; pos[i * 3 + 2] = p.z0 * k;
        }
        pgeo.attributes.position.needsUpdate = true;
      },
      metrics(s) {
        return { light: (1.4 / s.aperture) ** 2, stopsFrom14: 2 * Math.log2(s.aperture / 1.4) };
      },
      readout(s, m) {
        const pct = Math.max(0.2, m.light * 100);
        const dofTxt = isFinite(m.dofTotal) ? fmtDist(m.dofTotal) : 'near → ∞';
        return `
          <div class="eq">diameter = focal length ÷ N = ${s.focal} ÷ ${s.aperture} = ${(s.focal / s.aperture).toFixed(1)} mm</div>
          <div class="row"><span>Light through vs. f/1.4</span><b>${m.light >= 0.1 ? Math.round(m.light * 100) : (m.light * 100).toFixed(1)}%</b></div>
          <div class="bar"><i style="width:${pct}%"></i></div>
          <div class="row"><span>Stops darker than f/1.4</span><b>${m.stopsFrom14.toFixed(1)}</b></div>
          <div class="row"><span>Depth of field at ${fmtDist(s.focus)}</span><b>${dofTxt}</b></div>
          <div class="row"><span>Shutter speed ${s.av ? '(set by Av)' : '(fixed)'}</span><b>${fmtShutter(s.shutter)}</b></div>`;
      },
    };
  },
};
