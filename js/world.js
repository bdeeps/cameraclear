// The little outdoor world that the simulated camera photographs.
// Used twice: once inside the photo simulator, and once on the 3D stage
// (so you can see the camera, its field of view and depth of field from outside).
import * as THREE from 'three';

// Scene brightness presets. `ev` is the scene's EV at ISO 100 — the "correct"
// exposure. `gain` only normalises how the render looks when correctly exposed.
export const PRESETS = {
  sunny:  { label: 'Sunny',       ev: 15, skyTop: '#2a67c9', skyBot: '#cfe3f6', fog: '#bcd3ea', sun: [0xfff3df, 3.2], sunPos: [9, 14, 5],    hemi: [0xbfdcff, 0x4b5a3a, 0.9], lamps: 0,   gain: 0.95 },
  cloudy: { label: 'Cloudy',      ev: 12, skyTop: '#7a8593', skyBot: '#d3d8dd', fog: '#c0c6cc', sun: [0xffffff, 0.55], sunPos: [3, 14, 4],   hemi: [0xe8eef5, 0x525a4a, 2.3], lamps: 0,   gain: 1.05 },
  sunset: { label: 'Golden hour', ev: 10, skyTop: '#2b3c77', skyBot: '#ffac5c', fog: '#d99a6c', sun: [0xffa04a, 2.8], sunPos: [-12, 3.2, -9], hemi: [0x9a98c8, 0x4a3828, 1.25], lamps: 0.25, gain: 1.15 },
  dusk:   { label: 'Dusk',        ev: 7,  skyTop: '#131b39', skyBot: '#6a5a86', fog: '#444263', sun: [0x9aa8ff, 0.35], sunPos: [-10, 6, -12], hemi: [0x6a78b0, 0x1a1a22, 0.95], lamps: 1,  gain: 1.5 },
  night:  { label: 'Night',       ev: 4,  skyTop: '#02040b', skyBot: '#0c1634', fog: '#090f22', sun: [0x9bb4ff, 0.22], sunPos: [6, 12, -8],   hemi: [0x33406a, 0x05060a, 0.45], lamps: 2.6, gain: 2.2 },
};

// Where the subjects sit, measured from the camera (camera at z = 0 looking down -z).
export const SUBJECTS = {
  hiker: { name: 'hiker', dist: 2.5 },
  ball: { name: 'ball', dist: 4.5 },
  sign: { name: 'sign', dist: 6 },
  tree: { name: 'autumn tree', dist: 22 },
};

export const CAM_HEIGHT = 1.45;

function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvasTex(w, h, draw, { repeat, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = 8;
  return t;
}

// The bouncing ball: constant horizontal speed (ping-pong), bouncing vertically.
export const BALL_SPEED = 3.2; // m/s horizontally
export function ballPos(t, out) {
  const span = 4.4, P = (2 * span) / BALL_SPEED;
  const ph = (((t % P) + P) % P) / P;
  const x = ph < 0.5 ? -span / 2 + span * ph * 2 : span / 2 - span * (ph - 0.5) * 2;
  const y = 0.22 + Math.abs(Math.sin(t * Math.PI * 1.15)) * 1.1;
  return out.set(x, y, -SUBJECTS.ball.dist);
}

export function makeWorld({ shadowSize = 1024 } = {}) {
  const group = new THREE.Group();
  group.name = 'world';
  const R = rng(7);
  const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });
  const add = (mesh, { cast = true, receive = true, name } = {}) => {
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    if (name) mesh.name = name;
    group.add(mesh); return mesh;
  };

  // ----- ground + path
  const grass = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#4a7534'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = R() < 0.5 ? `rgba(28,58,18,${0.35 * R()})` : `rgba(150,190,90,${0.25 * R()})`;
      g.fillRect(R() * w, R() * h, 1 + R() * 2, 2 + R() * 4);
    }
  }, { repeat: [120, 120] });
  const ground = add(new THREE.Mesh(new THREE.PlaneGeometry(600, 600), std(0xffffff, { map: grass })), { cast: false });
  ground.rotation.x = -Math.PI / 2;

  const tiles = canvasTex(256, 256, (g, w, h) => {
    const cols = ['#cbc3b2', '#8e8577'];
    for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
      g.fillStyle = cols[(x + y) % 2]; g.fillRect(x * 128, y * 128, 128, 128);
      for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(0,0,0,${0.08 * R()})`; g.fillRect(x * 128 + R() * 128, y * 128 + R() * 128, 2, 2); }
    }
    g.strokeStyle = '#4b453c'; g.lineWidth = 4;
    for (let i = 0; i <= 2; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, h); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
  }, { repeat: [2, 116] });
  const path = add(new THREE.Mesh(new THREE.PlaneGeometry(2.4, 140), std(0xffffff, { map: tiles, roughness: 0.9 })), { cast: false });
  path.rotation.x = -Math.PI / 2; path.position.set(0, 0.01, -68);

  // ----- the hiker (near subject, 2.5 m)
  const hiker = new THREE.Group(); hiker.name = 'hiker';
  const red = std(0xd23a2e, { roughness: 0.7 }), navy = std(0x25314a), skin = std(0xe2b089, { roughness: 0.6 });
  const leg = new THREE.CapsuleGeometry(0.085, 0.7, 4, 10);
  [-0.1, 0.1].forEach((x) => { const m = new THREE.Mesh(leg, navy); m.position.set(x, 0.45, 0); hiker.add(m); });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.42, 6, 14), red); torso.position.y = 1.15; hiker.add(torso);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.18), std(0x2f4a36)); pack.position.set(0, 1.2, -0.19); hiker.add(pack);
  const arm = new THREE.CapsuleGeometry(0.062, 0.48, 4, 8);
  [-1, 1].forEach((sgn) => { const m = new THREE.Mesh(arm, red); m.position.set(0.27 * sgn, 1.1, 0.02); m.rotation.z = 0.12 * sgn; hiker.add(m); });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 24, 16), skin); head.position.y = 1.6; hiker.add(head);
  const hat = new THREE.Mesh(new THREE.SphereGeometry(0.125, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), std(0xf2c230)); hat.position.y = 1.63; hiker.add(hat);
  const eyes = std(0x111111);
  [-0.04, 0.04].forEach((x) => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), eyes); e.position.set(x, 1.61, 0.105); hiker.add(e); });
  hiker.position.set(-0.55, 0, -SUBJECTS.hiker.dist); hiker.rotation.y = 0.35;
  hiker.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(hiker);

  // ----- the sign (mid subject, 6 m) — fine text makes sharpness obvious
  const signTex = canvasTex(512, 340, (g, w, h) => {
    g.fillStyle = '#f5c518'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#111'; g.lineWidth = 14; g.strokeRect(12, 12, w - 24, h - 24);
    g.fillStyle = '#111'; g.textAlign = 'center';
    g.font = 'bold 104px Arial, sans-serif'; g.fillText('SHARP?', w / 2, 130);
    g.font = 'bold 30px Arial, sans-serif'; g.fillText('THE QUICK BROWN FOX', w / 2, 196);
    g.font = '22px Arial, sans-serif'; g.fillText('jumps over the lazy dog 0123456789', w / 2, 236);
    g.font = '15px Arial, sans-serif'; g.fillText('if you can read this line, your focus is spot on', w / 2, 272);
    for (let i = 0; i < 16; i++) { g.fillRect(40 + i * 28, 296, 14, 14); }
  });
  const sign = new THREE.Group(); sign.name = 'sign';
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.7, 10), std(0x777b84, { metalness: 0.6, roughness: 0.4 })); post.position.y = 0.85; sign.add(post);
  const boardMats = [std(0x333333), std(0x333333), std(0x333333), std(0x333333), std(0xffffff, { map: signTex, roughness: 0.6 }), std(0x555555)];
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.68, 0.04), boardMats); board.position.set(0, 1.5, 0.03); sign.add(board);
  sign.position.set(0.95, 0, -SUBJECTS.sign.dist); sign.rotation.y = -0.2;
  sign.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(sign);

  // ----- big autumn tree (far subject, 22 m)
  const bigTree = new THREE.Group(); bigTree.name = 'autumn tree';
  const bark = std(0x5b3a24);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 3.2, 10), bark); trunk.position.y = 1.6; bigTree.add(trunk);
  const crownMat = std(0xd8702a, { flatShading: true, roughness: 0.9 });
  [[0, 4.3, 0, 2.3], [1.2, 3.7, 0.4, 1.4], [-1.3, 3.9, -0.2, 1.5], [0.2, 5.4, 0.1, 1.4]].forEach(([x, y, z, r]) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), crownMat); m.position.set(x, y, z); bigTree.add(m);
  });
  bigTree.position.set(-2.8, 0, -SUBJECTS.tree.dist);
  bigTree.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(bigTree);

  // ----- forest (instanced)
  const N = 46;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.2, 1.6, 6), bark, N);
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2.8, 7), std(0xffffff, { flatShading: true }), N);
  const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const side = R() < 0.5 ? -1 : 1;
    const x = side * (3.6 + R() * 16), z = -11 - R() * 62, k = 0.8 + R() * 0.9;
    mtx.compose(p.set(x, 0.8 * k, z), q.identity(), sc.set(k, k, k)); trunks.setMatrixAt(i, mtx);
    mtx.compose(p.set(x, (1.6 + 1.3) * k, z), q, sc.set(k * (0.9 + R() * 0.4), k, k)); crowns.setMatrixAt(i, mtx);
    crowns.setColorAt(i, col.setHSL(0.27 + R() * 0.08, 0.45 + R() * 0.2, 0.2 + R() * 0.12));
  }
  add(trunks); add(crowns);

  // ----- house
  const house = new THREE.Group(); house.name = 'house';
  const walls = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 3), std(0xe9e1d3)); walls.position.y = 1.2; house.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.45, 1.5, 4), std(0xa8412f, { flatShading: true })); roof.position.y = 3.15; roof.rotation.y = Math.PI / 4; house.add(roof);
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.3, 0.05), std(0x4a3222)); door.position.set(-0.6, 0.65, 1.51); house.add(door);
  const winMat = new THREE.MeshStandardMaterial({ color: 0x2b3444, emissive: 0xffb45a, emissiveIntensity: 0, roughness: 0.3 });
  const win = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.05), winMat); win.position.set(0.6, 1.4, 1.51); house.add(win);
  house.position.set(5.6, 0, -13); house.rotation.y = -0.4;
  house.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.add(house);

  // ----- lamp posts along the path
  const LAMPS = [];
  for (let k = 0; k < 12; k++) for (const x of [-1.75, 1.75]) LAMPS.push([x, -3.5 - k * 5]);
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.06, 3, 8), std(0x2a2d33, { metalness: 0.6, roughness: 0.4 }), LAMPS.length);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffc070, emissiveIntensity: 0, roughness: 0.3 });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.15, 14, 10), bulbMat, LAMPS.length);
  LAMPS.forEach(([x, z], i) => {
    mtx.compose(p.set(x, 1.5, z), q.identity(), sc.set(1, 1, 1)); poles.setMatrixAt(i, mtx);
    mtx.compose(p.set(x, 3.05, z), q, sc); bulbs.setMatrixAt(i, mtx);
  });
  add(poles); add(bulbs, { cast: false });
  const lampLights = [];
  LAMPS.slice(0, 4).forEach(([x, z]) => {
    const l = new THREE.PointLight(0xffc27a, 0, 11, 2); l.position.set(x, 2.85, z); group.add(l); lampLights.push(l);
  });

  // ----- mountains far away
  const mountMat = std(0x6b7c96, { flatShading: true });
  [[-140, -190, 55, 46], [-60, -175, 40, 34], [10, -200, 60, 52], [90, -180, 45, 38], [160, -195, 55, 44]].forEach(([x, z, r, h]) => {
    const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), mountMat); m.position.set(x, h / 2 - 2, z); add(m, { cast: false, receive: false });
  });

  // ----- the bouncing ball
  const ballTex = canvasTex(256, 128, (g, w, h) => {
    g.fillStyle = '#ff7a1a'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#ffffff'; for (let i = 0; i < 8; i += 2) g.fillRect((i * w) / 8, 0, w / 8, h);
    g.fillStyle = '#222'; g.fillRect(0, h / 2 - 5, w, 10);
  });
  const ball = add(new THREE.Mesh(new THREE.SphereGeometry(0.22, 32, 20), std(0xffffff, { map: ballTex, roughness: 0.5 })), { name: 'ball' });
  ball.visible = false;

  // ----- lights
  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1); group.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 0.5, far: 90 });
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  sun.target.position.set(0, 0, -9);
  group.add(sun, sun.target);

  // ----- sky + fog (used by whoever renders this world)
  const skyCanvas = document.createElement('canvas'); skyCanvas.width = 4; skyCanvas.height = 256;
  const sky = new THREE.CanvasTexture(skyCanvas); sky.colorSpace = THREE.SRGBColorSpace;
  const fog = new THREE.Fog(0xffffff, 30, 280);

  let current = null;
  function setPreset(name) {
    if (name === current || !PRESETS[name]) return;
    current = name;
    const P = PRESETS[name];
    const g = skyCanvas.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, P.skyTop); grad.addColorStop(0.62, P.skyBot); grad.addColorStop(1, P.skyBot);
    g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
    sky.needsUpdate = true;
    fog.color.set(P.fog);
    sun.color.set(P.sun[0]); sun.intensity = P.sun[1];
    sun.position.set(...P.sunPos).normalize().multiplyScalar(40).add(sun.target.position);
    hemi.color.set(P.hemi[0]); hemi.groundColor.set(P.hemi[1]); hemi.intensity = P.hemi[2];
    bulbMat.emissiveIntensity = P.lamps * 2.5;
    lampLights.forEach((l) => { l.intensity = P.lamps * 7; });
    winMat.emissiveIntensity = P.lamps > 0 ? 0.6 + P.lamps * 0.6 : 0;
  }
  setPreset('cloudy');

  const tmp = new THREE.Vector3();
  function update(t, motion) {
    ball.visible = !!motion;
    if (motion) {
      ballPos(t, tmp); ball.position.copy(tmp);
      ball.rotation.z = -tmp.x / 0.22;
    }
  }

  return { group, sky, fog, setPreset, update, ball, sun, get preset() { return current; } };
}
