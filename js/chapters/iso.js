import * as THREE from 'three';
import { M } from '../kit.js';
import { ISOS, fmtISO, fmtStops } from '../optics.js';

const COLS = 8, ROWS = 5, SP = 0.62, CUP = 1.2;
const FILTER_Y = CUP + 0.06;
const PHOTON_RATE = 700;          // photons / second at full light
const CHARGE = 0.05;              // fraction of a well per photon
const READ_NOISE = 0.012;
const CYCLE = 3.0, COLLECT = 2.4;
const FCOL = [0xff4040, 0x40ff70, 0x4a86ff];

export default {
  id: 'iso',
  title: 'ISO & the Sensor',
  subtitle: 'Buckets of light, and turning up the volume.',
  view: { pos: [5.2, 6.4, 7.2], target: [0, 1.0, 0] },
  learn: `
    <p>A sensor is a grid of <dfn data-t="photosite">photosites</dfn> — tiny wells that collect photons during the exposure. More light → fuller wells → brighter pixels.</p>
    <p>Each well only measures <i>how much</i> light, not colour. A <dfn data-t="bayer">Bayer filter</dfn> of red, green and blue squares lets each well see one colour; the camera fills in the rest. <dfn data-t="microlens">Microlenses</dfn> funnel light into each well.</p>
    <p><dfn data-t="iso">ISO</dfn> doesn't catch more light. It <b>amplifies</b> what was caught (<dfn data-t="gain">gain</dfn>). In dim light a few random photons make a big difference, and amplifying them makes that randomness visible as <dfn data-t="noise">noise</dfn>.</p>
    <p class="tip"><b>Watch the wells:</b> the solid column is the light actually collected; the ghost column is after ISO amplification. When a ghost hits the top it turns red: <dfn data-t="clipping">clipped</dfn>.</p>`,
  terms: ['iso', 'photosite', 'gain', 'noise', 'bayer', 'microlens', 'clipping'],
  photo: true,
  defaults: { light: -3, iso: 100, filter: true, scene: 'dusk', aperture: 4, shutter: 1 / 60, focal: 50, focus: 2.5 },
  modeLabel: () => 'M',
  controls: [
    { key: 'light', type: 'range', label: 'Light falling on the sensor', min: -7, max: 0, step: 1, fmt: (v) => (v === 0 ? 'full' : '1/' + 2 ** -v), ends: ['very dim', 'bright'] },
    { key: 'iso', type: 'stops', label: 'ISO (amplification)', values: ISOS, fmt: fmtISO, term: 'iso', ends: ['100 clean', '25600 grainy'] },
    { key: 'filter', type: 'toggle', label: 'Bayer colour filter', term: 'bayer' },
  ],
  missions: [
    { id: 'fix', text: 'The dusk photo is too dark. Rescue it with ISO alone and take the shot.', xp: 60, when: 'shot', check: ({ m }) => Math.abs(m.stops) <= 0.5 },
    { id: 'noise', text: 'Crank ISO to 12800 or more and look closely at the grain.', xp: 40, check: ({ s }) => s.iso >= 12800 },
    { id: 'filter', text: 'Remove the colour filter. The sensor is colour-blind without it!', xp: 30, check: ({ s }) => !s.filter },
    { id: 'clip', text: 'Overflow: make at least 10 wells clip (lots of light × lots of gain).', xp: 40, check: ({ m }) => m.clipped >= 10 },
  ],
  quiz: [
    { q: 'What does raising ISO actually do?', options: ['Makes the sensor catch more photons', 'Amplifies the signal the sensor already caught', 'Opens the aperture', 'Slows the shutter'], answer: 1, why: 'ISO is gain. The amount of light collected is set by aperture and shutter speed.' },
    { q: 'Why is high ISO noisy?', options: ['The sensor overheats', 'Few photons means big random variation, and amplifying it makes it visible', 'The lens gets dirty', 'It isn\'t'], answer: 1, why: 'Photons arrive randomly. With little light the randomness is large relative to the signal, and gain magnifies it (plus the electronics\' own noise).' },
    { q: 'ISO 400 → ISO 800 is…', options: ['One stop brighter', 'Two stops brighter', 'Half as bright', 'The same brightness'], answer: 0, why: 'Doubling ISO doubles the amplification: one stop.' },
  ],

  build({ stage }) {
    const g = new THREE.Group(); stage.root.add(g);
    const base = new THREE.Mesh(new THREE.BoxGeometry(COLS * SP + 0.5, 0.2, ROWS * SP + 0.5), M.metal(0x2a1f3a, { roughness: 0.4 })); base.position.y = -0.1; base.receiveShadow = true; g.add(base);

    const wellGeo = new THREE.BoxGeometry(0.5, CUP, 0.5); wellGeo.translate(0, CUP / 2, 0);
    const wellMat = new THREE.MeshStandardMaterial({ color: 0x8090b0, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide });
    const edgeGeo = new THREE.EdgesGeometry(wellGeo);
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x55607a, transparent: true, opacity: 0.8 });
    const rawGeo = new THREE.BoxGeometry(0.34, 1, 0.34); rawGeo.translate(0, 0.5, 0);
    const ampGeo = new THREE.BoxGeometry(0.46, 1, 0.46); ampGeo.translate(0, 0.5, 0);
    const filterGeo = new THREE.BoxGeometry(0.54, 0.05, 0.54);
    const lensGeo = new THREE.SphereGeometry(0.25, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const lensMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.28, roughness: 0.05, clearcoat: 1, depthWrite: false });

    const wells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = (c - (COLS - 1) / 2) * SP, z = (r - (ROWS - 1) / 2) * SP;
      const f = r % 2 === 0 ? (c % 2 === 0 ? 0 : 1) : c % 2 === 0 ? 1 : 2;
      const w = new THREE.Mesh(wellGeo, wellMat); w.position.set(x, 0, z); g.add(w);
      const e = new THREE.LineSegments(edgeGeo, edgeMat); e.position.set(x, 0, z); g.add(e);
      const rawMat = new THREE.MeshStandardMaterial({ color: FCOL[f], emissive: FCOL[f], emissiveIntensity: 0.4, roughness: 0.4 });
      const raw = new THREE.Mesh(rawGeo, rawMat); raw.position.set(x, 0, z); raw.scale.y = 0.001; g.add(raw);
      const ampMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false });
      const amp = new THREE.Mesh(ampGeo, ampMat); amp.position.set(x, 0, z); amp.scale.y = 0.001; g.add(amp);
      const fm = new THREE.MeshStandardMaterial({ color: FCOL[f], emissive: FCOL[f], emissiveIntensity: 0.35, transparent: true, opacity: 0.75 });
      const fil = new THREE.Mesh(filterGeo, fm); fil.position.set(x, FILTER_Y, z); g.add(fil);
      const ml = new THREE.Mesh(lensGeo, lensMat); ml.position.set(x, FILTER_Y + 0.03, z); g.add(ml);
      wells.push({ x, z, f, raw, amp, rawMat, ampMat, fil, charge: 0, shown: 0, noise: 0 });
    }
    stage.label('Microlens + colour filter', [-(COLS / 2) * SP - 0.3, FILTER_Y + 0.35, -(ROWS / 2) * SP], g);
    stage.label('Photosite wells', [(COLS / 2) * SP + 0.2, 0.6, (ROWS / 2) * SP], g, 'cyan');
    const phase = stage.label('', [0, CUP + 2.4, 0], g, 'big');

    // photons
    const NP = 900;
    const ppos = new Float32Array(NP * 3), pcol = new Float32Array(NP * 3);
    const ph = Array.from({ length: NP }, () => ({ on: false, x: 0, y: 0, z: 0, w: 0, c: 0, filtered: false }));
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(ppos, 3));
    pgeo.setAttribute('color', new THREE.BufferAttribute(pcol, 3));
    const points = new THREE.Points(pgeo, new THREE.PointsMaterial({ size: 0.09, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    points.frustumCulled = false; g.add(points);
    const RGB = [[1, 0.3, 0.3], [0.35, 1, 0.45], [0.4, 0.6, 1]];

    let t = 0, acc = 0, noiseT = 0, lastFilter = null;
    const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += Math.random(); return (u - 2) * 1.73; };
    const stat = { mean: 0, sd: 0, clipped: 0, photons: 0 };

    return {
      update(dt, s) {
        if (lastFilter !== s.filter) {
          lastFilter = s.filter;
          wells.forEach((w) => { w.fil.visible = s.filter; w.rawMat.color.set(s.filter ? FCOL[w.f] : 0xcfd6e6); w.rawMat.emissive.set(s.filter ? FCOL[w.f] : 0x8890a0); });
        }
        t += dt;
        const inCycle = t % CYCLE;
        const collecting = inCycle < COLLECT;
        if (inCycle < dt) wells.forEach((w) => { w.charge = 0; });  // new exposure
        const gain = s.iso / 100;
        const light = 2 ** s.light;

        // spawn photons
        acc += PHOTON_RATE * light * dt;
        let n = Math.floor(acc); acc -= n;
        for (let i = 0; i < NP && n > 0; i++) {
          const p = ph[i]; if (p.on) continue;
          const w = (Math.random() * wells.length) | 0;
          p.on = true; p.w = w; p.c = (Math.random() * 3) | 0; p.filtered = false;
          p.x = wells[w].x + (Math.random() - 0.5) * 0.3; p.z = wells[w].z + (Math.random() - 0.5) * 0.3; p.y = 4.2 + Math.random() * 0.5;
          n--;
        }
        for (let i = 0; i < NP; i++) {
          const p = ph[i];
          if (!p.on) { ppos[i * 3 + 1] = -99; continue; }
          p.y -= 5.5 * dt;
          const w = wells[p.w];
          if (!p.filtered && p.y < FILTER_Y + 0.05) {
            p.filtered = true;
            if (s.filter && p.c !== w.f) { p.on = false; ppos[i * 3 + 1] = -99; continue; }
          }
          const floor = Math.min(CUP, w.charge * CUP);
          if (p.y <= floor) {
            p.on = false; ppos[i * 3 + 1] = -99;
            if (collecting) w.charge = Math.min(1, w.charge + CHARGE);
            continue;
          }
          ppos[i * 3] = p.x; ppos[i * 3 + 1] = p.y; ppos[i * 3 + 2] = p.z;
          const c = RGB[p.c]; pcol[i * 3] = c[0]; pcol[i * 3 + 1] = c[1]; pcol[i * 3 + 2] = c[2];
        }
        pgeo.attributes.position.needsUpdate = true;
        pgeo.attributes.color.needsUpdate = true;

        // amplify + noise
        noiseT += dt;
        const resample = noiseT > 0.12; if (resample) noiseT = 0;
        let sum = 0, sum2 = 0, clipped = 0, photons = 0;
        wells.forEach((w) => {
          if (resample) w.noise = gauss() * READ_NOISE;
          const amp = Math.max(0, (w.charge + w.noise) * gain);
          w.shown += (amp - w.shown) * Math.min(1, dt * 12);
          w.raw.scale.y = Math.max(0.001, w.charge * CUP);
          w.amp.scale.y = Math.max(0.001, Math.min(1, w.shown) * CUP);
          const clip = w.shown >= 1;
          if (clip) clipped++;
          w.ampMat.color.set(clip ? 0xff4d4d : 0xffffff);
          w.ampMat.opacity = clip ? 0.55 : 0.22;
          sum += Math.min(1, amp); sum2 += Math.min(1, amp) ** 2; photons += w.charge / CHARGE;
        });
        const N = wells.length;
        stat.mean = sum / N; stat.sd = Math.sqrt(Math.max(0, sum2 / N - stat.mean ** 2)); stat.clipped = clipped; stat.photons = photons / N;
        phase.element.innerHTML = collecting ? `Exposing… <small>photons pouring in</small>` : `Read-out <small>× ${gain} gain (${fmtISO(s.iso)})</small>`;
      },
      metrics() { return { clipped: stat.clipped, meanSig: stat.mean, sd: stat.sd, photonsPerWell: stat.photons }; },
      readout(s, m) {
        const snr = m.sd > 0.001 ? m.meanSig / m.sd : 99;
        return `
          <div class="row"><span>Photons caught per well</span><b>${m.photonsPerWell.toFixed(1)}</b></div>
          <div class="row"><span>ISO gain</span><b>× ${s.iso / 100}</b></div>
          <div class="row"><span>Pixel brightness after gain</span><b>${Math.round(m.meanSig * 100)}%</b></div>
          <div class="bar"><i style="width:${Math.min(100, m.meanSig * 100)}%"></i></div>
          <div class="row"><span>Pixel-to-pixel variation (noise)</span><b>±${Math.round(m.sd * 100)}%</b></div>
          <div class="bar bad"><i style="width:${Math.min(100, m.sd * 250)}%"></i></div>
          <div class="row"><span>Clipped wells</span><b>${m.clipped} / 40</b></div>
          <div class="row"><span>Signal-to-noise</span><b>${snr > 50 ? 'high' : snr.toFixed(1)}</b></div>
          <div class="row" style="margin-top:6px"><span>Dusk photo exposure</span><b>${fmtStops(m.stops)} stops</b></div>`;
      },
    };
  },
};
