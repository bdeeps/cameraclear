// The photo world shown on the 3D stage, with the camera, its field of view
// (frustum) and, optionally, the depth-of-field zone drawn into it.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { makeWorld, CAM_HEIGHT } from './world.js';
import { dof, fov, fmtDist } from './optics.js';
import { Rays } from './kit.js';

export function makeRig(stage, { slab = false, frustumLen = 40 } = {}) {
  const world = makeWorld({ shadowSize: 2048 });
  stage.root.add(world.group);
  stage.scene.background = world.sky;
  stage.scene.fog = world.fog;

  // camera model — a Group whose +Z points at the target (Object3D.lookAt convention)
  const camModel = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(0.34, 0.22, 0.14, 3, 0.03), new THREE.MeshStandardMaterial({ color: 0x1d1f24, roughness: 0.5 }));
  const lensGeo = new THREE.CylinderGeometry(0.065, 0.075, 1, 24); lensGeo.rotateX(Math.PI / 2); lensGeo.translate(0, 0, 0.5);
  const lens = new THREE.Mesh(lensGeo, new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.4, metalness: 0.4 }));
  lens.position.z = 0.07;
  const redRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.008, 8, 24), new THREE.MeshBasicMaterial({ color: 0xc0392b }));
  camModel.add(body, lens, redRing);
  camModel.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  stage.root.add(camModel);

  const legs = new THREE.Group();
  const legMat = new THREE.MeshStandardMaterial({ color: 0x2b2e35, metalness: 0.6, roughness: 0.4 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 1, 8), legMat);
    const foot = new THREE.Vector3(Math.cos(a) * 0.45, 0, Math.sin(a) * 0.45);
    const top = new THREE.Vector3(0, CAM_HEIGHT - 0.12, 0);
    leg.position.copy(foot).add(top).multiplyScalar(0.5);
    leg.scale.y = foot.distanceTo(top);
    leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
    leg.castShadow = true;
    legs.add(leg);
  }
  stage.root.add(legs);

  // frustum: 4 edge lines + far rectangle + translucent faces
  const fLines = new Rays(stage, { width: 3, opacity: 0.95, additive: false });
  fLines.mat.fog = false;
  stage.root.add(fLines.group);
  const fFaces = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  fFaces.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
  fFaces.frustumCulled = false;
  stage.root.add(fFaces);
  let fKey = '';

  // depth-of-field slab: truncated pyramid between near and far limits
  let zone = null, zoneEdges = null, focusPlane = null, lNear = null, lFar = null, lFocus = null;
  if (slab) {
    zone = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
    zone.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(36 * 3), 3));
    zoneEdges = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.8 }));
    zoneEdges.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    focusPlane = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
    focusPlane.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
    [zone, zoneEdges, focusPlane].forEach((o) => { o.frustumCulled = false; stage.root.add(o); });
    lNear = stage.label('', null, stage.root, 'good');
    lFar = stage.label('', null, stage.root, 'good');
    lFocus = stage.label('', null, stage.root, 'accent');
  }

  const tmpCam = new THREE.PerspectiveCamera();
  const v = new THREE.Vector3();
  const corners = (d, hw, hh) => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => v.set(sx * hw * d, sy * hh * d, -d).applyMatrix4(tmpCam.matrixWorld).clone());
  const put = (arr, i, p) => { arr[i * 3] = p.x; arr[i * 3 + 1] = p.y; arr[i * 3 + 2] = p.z; };

  function update(s, t) {
    world.setPreset(s.scene);
    world.update(t, s.motion);
    const cz = s.camZ || 0;
    tmpCam.position.set(0, CAM_HEIGHT, cz);
    tmpCam.lookAt(0, 1.0, cz - 10);
    tmpCam.updateMatrixWorld();

    camModel.position.set(0, CAM_HEIGHT, cz);
    camModel.lookAt(0, 1.0, cz - 10);
    const lensLen = 0.05 + s.focal / 400 * 0.5;
    lens.scale.z = lensLen;
    redRing.position.z = 0.07 + lensLen * 0.85;
    legs.visible = !!s.tripod;
    legs.position.set(0, 0, cz);

    const F = fov(s);
    const hw = Math.tan((F.h * Math.PI) / 360), hh = Math.tan((F.v * Math.PI) / 360);
    const apex = tmpCam.position;
    const far = corners(frustumLen, hw, hh);
    const key = `${s.focal}|${s.sensor}|${cz}`;
    if (key !== fKey) {
      fKey = key;
      const lp = [], lc = [], amber = [1, 0.71, 0.28];
      const seg = (a, b) => { lp.push(a.x, a.y, a.z, b.x, b.y, b.z); lc.push(...amber, ...amber); };
      for (let i = 0; i < 4; i++) { seg(apex, far[i]); seg(far[i], far[(i + 1) % 4]); }
      fLines.set(lp, lc);
    }
    const fp = fFaces.geometry.attributes.position.array;
    for (let i = 0; i < 4; i++) { put(fp, i * 3, apex); put(fp, i * 3 + 1, far[i]); put(fp, i * 3 + 2, far[(i + 1) % 4]); }
    fFaces.geometry.attributes.position.needsUpdate = true;

    if (slab) {
      const d = dof(s);
      const n = Math.max(0.3, d.near), f = Math.min(isFinite(d.far) ? d.far : 400, 400);
      const A = corners(n, hw, hh), B = corners(f, hw, hh);
      const za = zone.geometry.attributes.position.array;
      const quad = (idx, p0, p1, p2, p3) => { [p0, p1, p2, p0, p2, p3].forEach((p, k) => put(za, idx * 6 + k, p)); };
      quad(0, A[0], A[1], A[2], A[3]); quad(1, B[0], B[1], B[2], B[3]);
      for (let i = 0; i < 4; i++) quad(2 + i, A[i], A[(i + 1) % 4], B[(i + 1) % 4], B[i]);
      zone.geometry.attributes.position.needsUpdate = true;
      const ea = zoneEdges.geometry.attributes.position.array;
      for (let i = 0; i < 4; i++) { put(ea, i * 2, A[i]); put(ea, i * 2 + 1, A[(i + 1) % 4]); put(ea, 8 + i * 2, B[i]); put(ea, 8 + i * 2 + 1, B[(i + 1) % 4]); put(ea, 16 + i * 2, A[i]); put(ea, 16 + i * 2 + 1, B[i]); }
      zoneEdges.geometry.attributes.position.needsUpdate = true;
      const fd = Math.min(s.focus, 400);
      const C = corners(fd, hw, hh), pa = focusPlane.geometry.attributes.position.array;
      [C[0], C[1], C[2], C[0], C[2], C[3]].forEach((p, k) => put(pa, k, p));
      focusPlane.geometry.attributes.position.needsUpdate = true;
      const top = (P) => P[2].clone().lerp(P[3], 0.5);
      lNear.position.copy(A[0]); lNear.element.innerHTML = `Near limit ${fmtDist(d.near)}`;
      lFar.position.copy(B[2]); lFar.element.innerHTML = `Far limit ${isFinite(d.far) ? fmtDist(d.far) : '∞'}`;
      lFar.visible = !!(isFinite(d.far) && d.far < 120);
      lFocus.position.copy(top(C)); lFocus.element.innerHTML = `Focus ${fmtDist(s.focus)}`;
    }
  }

  return { world, update };
}
