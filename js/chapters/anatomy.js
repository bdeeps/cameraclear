import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { M, makeLens, makeIris, canvasTexture } from '../kit.js';

const PARTS = {
  elements: { name: 'Lens elements', term: 'lens-elements', text: 'Several pieces of curved glass that bend light to form a sharp image on the sensor. Using many elements cancels out colour fringing and distortion.' },
  aperture: { name: 'Aperture (iris)', term: 'aperture', text: 'Metal blades inside the lens that open and close to let more or less light through. Chapter 4 is all about it.' },
  barrel: { name: 'Lens barrel, focus & zoom rings', term: 'focus', text: 'The tube holding the glass. Turning the focus ring slides elements back and forth to focus; the zoom ring changes the focal length.' },
  mount: { name: 'Lens mount', term: 'mount', text: 'The bayonet ring that locks the lens on at exactly the right distance from the sensor, and passes signals for autofocus and aperture.' },
  shutter: { name: 'Shutter', term: 'shutter', text: 'Two curtains just in front of the sensor. They open and close to control how long light hits the sensor.' },
  sensor: { name: 'Image sensor', term: 'sensor', text: 'The heart of the camera: millions of light-collecting photosites that record the picture. Full-frame sensors are 36 × 24 mm.' },
  lcd: { name: 'Rear screen (LCD)', term: 'lcd', text: 'Shows live view, menus and your photos. In live view it previews exposure, focus and depth of field.' },
  viewfinder: { name: 'Viewfinder', term: 'viewfinder', text: 'The eyepiece you look through to frame. Mirrorless cameras put a tiny screen here; DSLRs use a mirror and prism.' },
  button: { name: 'Shutter button', term: 'shutter-button', text: 'Half-press to focus and meter, full press to take the picture.' },
  dial: { name: 'Mode dial', term: 'mode-dial', text: 'Chooses who controls exposure: Auto, P, A/Av (you pick aperture), S/Tv (you pick shutter speed) or M (you pick everything).' },
  body: { name: 'Camera body', term: 'body', text: 'The light-tight box that holds the sensor, shutter, battery, processor and controls — and keeps every bit of stray light out.' },
};

export default {
  id: 'anatomy',
  title: 'Anatomy of a Camera',
  subtitle: 'Take one apart. Click every piece.',
  view: { pos: [7.5, 4.6, 8.5], target: [0, 2.2, 0.6] },
  learn: `
    <p>A modern camera is a <dfn data-t="body">light-tight body</dfn> with a <dfn data-t="lens">lens</dfn> on the front and a <dfn data-t="sensor">sensor</dfn> at the back. Everything in between exists to control <b>how much</b> light reaches the sensor, <b>for how long</b>, and <b>how sharply</b>.</p>
    <p>Light's journey: <b>lens elements</b> bend it → the <b>aperture</b> limits how much gets through → the <b>shutter</b> opens for a moment → the <b>sensor</b> records it.</p>
    <p class="tip"><b>Try it:</b> drag the <i>Explode</i> slider to pull the camera apart, then click each part to learn what it does.</p>`,
  terms: ['body', 'lens-elements', 'aperture', 'shutter', 'sensor', 'mount', 'viewfinder', 'mode-dial'],
  photo: false,
  defaults: { explode: 0, xray: false, spin: false },
  controls: [
    { key: 'explode', type: 'range', label: 'Explode the camera', min: 0, max: 1, step: 0.01, fmt: (v) => Math.round(v * 100) + '%', ends: ['assembled', 'exploded'] },
    { key: 'xray', type: 'toggle', label: 'X-ray the body' },
    { key: 'spin', type: 'toggle', label: 'Turntable spin' },
  ],
  missions: [
    { id: 'explode', text: 'Explode the camera fully.', xp: 30, check: ({ s }) => s.explode >= 0.9 },
    { id: 'sensor', text: 'Find and click the sensor.', xp: 35, when: 'event', check: ({ event }) => event === 'part:sensor' },
    { id: 'aperture', text: 'Find the aperture blades.', xp: 35, when: 'event', check: ({ event }) => event === 'part:aperture' },
    { id: 'shutter', text: 'Find the shutter.', xp: 35, when: 'event', check: ({ event }) => event === 'part:shutter' },
    { id: 'elements', text: 'Click a piece of lens glass.', xp: 35, when: 'event', check: ({ event }) => event === 'part:elements' },
    { id: 'dial', text: 'Find the dial that picks the shooting mode.', xp: 35, when: 'event', check: ({ event }) => event === 'part:dial' },
  ],
  quiz: [
    { q: 'In what order does light pass through the camera?', options: ['Sensor → shutter → lens', 'Lens → aperture → shutter → sensor', 'Shutter → lens → sensor', 'Aperture → sensor → lens'], answer: 1, why: 'Glass focuses it, the aperture limits it, the shutter times it, and the sensor records it.' },
    { q: 'What is the lens mount for?', options: ['Holding the strap', 'Attaching interchangeable lenses at the exact right distance from the sensor', 'Storing photos', 'Changing ISO'], answer: 1, why: 'The mount fixes the lens-to-sensor distance precisely and carries autofocus/aperture signals.' },
    { q: 'On the mode dial, "A" (or "Av") means…', options: ['Automatic everything', 'You choose the aperture, the camera picks the shutter speed', 'You choose the shutter speed', 'Audio recording'], answer: 1, why: 'Aperture priority: you control depth of field, the camera balances exposure with shutter speed.' },
  ],

  build({ stage, emit }) {
    const cam = new THREE.Group(); cam.position.y = 2.2; stage.root.add(cam);
    const parts = {};                    // id -> array of meshes
    const lbls = [];
    const reg = (id, mesh) => {
      mesh.userData.part = id;
      mesh.traverse((o) => { if (o.isMesh) { o.userData.part = id; o.castShadow = true; o.receiveShadow = true; } });
      (parts[id] ||= []).push(mesh);
      stage.pickables.push(mesh);
      return mesh;
    };
    const mk = (geo, mat, pos, id, parent = cam) => { const m = new THREE.Mesh(geo, mat); m.position.set(...pos); parent.add(m); reg(id, m); return m; };

    // body group (fades when exploded)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f2126, roughness: 0.55, metalness: 0.25, transparent: true });
    const gripMat = new THREE.MeshStandardMaterial({ color: 0x121316, roughness: 0.95, transparent: true });
    mk(new RoundedBoxGeometry(3.4, 2.2, 1.2, 5, 0.18), bodyMat, [0, 0, 0], 'body');
    mk(new RoundedBoxGeometry(0.8, 2.0, 0.55, 4, 0.22), gripMat, [-1.25, -0.05, 0.72], 'body');

    const top = new THREE.Group(); cam.add(top);
    const vfMat = bodyMat.clone(); vfMat.transparent = false;
    mk(new RoundedBoxGeometry(1.1, 0.7, 1.0, 4, 0.12), vfMat, [0, 1.3, -0.05], 'viewfinder', top);
    mk(new RoundedBoxGeometry(0.7, 0.5, 0.22, 4, 0.08), M.matte(0x0b0b0d), [0, 1.3, -0.62], 'viewfinder', top);
    const vfGlass = mk(new THREE.PlaneGeometry(0.4, 0.28), M.glow(0x223355), [0, 1.3, -0.735], 'viewfinder', top); vfGlass.rotation.y = Math.PI;
    mk(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 32), M.matte(0xc0392b, { roughness: 0.4 }), [-1.25, 1.16, 0.55], 'button', top);
    const dial = mk(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 40), M.metal(0x4a4e57, { roughness: 0.5 }), [0.95, 1.19, 0.05], 'dial', top);
    const dialTex = canvasTexture(256, 256, (g) => {
      g.fillStyle = '#2b2e35'; g.fillRect(0, 0, 256, 256);
      g.fillStyle = '#fff'; g.font = 'bold 34px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      ['M', 'S', 'A', 'P', 'AUTO'].forEach((t, i) => { const a = -Math.PI / 2 + (i - 2) * 0.55; g.fillText(t, 128 + 88 * Math.cos(a), 128 + 88 * Math.sin(a)); });
    });
    const dialTop = mk(new THREE.CircleGeometry(0.33, 40), new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.5 }), [0, 0.091, 0], 'dial', dial);
    dialTop.rotation.x = -Math.PI / 2;

    // LCD
    const lcdTex = canvasTexture(512, 320, (g) => {
      const sky = g.createLinearGradient(0, 0, 0, 320); sky.addColorStop(0, '#3a79d6'); sky.addColorStop(0.6, '#bfe0ff'); g.fillStyle = sky; g.fillRect(0, 0, 512, 320);
      g.fillStyle = '#ffd35a'; g.beginPath(); g.arc(400, 80, 34, 0, 7); g.fill();
      g.fillStyle = '#3c7a3a'; g.beginPath(); g.moveTo(0, 240); g.quadraticCurveTo(160, 150, 300, 230); g.quadraticCurveTo(420, 180, 512, 220); g.lineTo(512, 320); g.lineTo(0, 320); g.fill();
      g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 282, 512, 38);
      g.fillStyle = '#fff'; g.font = 'bold 22px monospace'; g.fillText('f/4   1/250   ISO 100   50mm', 20, 309);
      g.strokeStyle = '#5f5'; g.lineWidth = 3; g.strokeRect(226, 130, 60, 60);
    });
    const lcd = mk(new THREE.PlaneGeometry(2.3, 1.45), new THREE.MeshStandardMaterial({ map: lcdTex, emissive: 0xffffff, emissiveMap: lcdTex, emissiveIntensity: 0.9, roughness: 0.2 }), [-0.25, -0.05, -0.606], 'lcd');
    lcd.rotation.y = Math.PI;

    // Interior: shutter + sensor
    const sensorGroup = new THREE.Group(); cam.add(sensorGroup);
    const sensorMat = new THREE.MeshPhysicalMaterial({ color: 0x3a4a60, metalness: 0.9, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.9, iridescenceThicknessRange: [200, 900], emissive: 0x0a1020 });
    mk(new THREE.PlaneGeometry(1.3, 0.87), sensorMat, [0, 0, 0.03], 'sensor', sensorGroup);
    mk(new THREE.BoxGeometry(1.9, 1.35, 0.05), M.matte(0x1f5a3a, { roughness: 0.6 }), [0, 0, 0], 'sensor', sensorGroup);
    const goldMat = M.metal(0xd9a93a, { roughness: 0.3 });
    for (let i = 0; i < 10; i++) { mk(new THREE.BoxGeometry(0.08, 0.04, 0.02), goldMat, [-0.72 + i * 0.16, -0.62, 0.03], 'sensor', sensorGroup); }
    const shutterGroup = new THREE.Group(); cam.add(shutterGroup);
    const slatMat = M.metal(0x15161a, { roughness: 0.5 });
    for (let i = 0; i < 4; i++) mk(new THREE.BoxGeometry(1.5, 0.26, 0.015), slatMat, [0, 0.33 - i * 0.22, 0.01 * i], 'shutter', shutterGroup);
    mk(new THREE.BoxGeometry(1.7, 0.08, 0.06), M.metal(0x555a64), [0, 0.52, 0], 'shutter', shutterGroup);
    mk(new THREE.BoxGeometry(1.7, 0.08, 0.06), M.metal(0x555a64), [0, -0.52, 0], 'shutter', shutterGroup);

    // Lens mount + barrel
    const mount = mk(new THREE.TorusGeometry(1.0, 0.07, 16, 64), M.metal(0xc9ced8, { roughness: 0.2, metalness: 1 }), [0, 0, 0.62], 'mount');
    const barrel = new THREE.Group(); cam.add(barrel);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x16171b, roughness: 0.5, metalness: 0.3, side: THREE.DoubleSide, transparent: true });
    const ringTex = canvasTexture(64, 256, (g) => { g.fillStyle = '#1b1c20'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#0c0c0e'; for (let y = 0; y < 256; y += 8) g.fillRect(0, y, 64, 4); });
    ringTex.wrapS = ringTex.wrapT = THREE.RepeatWrapping; ringTex.repeat.set(1, 1); ringTex.rotation = Math.PI / 2;
    const ringMat = new THREE.MeshStandardMaterial({ map: ringTex, roughness: 0.9, transparent: true, side: THREE.DoubleSide });
    const cyl = (r, len, mat, z) => { const geo = new THREE.CylinderGeometry(r, r, len, 64, 1, true); geo.rotateX(Math.PI / 2); return mk(geo, mat, [0, 0, z], 'barrel', barrel); };
    cyl(0.98, 2.0, barrelMat, 1.0);
    cyl(1.03, 0.55, ringMat, 1.55);
    cyl(1.02, 0.4, ringMat, 0.55);
    mk(new THREE.TorusGeometry(1.0, 0.05, 12, 64), M.metal(0x222429), [0, 0, 2.0], 'barrel', barrel);
    mk(new THREE.TorusGeometry(1.0, 0.025, 8, 64), M.matte(0xc0392b), [0, 0, 1.87], 'barrel', barrel);
    barrel.position.z = 0.62;

    // Glass elements + iris (inside barrel)
    const e0 = makeLens(0.86, 0.45, 'z'); e0.position.z = 2.45; cam.add(e0); reg('elements', e0);
    const e1 = makeLens(0.78, 0.3, 'z'); e1.position.z = 1.8; cam.add(e1); reg('elements', e1);
    const e2 = makeLens(0.72, 0.26, 'z'); e2.position.z = 1.05; cam.add(e2); reg('elements', e2);
    const iris = makeIris({ R: 0.9 }); iris.set(0.34, 7); iris.group.position.z = 1.4; cam.add(iris.group); reg('aperture', iris.group);
    const irisRing = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.04, 10, 48), M.metal(0x44474f)); iris.group.add(irisRing); reg('aperture', irisRing);

    // labels (follow their parts)
    const L = (id, obj, pos, cls = '') => { const l = stage.label(PARTS[id].name, pos, obj, cls); l.element.classList.add('hide'); lbls.push(l); return l; };
    L('elements', e0, [0, 1.05, 0]);
    L('aperture', iris.group, [0, -1.15, 0], 'accent');
    L('mount', mount, [1.25, 0.4, 0]);
    L('shutter', shutterGroup, [0, -0.85, 0]);
    L('sensor', sensorGroup, [0, 0.9, 0], 'cyan');
    L('lcd', lcd, [0, -0.95, 0]);
    L('viewfinder', top, [0, 1.85, -0.3]);

    const base = {
      e0: 2.45, e1: 1.8, e2: 1.05, iris: 1.4, barrel: 0.62, mount: 0.62, shutter: -0.1, sensor: -0.3, lcd: -0.606,
    };
    let selected = null;
    const allMats = new Set();
    Object.values(parts).flat().forEach((m) => m.traverse((o) => { if (o.isMesh) allMats.add(o.material); }));

    const highlight = (id) => {
      allMats.forEach((mt) => { if (mt.emissive && mt.userData.baseEmissive === undefined) mt.userData.baseEmissive = mt.emissive.getHex(); });
      allMats.forEach((mt) => { if (mt.emissive) mt.emissive.setHex(mt.userData.baseEmissive); });
      if (!id) return;
      (parts[id] || []).forEach((m) => m.traverse((o) => { if (o.isMesh && o.material.emissive) o.material.emissive.setHex(0x6b4200); }));
    };
    // parts share some materials; give each part its own copies so highlighting is precise
    Object.entries(parts).forEach(([id, meshes]) => meshes.forEach((m) => m.traverse((o) => {
      if (o.isMesh && id !== 'elements' && id !== 'aperture') { o.material = o.material.clone(); allMats.add(o.material); }
    })));

    return {
      pick(obj) {
        let o = obj; while (o && !o.userData.part) o = o.parent;
        if (!o) return;
        selected = o.userData.part;
        highlight(selected);
        emit('part:' + selected);
      },
      update(dt, s) {
        const e = s.explode;
        const t = 0.5 - 0.5 * Math.cos(Math.PI * e);
        e0.position.z = base.e0 + 2.7 * t;
        e1.position.z = base.e1 + 1.95 * t;
        iris.group.position.z = base.iris + 1.35 * t;
        e2.position.z = base.e2 + 0.95 * t;
        barrel.position.z = base.barrel + 1.6 * t;
        mount.position.z = base.mount + 0.55 * t;
        shutterGroup.position.z = base.shutter - 1.1 * t;
        sensorGroup.position.z = base.sensor - 2.0 * t;
        lcd.position.z = base.lcd - 2.9 * t;
        top.position.y = 1.0 * t;
        const bodyOp = s.xray ? 0.12 : 1 - 0.82 * t;
        parts.body.forEach((m) => { m.material.opacity = bodyOp; m.material.depthWrite = bodyOp > 0.95; });
        parts.barrel.forEach((m) => { m.material.opacity = s.xray ? 0.15 : 1 - 0.75 * t; m.material.depthWrite = m.material.opacity > 0.95; });
        lbls.forEach((l) => l.element.classList.toggle('hide', t < 0.3 && !s.xray));
        if (s.spin) cam.rotation.y += dt * 0.35;
      },
      readout() {
        if (!selected) return '<div class="part-card"><p>Click any part of the camera in the 3D view to see what it does.</p></div>';
        const p = PARTS[selected];
        return `<div class="part-card"><h4>${p.name}</h4><p>${p.text}</p><p style="margin-top:8px"><span class="t-link" data-t="${p.term}">Glossary: ${p.name} →</span></p></div>`;
      },
    };
  },
};
