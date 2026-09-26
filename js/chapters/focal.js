import { makeRig } from '../rig.js';
import { fmtMM, fmtDist, autoShutter } from '../optics.js';

export default {
  id: 'focal',
  title: 'Focal Length & Field of View',
  subtitle: 'Wide-angle to telephoto: how much of the world fits.',
  world: true,
  view: { pos: [7.5, 7.5, 9.5], target: [0, 1, -6] },
  learn: `
    <p><dfn data-t="focal-length">Focal length</dfn> (in mm) is how strongly a lens magnifies. Short focal lengths squeeze a wide slice of the world onto the sensor; long ones magnify a narrow slice. The orange pyramid in the 3D view is the camera's <dfn data-t="field-of-view">field of view</dfn>.</p>
    <p>Roughly: 14–35 mm is <dfn data-t="wide-angle">wide-angle</dfn>, around 50 mm is "normal" (similar to your eye's central view), 85 mm and beyond is <dfn data-t="telephoto">telephoto</dfn>.</p>
    <p class="tip"><b>Sensor size matters too.</b> A smaller APS-C sensor sees only the middle of the image — a <dfn data-t="crop-factor">crop factor</dfn> of 1.5×. And try walking backwards while zooming in: the background seems to crowd in behind the hiker — <dfn data-t="compression">telephoto compression</dfn>.</p>`,
  terms: ['focal-length', 'field-of-view', 'wide-angle', 'telephoto', 'crop-factor', 'compression'],
  photo: true,
  defaults: { focal: 50, sensor: 36, camZ: 0, aperture: 8, scene: 'sunny', iso: 100, focus: 6 },
  onChange(s, key) {
    if (key === 'camZ' || key === null) s.focus = 6 + s.camZ;
    s.shutter = autoShutter(s);
  },
  modeLabel: () => 'Av',
  controls: [
    { key: 'focal', type: 'log', label: 'Focal length (zoom)', min: 14, max: 400, term: 'focal-length', fmt: fmtMM, ends: ['14 mm wide', '400 mm tele'] },
    { key: 'sensor', type: 'seg', label: 'Sensor size', options: [{ v: 36, label: 'Full frame 36 mm' }, { v: 23.6, label: 'APS-C 23.6 mm' }], term: 'crop-factor' },
    { key: 'camZ', type: 'range', label: 'Walk backwards', min: 0, max: 12, step: 0.1, fmt: (v) => v.toFixed(1) + ' m', term: 'compression' },
  ],
  missions: [
    { id: 'wide', text: 'Go ultra-wide (20 mm or less) and take a photo.', xp: 50, when: 'shot', check: ({ s }) => s.focal <= 20.5 },
    { id: 'tele', text: 'Zoom to 200 mm or more and take a photo.', xp: 50, when: 'shot', check: ({ s }) => s.focal >= 199 },
    { id: 'crop', text: 'Switch to the APS-C sensor. Notice the tighter view?', xp: 30, check: ({ s }) => +s.sensor < 30 },
    { id: 'compress', text: 'Walk back 8 m or more, zoom to 135 mm+ and shoot. The tree looms behind the hiker.', xp: 60, when: 'shot', check: ({ s }) => s.camZ >= 8 && s.focal >= 134 },
  ],
  quiz: [
    { q: 'Which focal length gives the WIDEST view?', options: ['200 mm', '85 mm', '50 mm', '16 mm'], answer: 3, why: 'Shorter focal length = wider field of view.' },
    { q: 'A 50 mm lens on an APS-C camera (crop 1.5×) frames like…', options: ['33 mm on full frame', '50 mm on full frame', '75 mm on full frame', '100 mm on full frame'], answer: 2, why: 'The smaller sensor crops the middle of the image: 50 × 1.5 = 75 mm equivalent.' },
    { q: 'What really causes "telephoto compression"?', options: ['The glass squeezes the image', 'Standing far away — perspective depends on camera position', 'A small aperture', 'High ISO'], answer: 1, why: 'Perspective only depends on where the camera is. A telephoto just lets you frame tightly from far away.' },
  ],

  build({ stage }) {
    const rig = makeRig(stage, { slab: false, frustumLen: 45 });
    return {
      update(dt, s, t) { s.sensor = +s.sensor; rig.update(s, t); },
      readout(s, m) {
        const crop = 36 / s.sensor;
        return `
          <div class="eq">angle = 2 · atan(sensor ÷ 2f) = 2 · atan(${s.sensor} ÷ ${Math.round(2 * s.focal)})</div>
          <div class="row"><span>Horizontal field of view</span><b>${m.fovH.toFixed(1)}°</b></div>
          <div class="bar"><i style="width:${Math.min(100, m.fovH / 1.1)}%"></i></div>
          <div class="row"><span>Vertical field of view</span><b>${m.fovV.toFixed(1)}°</b></div>
          <div class="row"><span>Full-frame equivalent</span><b>${fmtMM(s.focal * crop)}</b></div>
          <div class="row"><span>Magnification vs. 50 mm</span><b>× ${(s.focal * crop / 50).toFixed(2)}</b></div>
          <div class="row"><span>Distance to hiker</span><b>${fmtDist(m.distHiker)}</b></div>
          <div class="status mid">${s.focal * crop < 35 ? 'Wide-angle' : s.focal * crop < 70 ? 'Normal' : 'Telephoto'}</div>`;
      },
    };
  },
};
