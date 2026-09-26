// Reusable 3D building blocks: materials, lenses, iris diaphragms, light rays.
import * as THREE from 'three';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

export const M = {
  glass: (o = {}) => new THREE.MeshPhysicalMaterial({
    color: 0xe6f6ff, metalness: 0, roughness: 0.03, transmission: 1, thickness: 0.5, ior: 1.5,
    clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3, transparent: true, ...o,
  }),
  metal: (color = 0x2a2d34, o = {}) => new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.35, ...o }),
  matte: (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...o }),
  glow: (color, o = {}) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...o }),
  ghost: (color, opacity = 0.2, o = {}) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, ...o }),
};

// Biconvex lens. axis: 'x' (light travels along x) or 'z'.
export function makeLens(R = 1, t = 0.4, axis = 'x', mat = M.glass()) {
  const pts = [], N = 28, e = 0.03;
  for (let i = 0; i <= N; i++) { const r = (R * i) / N; pts.push(new THREE.Vector2(r, e + (t / 2) * (1 - (r / R) ** 2))); }
  for (let i = N; i >= 0; i--) { const r = (R * i) / N; pts.push(new THREE.Vector2(r, -e - (t / 2) * (1 - (r / R) ** 2))); }
  const g = new THREE.LatheGeometry(pts, 64);
  if (axis === 'x') g.rotateZ(-Math.PI / 2); else g.rotateX(Math.PI / 2);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  return m;
}

// Iris diaphragm made of overlapping blades, lying in the XY plane (faces +Z).
// set(r, n) rebuilds it with opening radius r and n blades; returns the rotation offset.
export function makeIris({ R = 1.5, color = 0x1a1b20 } = {}) {
  const group = new THREE.Group();
  const matA = new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: 0.38, side: THREE.DoubleSide });
  const matB = matA.clone(); matB.color.set(0x2a2c33);
  let meshes = [], offset = 0;
  function set(r, n) {
    meshes.forEach((m) => { group.remove(m); m.geometry.dispose(); });
    meshes = [];
    r = Math.max(0.015, Math.min(r, R * 0.985));
    offset = (1 - r / R) * 0.9;
    for (let i = 0; i < n; i++) {
      const a0 = offset + (i * 2 * Math.PI) / n, a1 = offset + ((i + 1) * 2 * Math.PI) / n;
      const V0 = new THREE.Vector2(r * Math.cos(a0), r * Math.sin(a0));
      const V1 = new THREE.Vector2(r * Math.cos(a1), r * Math.sin(a1));
      const d = V1.clone().sub(V0).normalize();
      const b = V0.dot(d), c = V0.lengthSq() - R * R;
      const E = V0.clone().addScaledVector(d, -b + Math.sqrt(b * b - c));
      let aE = Math.atan2(E.y, E.x);
      while (aE < a0) aE += Math.PI * 2;
      while (aE - a0 > Math.PI * 2) aE -= Math.PI * 2;
      const shape = new THREE.Shape();
      shape.moveTo(V0.x, V0.y); shape.lineTo(E.x, E.y);
      const steps = 20;
      for (let k = 1; k <= steps; k++) { const a = aE + ((a0 - aE) * k) / steps; shape.lineTo(R * Math.cos(a), R * Math.sin(a)); }
      shape.closePath();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shape, 1), i % 2 ? matA : matB);
      m.position.z = i * 0.006;
      m.castShadow = true;
      group.add(m); meshes.push(m);
    }
    return offset;
  }
  // is point (lx, ly) in the blade plane inside the polygonal opening?
  function inside(lx, ly, r, n) {
    const step = (2 * Math.PI) / n;
    let rel = Math.atan2(ly, lx) - offset;
    rel = ((rel % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const mid = offset + (Math.floor(rel / step) + 0.5) * step;
    return lx * Math.cos(mid) + ly * Math.sin(mid) < r * Math.cos(Math.PI / n);
  }
  return { group, set, inside, R, materials: [matA, matB] };
}

// A bundle of thick, glowing light rays (screen-space width).
export class Rays {
  constructor(stage, { width = 2.4, opacity = 0.9, additive = true } = {}) {
    this.mat = stage.lineMaterial({
      linewidth: width, vertexColors: true, transparent: true, opacity, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false,
    });
    this.group = new THREE.Group();
    this.obj = null;
  }
  // pos: flat [x1,y1,z1,x2,y2,z2,...]; col: flat [r,g,b, r,g,b, ...] per vertex
  set(pos, col) {
    if (this.obj) { this.group.remove(this.obj); this.obj.geometry.dispose(); this.obj = null; }
    if (!pos.length) return;
    const g = new LineSegmentsGeometry();
    g.setPositions(pos); g.setColors(col);
    this.obj = new LineSegments2(g, this.mat);
    this.group.add(this.obj);
  }
}

let glowTex = null;
export function glowSprite(color = 0xffd27a, size = 1, opacity = 1) {
  if (!glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.25, 'rgba(255,255,255,.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  s.scale.setScalar(size);
  // the shared glow texture must survive stage.clear()
  s.material.map = glowTex; s.material.userData.shared = true;
  return s;
}

export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function pushSeg(pos, col, a, b, ca, cb = ca) {
  pos.push(a.x, a.y, a.z, b.x, b.y, b.z);
  col.push(ca[0], ca[1], ca[2], cb[0], cb[1], cb[2]);
}

// Thin dashed axis line
export function axisLine(from, to, color = 0x5d6579) {
  const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...from), new THREE.Vector3(...to)]);
  const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color, dashSize: 0.15, gapSize: 0.1, transparent: true, opacity: 0.8 }));
  l.computeLineDistances();
  return l;
}
