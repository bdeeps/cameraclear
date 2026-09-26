import * as THREE from 'three';
import { M } from '../kit.js';
import { APERTURES, SHUTTERS, ISOS, fmtF, fmtShutter, fmtISO, fmtStops, fmtDist, shutterNorm } from '../optics.js';
import { PRESETS } from '../world.js';

const TARGET = 0.6;   // bucket fill fraction = perfect exposure

export default {
  id: 'exposure',
  title: 'The Exposure Triangle',
  subtitle: 'Fill the bucket. Choose your side effects.',
  view: { pos: [6.2, 4.4, 8.2], target: [-0.3, 2.1, 0] },
  learn: `
    <p><dfn data-t="exposure">Exposure</dfn> is filling a bucket with light. The <b>tap width</b> is the aperture, <b>how long it runs</b> is the shutter speed, and the <b>bucket size</b> is ISO — higher ISO means a smaller bucket, filled by less light.</p>
    <p>Many combinations fill the bucket exactly to the line. f/4 at 1/250 lets in the same light as f/5.6 at 1/125: one stop narrower, one stop longer. Those are equal <dfn data-t="ev">EV</dfn>s.</p>
    <p class="tip"><b>So why choose?</b> Because of the side effects. Aperture → depth of field. Shutter → motion blur. ISO → noise. That's the <dfn data-t="exposure-triangle">exposure triangle</dfn>. Use the <dfn data-t="metering">meter</dfn> and <dfn data-t="histogram">histogram</dfn> on the camera screen to judge brightness.</p>`,
  terms: ['exposure', 'exposure-triangle', 'ev', 'metering', 'histogram', 'overexposure', 'underexposure', 'sunny16', 'zebras'],
  photo: true,
  defaults: { scene: 'cloudy', aperture: 5.6, shutter: 1 / 60, iso: 100, motion: true, tripod: true, focus: 4.5, focal: 50 },
  modeLabel: () => 'M',
  controls: [
    { key: 'scene', type: 'seg', label: 'Light in the scene', options: Object.entries(PRESETS).map(([v, p]) => ({ v, label: p.label })), fmt: (v) => 'EV ' + PRESETS[v].ev, term: 'ev' },
    { key: 'aperture', type: 'stops', label: 'Aperture — tap width', values: APERTURES, fmt: fmtF, term: 'aperture', ends: ['wide', 'narrow'] },
    { key: 'shutter', type: 'stops', label: 'Shutter — how long it runs', values: SHUTTERS, fmt: fmtShutter, term: 'shutter-speed', ends: ['long', 'short'] },
    { key: 'iso', type: 'stops', label: 'ISO — bucket size', values: ISOS, fmt: fmtISO, term: 'iso', ends: ['big bucket', 'tiny bucket'] },
  ],
  missions: [
    { id: 'sunny16', text: 'Sunny 16: in Sunny light at ISO 100 and f/16, find the shutter speed for a perfect exposure. Shoot.', xp: 70, when: 'shot', check: ({ s, m }) => s.scene === 'sunny' && s.iso === 100 && Math.abs(s.aperture - 16) < 0.1 && Math.abs(m.stops) <= 0.4 },
    { id: 'duskfreeze', text: 'At Dusk, freeze the ball (1/500 or faster) AND expose correctly. Shoot.', xp: 80, when: 'shot', check: ({ s, m }) => s.scene === 'dusk' && s.shutter <= 1 / 499 && Math.abs(m.stops) <= 0.5 },
    { id: 'nightclean', text: 'At Night, get a correct exposure at ISO 400 or lower (the tripod helps). Shoot.', xp: 80, when: 'shot', check: ({ s, m }) => s.scene === 'night' && s.iso <= 400 && Math.abs(m.stops) <= 0.5 },
    { id: 'over', text: 'Blow it out: overexpose by 2 stops or more and turn on Zebras.', xp: 40, check: ({ s, m }) => m.stops >= 1.8 && s.zebra },
  ],
  quiz: [
    { q: 'Which pair gives the SAME exposure as f/4 at 1/250?', options: ['f/5.6 at 1/125', 'f/5.6 at 1/500', 'f/2.8 at 1/125', 'f/8 at 1/250'], answer: 0, why: 'f/5.6 is one stop less light; 1/125 is one stop more. They cancel out.' },
    { q: 'Your photo is 1 stop too dark. Which fixes it?', options: ['ISO 400 → 200', 'f/8 → f/11', '1/250 → 1/125', '1/60 → 1/125'], answer: 2, why: 'Doubling the shutter time doubles the light: one stop brighter.' },
    { q: 'The side effect of a fast shutter speed is…', options: ['More noise, unless you compensate', 'A blurry background', 'Motion blur', 'A wider view'], answer: 0, why: 'Less time means less light; to compensate you open the aperture (shallower DOF) or raise ISO (more noise).' },
  ],

  build({ stage }) {
    const g = new THREE.Group(); stage.root.add(g);
    const metal = M.metal(0x9aa0aa, { roughness: 0.25, metalness: 1 });

    // faucet
    const wall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, 1.6), M.matte(0x2a2f3a)); wall.position.set(-2.6, 4.6, 0); g.add(wall);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 2.5, 24), metal); pipe.rotation.z = Math.PI / 2; pipe.position.set(-1.25, 4.6, 0); g.add(pipe);
    const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 16), metal); elbow.position.set(0, 4.6, 0); g.add(elbow);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 0.5, 24), metal); spout.position.set(0, 4.3, 0); g.add(spout);
    const valve = new THREE.Group(); valve.position.set(-1.0, 4.85, 0); g.add(valve);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.3, 12), metal); valve.add(stem);
    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.08, 0.14), M.matte(0xd23a2e, { roughness: 0.4 })); handle.position.y = 0.17; valve.add(handle);
    [pipe, elbow, spout, handle, wall].forEach((m) => { m.castShadow = true; });

    // water stream
    const streamGeo = new THREE.CylinderGeometry(1, 1, 1, 24, 1, true); streamGeo.translate(0, -0.5, 0);
    const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x69c1ff, transparent: true, opacity: 0.72, roughness: 0.1, emissive: 0x0b3a66, emissiveIntensity: 0.6 });
    const stream = new THREE.Mesh(streamGeo, waterMat); stream.position.set(0, 4.05, 0); g.add(stream);

    // bucket (rebuilt on ISO change)
    const bucket = new THREE.Group(); g.add(bucket);
    const bucketMat = new THREE.MeshPhysicalMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.22, roughness: 0.1, side: THREE.DoubleSide, depthWrite: false });
    const water = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48), waterMat); water.geometry.translate(0, 0.5, 0); bucket.add(water);
    let bucketBody = null, rim = null, bottom = null, line = null, lineLbl = null;
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshPhysicalMaterial({ color: 0x69c1ff, transparent: true, opacity: 0.6, roughness: 0.05 }));
    puddle.rotation.x = -Math.PI / 2; puddle.position.y = 0.01; puddle.scale.setScalar(0.001); g.add(puddle);

    let R = 1.3, Hb = 2.4;
    const buildBucket = (iso) => {
      const k = 2 ** (-Math.log2(iso / 100) * 0.1);
      R = 1.3 * k; Hb = 2.4 * k;
      [bucketBody, rim, bottom, line].forEach((m) => { if (m) { bucket.remove(m); m.geometry.dispose(); } });
      bucketBody = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.86, Hb, 48, 1, true), bucketMat); bucketBody.position.y = Hb / 2;
      rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.04, 10, 64), metal); rim.rotation.x = Math.PI / 2; rim.position.y = Hb;
      bottom = new THREE.Mesh(new THREE.CircleGeometry(R * 0.86, 48), M.metal(0x3a4050)); bottom.rotation.x = -Math.PI / 2; bottom.position.y = 0.01;
      line = new THREE.Mesh(new THREE.TorusGeometry(R * (0.86 + 0.14 * TARGET) + 0.01, 0.025, 8, 64), M.glow(0x4ade80)); line.rotation.x = Math.PI / 2; line.position.y = Hb * TARGET;
      bucket.add(bucketBody, rim, bottom, line);
      if (lineLbl) lineLbl.position.set(R + 0.2, Hb * TARGET, 0);
    };
    lineLbl = stage.label('Perfect exposure', [0, 0, 0], bucket, 'good');

    const lA = stage.label('', [-1.0, 5.45, 0], g, 'accent');
    const lS = stage.label('', [0.9, 3.4, 0], g, 'accent');
    const lI = stage.label('', [2.3, 0.7, 0], g, 'accent');

    // spill particles
    const NP = 240, sp = new Float32Array(NP * 3);
    const drops = Array.from({ length: NP }, () => ({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0 }));
    const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    const spills = new THREE.Points(sgeo, new THREE.PointsMaterial({ color: 0x8fd0ff, size: 0.07, transparent: true, opacity: 0.9, depthWrite: false }));
    spills.frustumCulled = false; g.add(spills);

    let cyc = 0, lastIso = null, lastKey = '', level = 0;
    return {
      update(dt, s, time) {
        if (s.iso !== lastIso) { lastIso = s.iso; buildBucket(s.iso); }
        const stops = Math.max(-8, Math.min(8, (() => {
          const ev = PRESETS[s.scene].ev; const evs = Math.log2(s.aperture ** 2 / s.shutter) - Math.log2(s.iso / 100); return ev - evs;
        })()));
        const final = TARGET * 2 ** stops;
        const D = 0.35 + shutterNorm(s.shutter) * 3.0;   // visual fill time
        const hold = 1.4, drain = 0.6, total = D + hold + drain;
        cyc = (cyc + dt) % total;
        let flowing = false;
        if (cyc < D) { level = final * (cyc / D); flowing = true; }
        else if (cyc < D + hold) level = final;
        else level = final * (1 - (cyc - D - hold) / drain);
        const shown = Math.min(1, level);
        const overflow = flowing && level > 1;
        water.scale.set(R * (0.86 + 0.14 * shown) * 0.97, Math.max(0.001, shown * Hb), R * (0.86 + 0.14 * shown) * 0.97);
        water.visible = shown > 0.002;
        const rad = 0.05 + 0.26 * (1.4 / s.aperture);
        stream.visible = flowing;
        stream.scale.set(rad, 4.05 - shown * Hb, rad);
        handle.rotation.y = (1.4 / s.aperture) * Math.PI * 0.9;
        waterMat.emissiveIntensity = 0.4 + 0.3 * Math.sin(time * 6);

        // spill
        let spawn = overflow ? Math.ceil(dt * 160 * Math.min(4, level)) : 0;
        for (let i = 0; i < NP; i++) {
          const d = drops[i];
          if (!d.on && spawn > 0) {
            const a = Math.random() * Math.PI * 2;
            Object.assign(d, { on: true, x: Math.cos(a) * R, y: Hb, z: Math.sin(a) * R, vx: Math.cos(a) * 0.8, vy: 0.3, vz: Math.sin(a) * 0.8 });
            spawn--;
          }
          if (d.on) {
            d.vy -= 9.8 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
            if (d.y < 0) d.on = false;
          }
          sp[i * 3] = d.x; sp[i * 3 + 1] = d.on ? d.y : -99; sp[i * 3 + 2] = d.z;
        }
        sgeo.attributes.position.needsUpdate = true;
        const pud = overflow ? Math.min(3.2, puddle.scale.x + dt * 0.8) : Math.max(0.001, puddle.scale.x - dt * 0.6);
        puddle.scale.setScalar(pud);

        const key = `${s.aperture}|${s.shutter}|${s.iso}`;
        if (key !== lastKey) {
          lastKey = key;
          lA.element.innerHTML = `APERTURE ${fmtF(s.aperture)}<small>how wide the tap opens</small>`;
          lS.element.innerHTML = `SHUTTER ${fmtShutter(s.shutter)}<small>how long it flows</small>`;
          lI.element.innerHTML = `${fmtISO(s.iso)}<small>smaller bucket = more sensitive</small>`;
        }
      },
      readout(s, m) {
        const st = m.stops;
        const cls = Math.abs(st) <= 0.4 ? 'good' : Math.abs(st) <= 1.2 ? 'mid' : 'bad';
        const msg = Math.abs(st) <= 0.4 ? 'Perfect exposure ✓' : st > 0 ? `Too bright by ${st.toFixed(1)} stops — overexposed` : `Too dark by ${(-st).toFixed(1)} stops — underexposed`;
        const pct = (x) => Math.max(2, Math.min(100, x));
        return `
          <div class="row"><span>Scene brightness</span><b>EV ${m.ev}</b></div>
          <div class="row"><span>Your settings</span><b>EV ${m.evSettings.toFixed(1)}</b></div>
          <div class="row"><span>Exposure</span><b>${fmtStops(st)} stops</b></div>
          <div class="status ${cls}">${msg}</div>
          <div style="margin-top:12px;font-weight:600;font-size:12px;color:var(--muted)">SIDE EFFECTS</div>
          <div class="row"><span>Depth of field (aperture)</span><b>${isFinite(m.dofTotal) ? fmtDist(m.dofTotal) : 'deep → ∞'}</b></div>
          <div class="bar cyan"><i style="width:${pct(isFinite(m.dofTotal) ? m.dofTotal * 12 : 100)}%"></i></div>
          <div class="row"><span>Motion blur (shutter)</span><b>${m.motionPx.toFixed(1)} px</b></div>
          <div class="bar ${m.motionPx < 1.5 ? 'good' : 'bad'}"><i style="width:${pct(m.motionPx * 2)}%"></i></div>
          <div class="row"><span>Noise (ISO)</span><b>${m.noise < 0.02 ? 'clean' : m.noise < 0.06 ? 'some' : 'heavy'}</b></div>
          <div class="bar ${m.noise < 0.02 ? 'good' : 'bad'}"><i style="width:${pct(m.noise * 550)}%"></i></div>`;
      },
    };
  },
};
