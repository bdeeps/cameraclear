// Camera maths: exposure, depth of field, field of view, blur — plus formatting.
import { PRESETS, SUBJECTS, BALL_SPEED } from './world.js';

export const APERTURES = [1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22];
export const SHUTTERS = [30, 15, 8, 4, 2, 1, 1 / 2, 1 / 4, 1 / 8, 1 / 15, 1 / 30, 1 / 60, 1 / 125, 1 / 250, 1 / 500, 1 / 1000, 1 / 2000, 1 / 4000, 1 / 8000];
export const ISOS = [100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600];
export const INF = 1000; // "infinity" focus, in metres
export const PHOTO_W = 600;

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function nearestIndex(values, v) {
  let best = 0, bd = Infinity;
  values.forEach((x, i) => { const d = Math.abs(Math.log(x) - Math.log(v)); if (d < bd) { bd = d; best = i; } });
  return best;
}

// ---------- formatting
export const fmtF = (N) => 'f/' + (N >= 10 ? Math.round(N) : String(Math.round(N * 10) / 10));
export function fmtShutter(t) {
  if (t >= 0.95) return (Math.round(t * 10) / 10) + '″';
  const r = 1 / t;
  const std = [2, 3, 4, 5, 6, 8, 10, 13, 15, 20, 25, 30, 40, 50, 60, 80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000];
  let best = std[0];
  for (const x of std) if (Math.abs(Math.log(x / r)) < Math.abs(Math.log(best / r))) best = x;
  return '1/' + best;
}
export const fmtISO = (i) => 'ISO ' + (i >= 1000 ? Math.round(i / 100) * 100 : Math.round(i / 10) * 10);
export const fmtMM = (f) => Math.round(f) + ' mm';
export function fmtDist(m) {
  if (!isFinite(m) || m >= 500) return '∞';
  if (m < 1) return Math.round(m * 100) + ' cm';
  return (m < 10 ? m.toFixed(2) : m.toFixed(1)) + ' m';
}
export const fmtStops = (x) => (x > 0.05 ? '+' : x < -0.05 ? '−' : '±') + Math.abs(x).toFixed(1);

// ---------- exposure
export const preset = (s) => PRESETS[s.scene] || PRESETS.cloudy;
export const sceneEV = (s) => preset(s).ev;
// EV of the chosen settings, referenced to ISO 100
export const evSettings = (s) => Math.log2((s.aperture * s.aperture) / s.shutter) - Math.log2(s.iso / 100);
// + means too bright (overexposed), − means too dark
export const exposureStops = (s) => sceneEV(s) - evSettings(s);
export const autoShutter = (s) => clamp((s.aperture * s.aperture) / (2 ** sceneEV(s) * s.iso / 100), 1 / 8000, 30);
export const autoISO = (s) => clamp((100 * s.aperture * s.aperture) / (s.shutter * 2 ** sceneEV(s)), 100, 25600);
export const noiseFor = (iso) => 0.006 * Math.pow(iso / 100, 0.62);

// maps 1/8000 … 30 s onto 0 … 1 (log scale) — used by the slow-motion visuals
export const shutterNorm = (t) => clamp((Math.log2(t) + 12.966) / (Math.log2(30) + 12.966), 0, 1);

// ---------- geometry
export const sensorW = (s) => s.sensor || 36;
export const cocMM = (s) => 0.03 * (sensorW(s) / 36);

export function dof(s) {
  const f = s.focal, N = s.aperture, c = cocMM(s), S = Math.max(s.focus * 1000, f * 1.01);
  const H = (f * f) / (N * c) + f;
  const near = (S * (H - f)) / (H + S - 2 * f);
  const far = S < H ? (S * (H - f)) / (H - S) : Infinity;
  const nearM = near / 1000, farM = far / 1000;
  return { near: nearM, far: farM > 500 ? Infinity : farM, total: farM > 500 ? Infinity : farM - nearM, hyperfocal: H / 1000 };
}

export function fov(s) {
  const w = sensorW(s), h = w / 1.5;
  const d = (x) => (2 * Math.atan(x / (2 * s.focal)) * 180) / Math.PI;
  return { h: d(w), v: d(h), diag: d(Math.hypot(w, h)) };
}

// Blur circle (diameter, in photo pixels) for something at `dist` metres
export function cocPx(s, dist) {
  const f = s.focal, z = dist * 1000, S = s.focus * 1000;
  const c = (f / s.aperture) * (Math.abs(z - S) / z) * (f / Math.max(S - f, 1));
  return (c / sensorW(s)) * PHOTO_W;
}

export const shakeAngle = (s) => (s.tripod ? 0 : 0.02 * Math.pow(s.shutter, 0.6));

export function metrics(s) {
  const stops = exposureStops(s);
  const d = dof(s);
  const w = sensorW(s);
  const cz = s.camZ || 0;
  const ballD = SUBJECTS.ball.dist + cz;
  const motionPx = s.motion ? ((BALL_SPEED * 1.15 * s.shutter * s.focal) / ballD / w) * PHOTO_W : 0;
  const shakePx = ((shakeAngle(s) * s.focal) / w) * PHOTO_W;
  const F = fov(s);
  return {
    stops, ev: sceneEV(s), evSettings: evSettings(s),
    near: d.near, far: d.far, dofTotal: d.total, hyperfocal: d.hyperfocal,
    motionPx, shakePx, noise: noiseFor(s.iso),
    fovH: F.h, fovV: F.v,
    hikerBlur: cocPx(s, SUBJECTS.hiker.dist + cz),
    signBlur: cocPx(s, SUBJECTS.sign.dist + cz),
    treeBlur: cocPx(s, SUBJECTS.tree.dist + cz),
    distHiker: SUBJECTS.hiker.dist + cz, distSign: SUBJECTS.sign.dist + cz, distTree: SUBJECTS.tree.dist + cz,
  };
}
