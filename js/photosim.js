// A small physically-inspired camera: renders the world through a lens with
// real depth of field, motion blur (sub-frame accumulation), camera shake,
// exposure and ISO noise. Output goes to the "camera screen" canvas.
import * as THREE from 'three';
import { makeWorld, CAM_HEIGHT } from './world.js';
import { metrics, preset, sensorW, shakeAngle, clamp, INF, PHOTO_W } from './optics.js';

const VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const POST_FS = /* glsl */`
uniform sampler2D tColor; uniform sampler2D tDepth;
uniform vec2 res; uniform float cnear; uniform float cfar;
uniform float focusMM; uniform float focalMM; uniform float fnum; uniform float sensorW;
uniform float expMul; uniform float noiseAmt; uniform float time; uniform float zebra; uniform float maxBlur;
varying vec2 vUv;

float viewDist(vec2 uv){
  float d = texture2D(tDepth, uv).x;
  return -(cnear * cfar) / ((cfar - cnear) * d - cfar);
}
float cocPx(float dist){
  float z = dist * 1000.0; float f = focalMM;
  float c = (f / fnum) * abs(z - focusMM) / z * f / max(focusMM - f, 1.0);
  return min(0.5 * c / sensorW * res.x, maxBlur);
}
vec3 aces(vec3 x){ return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

void main(){
  // --- depth of field: scatter-as-gather bokeh (after Gustafsson)
  float cd = viewDist(vUv); float cs = cocPx(cd);
  vec3 col = texture2D(tColor, vUv).rgb; float tot = 1.0;
  float radius = 1.0; float ang = 0.0;
  for (int i = 0; i < 220; i++) {
    if (radius >= maxBlur) break;
    vec2 tc = vUv + vec2(cos(ang), sin(ang)) * radius / res;
    vec3 sc = texture2D(tColor, tc).rgb;
    float sd = viewDist(tc); float ss = cocPx(sd);
    if (sd > cd) ss = clamp(ss, 0.0, cs * 2.0);
    float m = smoothstep(radius - 0.5, radius + 0.5, ss);
    col += mix(col / tot, sc, m); tot += 1.0;
    ang += 2.39996323; radius += 1.0 / radius;
  }
  col /= tot;

  // --- exposure, lens vignette, tone curve
  col *= expMul;
  vec2 q = vUv - 0.5; col *= 1.0 - dot(q, q) * 0.45;
  vec3 c = pow(aces(col), vec3(1.0 / 2.2));

  // --- sensor noise (luminance + colour), strongest in the shadows
  vec2 px = floor(vUv * res); float t = floor(time * 24.0);
  float n1 = hash(px + t * 17.0) + hash(px * 1.37 + t * 31.0) - 1.0;
  vec3 nc = vec3(hash(px + t * 3.1), hash(px + t * 5.3 + 7.0), hash(px + t * 7.7 + 13.0)) - 0.5;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c += noiseAmt * (1.3 - 0.8 * lum) * (n1 * 0.8 + nc * 0.9);
  c = clamp(c, 0.0, 1.0);

  // --- zebra stripes over blown highlights
  if (zebra > 0.5 && lum > 0.965) {
    float st = step(0.5, fract((gl_FragCoord.x + gl_FragCoord.y + time * 30.0) / 9.0));
    c = mix(c, vec3(1.0, 0.25, 0.25) * st, 0.8);
  }
  gl_FragColor = vec4(c, 1.0);
}`;

export class PhotoSim {
  constructor(canvas) {
    this.W = PHOTO_W; this.H = PHOTO_W / 1.5;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' }));
    r.setPixelRatio(1);
    r.setSize(this.W, this.H, false);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.shadowMap.autoUpdate = false;

    this.scene = new THREE.Scene();
    this.world = makeWorld({ shadowSize: 1024 });
    this.scene.add(this.world.group);
    this.scene.background = this.world.sky;
    this.scene.fog = this.world.fog;

    this.cam = new THREE.PerspectiveCamera(27, 1.5, 0.1, 600);
    const opts = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.rtSub = new THREE.WebGLRenderTarget(this.W, this.H, { ...opts, depthTexture: new THREE.DepthTexture(this.W, this.H) });
    this.rtAcc = new THREE.WebGLRenderTarget(this.W, this.H, opts);

    this.accMat = new THREE.ShaderMaterial({
      uniforms: { t: { value: null }, w: { value: 1 } },
      vertexShader: VS,
      fragmentShader: 'uniform sampler2D t; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * w, 1.0); }',
      blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false,
    });
    this.postMat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: null }, tDepth: { value: null }, res: { value: new THREE.Vector2(this.W, this.H) },
        cnear: { value: 0.1 }, cfar: { value: 600 }, focusMM: { value: 2500 }, focalMM: { value: 50 }, fnum: { value: 4 },
        sensorW: { value: 36 }, expMul: { value: 1 }, noiseAmt: { value: 0 }, time: { value: 0 }, zebra: { value: 0 }, maxBlur: { value: 18 },
      },
      vertexShader: VS, fragmentShader: POST_FS, depthTest: false, depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMat);
    this.quad.frustumCulled = false;
    this.quadScene = new THREE.Scene();
    this.quadScene.add(this.quad);
    this.quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.ray = new THREE.Raycaster();
    this.histCanvas = document.createElement('canvas');
    this.histCanvas.width = 120; this.histCanvas.height = 80;
    this.histCtx = this.histCanvas.getContext('2d', { willReadFrequently: true });
    this._q = new THREE.Quaternion(); this._e = new THREE.Euler();
  }

  placeCamera(s) {
    const sh = sensorW(s) / 1.5;
    this.cam.fov = THREE.MathUtils.radToDeg(2 * Math.atan(sh / (2 * s.focal)));
    this.cam.aspect = 1.5;
    this.cam.updateProjectionMatrix();
    const cz = s.camZ || 0;
    this.cam.position.set(0, CAM_HEIGHT, cz);
    this.cam.lookAt(0, 1.0, cz - 10);
    this.cam.updateMatrixWorld();
  }

  render(s, time) {
    const r = this.renderer;
    this.world.setPreset(s.scene);
    this.placeCamera(s);
    const m = metrics(s);
    const blurPx = Math.max(m.motionPx, m.shakePx);
    const K = blurPx > 1 ? clamp(Math.ceil(blurPx / 2) + 1, 2, 14) : 1;
    let colorTex;

    if (K === 1) {
      this.world.update(time, s.motion);
      r.shadowMap.needsUpdate = true;
      r.setRenderTarget(this.rtSub);
      r.render(this.scene, this.cam);
      colorTex = this.rtSub.texture;
    } else {
      r.setRenderTarget(this.rtAcc);
      r.setClearColor(0x000000, 0); r.clear();
      const baseQ = this.cam.quaternion.clone();
      const span = Math.min(s.shutter, 4);
      const amp = shakeAngle(s);
      const seed = Math.floor(time * 2) * 1.618;
      this.accMat.uniforms.w.value = 1 / K;
      for (let k = 0; k < K; k++) {
        const u = k / (K - 1);
        this.world.update(time + (u - 0.5) * span, s.motion);
        if (amp > 0) {
          const yaw = amp * (Math.sin(u * 5.1 + seed) * 0.6 + Math.sin(u * 11.3 + seed * 2.1) * 0.4);
          const pitch = amp * (Math.cos(u * 4.3 + seed * 1.3) * 0.6 + Math.sin(u * 9.7 + seed * 0.7) * 0.4);
          this._e.set(pitch, yaw, 0);
          this.cam.quaternion.copy(baseQ).multiply(this._q.setFromEuler(this._e));
          this.cam.updateMatrixWorld();
        }
        r.shadowMap.needsUpdate = s.motion || k === 0;
        r.setRenderTarget(this.rtSub);
        r.render(this.scene, this.cam);
        this.accMat.uniforms.t.value = this.rtSub.texture;
        this.quad.material = this.accMat;
        r.setRenderTarget(this.rtAcc);
        r.render(this.quadScene, this.quadCam);
      }
      this.cam.quaternion.copy(baseQ);
      this.cam.updateMatrixWorld();
      colorTex = this.rtAcc.texture;
    }

    const u = this.postMat.uniforms;
    u.tColor.value = colorTex;
    u.tDepth.value = this.rtSub.depthTexture;
    u.cnear.value = this.cam.near; u.cfar.value = this.cam.far;
    u.focusMM.value = Math.min(s.focus, INF) * 1000;
    u.focalMM.value = s.focal; u.fnum.value = s.aperture; u.sensorW.value = sensorW(s);
    u.expMul.value = 2 ** clamp(m.stops, -9, 9) * preset(s).gain;
    u.noiseAmt.value = m.noise;
    u.time.value = time;
    u.zebra.value = s.zebra ? 1 : 0;
    this.quad.material = this.postMat;
    r.setRenderTarget(null);
    r.render(this.quadScene, this.quadCam);
    return m;
  }

  // Call right after render(): the drawing buffer is still valid in the same task.
  histogram() {
    const g = this.histCtx;
    g.drawImage(this.renderer.domElement, 0, 0, 120, 80);
    const d = g.getImageData(0, 0, 120, 80).data;
    const bins = new Array(48).fill(0);
    let hi = 0, lo = 0;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      bins[Math.min(47, (l / 256) * 48) | 0]++;
      if (l > 250) hi++; if (l < 5) lo++;
    }
    const n = d.length / 4;
    return { bins, hi: hi / n, lo: lo / n };
  }

  snapshot() { return this.renderer.domElement.toDataURL('image/jpeg', 0.9); }

  // Tap-to-focus: returns distance along the view axis to whatever is under (u, v).
  pick(s, u, v) {
    this.placeCamera(s);
    this.ray.setFromCamera(new THREE.Vector2(u * 2 - 1, -(v * 2 - 1)), this.cam);
    const hits = this.ray.intersectObjects(this.world.group.children, true).filter((h) => h.object.visible);
    if (!hits.length) return { dist: INF, name: 'the sky' };
    const h = hits[0];
    const fwd = new THREE.Vector3(); this.cam.getWorldDirection(fwd);
    const dist = h.point.clone().sub(this.cam.position).dot(fwd);
    let o = h.object, name = '';
    while (o && !name) { name = o.name; o = o.parent; }
    return { dist: clamp(dist, 0.3, INF), name: name === 'world' ? '' : name };
  }
}
