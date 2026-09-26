import * as THREE from 'three';
import { M, Rays, makeLens, pushSeg, canvasTexture } from '../kit.js';

const SCREEN_X = 4;          // back wall of the box
const PX = 512 / 3;          // canvas pixels per world unit on the 3 × 3 screen
const LENS_HOLE = 0.5;

// Draws the flower in object coordinates (z to the right, y up).
function drawFlower(g) {
  g.fillStyle = '#3b6fd8'; g.beginPath(); g.moveTo(-0.35, -0.6); g.lineTo(0.35, -0.6); g.lineTo(0.28, -1.2); g.lineTo(-0.28, -1.2); g.fill();
  g.fillStyle = '#3ea34a'; g.fillRect(-0.05, -0.6, 0.1, 1.3);
  g.beginPath(); g.ellipse(0.25, -0.1, 0.22, 0.09, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ff4d6d';
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; g.beginPath(); g.arc(0.22 * Math.cos(a), 0.95 + 0.22 * Math.sin(a), 0.13, 0, Math.PI * 2); g.fill(); }
  g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, 0.95, 0.15, 0, Math.PI * 2); g.fill();
}

export default {
  id: 'obscura',
  title: 'How a Camera Sees',
  subtitle: 'A dark box, a hole, and an upside-down world.',
  view: { pos: [-4.2, 4.2, 9.5], target: [0.2, 1.6, 0] },
  learn: `
    <p>Every camera is a <b>dark box</b>. Light from each point of the flower travels in straight <dfn data-t="light-ray">light rays</dfn>. A tiny <dfn data-t="pinhole">pinhole</dfn> lets through only a thin bundle from each point, so they paint a picture on the back wall — the <dfn data-t="sensor">sensor</dfn>.</p>
    <p>Follow the coloured rays: light from the <b style="color:#ff6b86">top</b> of the flower goes <i>down</i> through the hole, and light from the <b style="color:#5ab4ff">bottom</b> goes <i>up</i>. That's why the image is <dfn data-t="inverted-image">upside-down</dfn>.</p>
    <p class="tip"><b>The big trade-off:</b> a bigger hole lets in more light (brighter) but each point becomes a bigger blob (blurrier). A <dfn data-t="lens">lens</dfn> solves this — it bends all the rays from one point back to one point.</p>`,
  terms: ['camera-obscura', 'light-ray', 'pinhole', 'inverted-image', 'lens', 'sensor'],
  photo: false,
  defaults: { pin: 0.14, dist: 5.5, lens: false },
  controls: [
    { key: 'pin', type: 'range', label: 'Hole size', min: 0.03, max: 0.6, step: 0.01, term: 'pinhole', fmt: (v, s) => (s.lens ? 'lens fitted' : (v * 20).toFixed(1) + ' mm'), ends: ['tiny', 'huge'], disabled: (s) => s.lens },
    { key: 'dist', type: 'range', label: 'Flower distance', min: 3, max: 9, step: 0.1, fmt: (v) => v.toFixed(1) + ' m', ends: ['close', 'far'] },
    { key: 'lens', type: 'toggle', label: 'Put a lens in the hole', term: 'lens' },
  ],
  missions: [
    { id: 'tiny', text: 'Shrink the hole to the minimum. Sharp — but how bright?', xp: 40, check: ({ s }) => s.pin <= 0.04 && !s.lens },
    { id: 'wide', text: 'Open the hole wide. Brighter… but blurrier.', xp: 40, check: ({ s }) => s.pin >= 0.45 && !s.lens },
    { id: 'near', text: 'Bring the flower close (under 3.6 m). Watch the image grow.', xp: 40, check: ({ s }) => s.dist <= 3.6 },
    { id: 'lens', text: 'Fit a lens: get an image that\'s bright AND sharp.', xp: 50, check: ({ s }) => s.lens },
    { id: 'orbit', text: 'Drag the 3D view to look inside the box.', xp: 30, when: 'event', check: ({ event }) => event === 'orbit' },
  ],
  quiz: [
    { q: 'Why is the image inside a camera upside-down?', options: ['The sensor is mounted upside-down', 'Light travels in straight lines, so rays from the top cross through the hole to the bottom', 'The lens mirrors the picture', 'Because of gravity'], answer: 1, why: 'Rays from the top of the subject travel downward through the opening and land low on the sensor — and vice versa. The camera flips it back for you.' },
    { q: 'You make a pinhole bigger. What happens?', options: ['Darker and sharper', 'Brighter and blurrier', 'Brighter and sharper', 'Nothing changes'], answer: 1, why: 'More light gets in, but each point of the scene now makes a bigger blob on the sensor.' },
    { q: 'What does a lens add that a pinhole can\'t?', options: ['Colour', 'A wide opening that is still sharp', 'An upside-down image', 'A shutter'], answer: 1, why: 'A lens bends every ray from one point back to one point, so you can use a big, bright opening without blur.' },
  ],

  build({ stage }) {
    const g = new THREE.Group();
    g.position.y = 1.8;
    stage.root.add(g);

    // --- the dark box (cut away on the near side)
    const wallMat = M.matte(0x171a21, { side: THREE.DoubleSide });
    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), wallMat); bottom.rotation.x = Math.PI / 2; bottom.position.set(2, -1.5, 0);
    const far = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), wallMat); far.position.set(2, 0, -1.5);
    [bottom, far].forEach((m) => { m.receiveShadow = true; m.castShadow = true; g.add(m); });
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(4, 3, 3)), new THREE.LineBasicMaterial({ color: 0x4a5670, transparent: true, opacity: 0.8 }));
    edges.position.set(2, 0, 0); g.add(edges);
    const legMat = M.metal(0x2a2e37);
    [[0.3, -1.3], [3.7, -1.3], [0.3, 1.3], [3.7, 1.3]].forEach(([x, z]) => { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.3), legMat); l.position.set(x, -1.65, z); g.add(l); });

    // front wall with a round hole (rebuilt when the hole changes)
    const frontMat = M.metal(0x20242d, { roughness: 0.6, side: THREE.DoubleSide });
    let front = null;
    const buildFront = (r) => {
      if (front) { g.remove(front); front.geometry.dispose(); }
      const sh = new THREE.Shape(); sh.moveTo(-1.5, -1.5); sh.lineTo(1.5, -1.5); sh.lineTo(1.5, 1.5); sh.lineTo(-1.5, 1.5); sh.closePath();
      const hole = new THREE.Path(); hole.absarc(0, 0, r, 0, Math.PI * 2, true); sh.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: false, curveSegments: 48 });
      geo.rotateY(Math.PI / 2);
      front = new THREE.Mesh(geo, frontMat); front.position.x = -0.04; front.castShadow = true;
      g.add(front);
    };

    // back screen with the projected image
    const cvs = document.createElement('canvas'); cvs.width = cvs.height = 512;
    const ctx2 = cvs.getContext('2d');
    const screenTex = new THREE.CanvasTexture(cvs); screenTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
    screen.rotation.y = -Math.PI / 2; screen.position.x = SCREEN_X - 0.01; g.add(screen);

    // lens (only visible when fitted)
    const lens = makeLens(LENS_HOLE * 0.98, 0.32, 'x'); lens.visible = false; g.add(lens);

    // --- the flower
    const flower = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 32), M.matte(0x3b6fd8)); pot.position.y = -0.9;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 12), M.matte(0x3ea34a)); stem.position.y = 0.05;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), M.matte(0x3ea34a)); leaf.scale.set(0.04, 0.09, 0.22); leaf.position.set(0, -0.1, 0.25);
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.15, 20, 14), M.matte(0xffd23f, { emissive: 0x332200 })); center.position.y = 0.95;
    flower.add(pot, stem, leaf, center);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), M.matte(0xff4d6d, { emissive: 0x330010 }));
      p.position.set(0, 0.95 + 0.22 * Math.sin(a), 0.22 * Math.cos(a)); flower.add(p);
    }
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.6, 32), M.metal(0x2a2e37)); stand.position.y = -1.5; flower.add(stand);
    flower.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.add(flower);

    const rays = new Rays(stage, { width: 2.2, opacity: 0.85 });
    g.add(rays.group);

    // labels
    const lFlower = stage.label('The flower<small>light bounces off it in every direction</small>', [0, 1.75, 0], flower);
    stage.label('Hole', [0, -0.75, 1.1], g, 'accent');
    stage.label('Back wall = <b>sensor</b>', [SCREEN_X, 1.85, 0], g, 'cyan');
    const lImg = stage.label('Upside-down image!', [SCREEN_X, -1.85, 0], g, 'accent');
    void lFlower; void lImg;

    const PTS = [
      { y: 1.1, c: [1.0, 0.35, 0.5] },
      { y: 0.1, c: [0.4, 1.0, 0.5] },
      { y: -0.9, c: [0.35, 0.7, 1.0] },
    ];

    let last = '';
    const rebuild = (s) => {
      const hole = s.lens ? LENS_HOLE : s.pin;
      buildFront(hole);
      lens.visible = s.lens;
      flower.position.x = -s.dist;

      // rays
      const pos = [], col = [];
      const P = new THREE.Vector3(), H = new THREE.Vector3(), E = new THREE.Vector3();
      const n = 10;
      PTS.forEach(({ y, c }) => {
        P.set(-s.dist, y, 0);
        const dim = [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55];
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2;
          const rr = hole * (s.lens ? 0.9 : 0.95);
          H.set(0, rr * Math.cos(a), rr * Math.sin(a));
          if (s.lens) {
            E.set(SCREEN_X, (-y * SCREEN_X) / s.dist, 0); // all rays meet at the image point
          } else {
            E.copy(H).sub(P).multiplyScalar(SCREEN_X / s.dist).add(H);
          }
          pushSeg(pos, col, P, H, dim, c);
          pushSeg(pos, col, H, E, c, c);
        }
      });
      rays.set(pos, col);

      // projected image on the back wall
      const m = SCREEN_X / s.dist;
      const spot = s.lens ? 0.01 : hole * (1 + SCREEN_X / s.dist);
      const bright = s.lens ? 1 : Math.min(1, 0.14 + 0.86 * Math.pow(hole / 0.42, 1.6));
      ctx2.setTransform(1, 0, 0, 1, 0, 0);
      ctx2.filter = 'none';
      ctx2.fillStyle = '#0c0d10'; ctx2.fillRect(0, 0, 512, 512);
      ctx2.save();
      ctx2.filter = `blur(${Math.max(0.3, spot * PX * 0.5).toFixed(1)}px)`;
      ctx2.globalAlpha = Math.max(0.06, bright);
      ctx2.translate(256, 256);
      ctx2.scale(-m * PX, m * PX);
      drawFlower(ctx2);
      ctx2.restore();
      ctx2.filter = 'none';
      screenTex.needsUpdate = true;
    };

    return {
      update(dt, s) {
        const key = `${s.pin}|${s.dist}|${s.lens}`;
        if (key !== last) { last = key; rebuild(s); }
      },
      metrics(s) {
        const hole = s.lens ? LENS_HOLE : s.pin;
        const spot = s.lens ? 0.01 : hole * (1 + SCREEN_X / s.dist);
        return {
          brightness: s.lens ? 1 : Math.min(1, 0.14 + 0.86 * Math.pow(hole / 0.42, 1.6)),
          sharpness: Math.max(0, Math.min(1, 1 - spot / 0.9)),
          size: SCREEN_X / s.dist,
        };
      },
      readout(s, m) {
        const pct = (x) => Math.round(x * 100);
        return `
          <div class="row"><span>Image brightness</span><b>${pct(m.brightness)}%</b></div>
          <div class="bar"><i style="width:${pct(m.brightness)}%"></i></div>
          <div class="row"><span>Image sharpness</span><b>${pct(m.sharpness)}%</b></div>
          <div class="bar cyan"><i style="width:${pct(m.sharpness)}%"></i></div>
          <div class="row"><span>Image size (magnification)</span><b>×${m.size.toFixed(2)}</b></div>
          <div class="status ${s.lens ? 'good' : m.sharpness > 0.8 && m.brightness < 0.25 ? 'mid' : m.brightness > 0.8 ? 'mid' : 'mid'}">${
            s.lens ? 'With a lens: bright and sharp. This is a camera!' :
            m.brightness < 0.2 ? 'Sharp-ish, but very dim — you\'d need a long exposure.' :
            m.sharpness < 0.4 ? 'Bright, but every point has become a big blur.' : 'A compromise: some light, some blur.'}</div>`;
      },
    };
  },
};
