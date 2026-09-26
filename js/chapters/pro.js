import { makeRig } from '../rig.js';
import { APERTURES, SHUTTERS, ISOS, INF, fmtF, fmtShutter, fmtISO, fmtMM, fmtDist, fmtStops } from '../optics.js';
import { PRESETS } from '../world.js';

const ok = (m, tol = 0.5) => Math.abs(m.stops) <= tol;

export default {
  id: 'pro',
  title: 'Pro Mode: Assignments',
  subtitle: 'Full manual. Six briefs. Make it happen.',
  world: true,
  view: { pos: [7, 6, 8], target: [0, 1, -6] },
  learn: `
    <p>Everything is in your hands now: light, aperture, shutter, ISO, focal length and focus. Each assignment below is a real-world brief — read it, think about which <dfn data-t="exposure-triangle">side effects</dfn> you want, set up the camera and <b>press the red shutter button</b> (or Space).</p>
    <p class="tip"><b>Workflow like a pro:</b> 1) choose the setting that matters most for the brief, 2) set the others to balance the <dfn data-t="metering">meter</dfn> to 0, 3) check the <dfn data-t="histogram">histogram</dfn>, 4) shoot.</p>
    <p>Real cameras also have <dfn data-t="white-balance">white balance</dfn>, <dfn data-t="raw">RAW</dfn> files and limited <dfn data-t="dynamic-range">dynamic range</dfn> — look them up in the glossary.</p>`,
  terms: ['exposure-triangle', 'white-balance', 'raw', 'dynamic-range', 'reciprocal-rule', 'hyperfocal'],
  photo: true,
  defaults: { scene: 'cloudy', aperture: 8, shutter: 1 / 125, iso: 100, focal: 50, focus: 6, motion: true, tripod: false },
  modeLabel: () => 'M',
  controls: [
    { key: 'scene', type: 'seg', label: 'Light', options: Object.entries(PRESETS).map(([v, p]) => ({ v, label: p.label })), fmt: (v) => 'EV ' + PRESETS[v].ev, term: 'ev' },
    { key: 'aperture', type: 'stops', label: 'Aperture', values: APERTURES, fmt: fmtF, term: 'aperture' },
    { key: 'shutter', type: 'stops', label: 'Shutter speed', values: SHUTTERS, fmt: fmtShutter, term: 'shutter-speed' },
    { key: 'iso', type: 'stops', label: 'ISO', values: ISOS, fmt: fmtISO, term: 'iso' },
    { key: 'focal', type: 'log', label: 'Focal length', min: 14, max: 400, fmt: fmtMM, term: 'focal-length' },
    { key: 'focus', type: 'log', label: 'Focus distance', min: 0.5, max: 100, inf: INF, fmt: fmtDist, term: 'focus-distance', hint: 'Or tap the camera screen.' },
    { key: 'tripod', type: 'toggle', label: 'Tripod', term: 'tripod' },
    { key: 'motion', type: 'toggle', label: 'Bouncing ball in the scene' },
  ],
  missions: [
    { id: 'golden', text: '<b>Golden-hour portrait.</b> Golden-hour light, focused on the hiker, depth of field under 50 cm, correct exposure.', xp: 100, when: 'shot', check: ({ s, m }) => s.scene === 'sunset' && Math.abs(s.focus - m.distHiker) < 0.35 && m.dofTotal < 0.5 && ok(m) },
    { id: 'sport', text: '<b>Sports desk.</b> Cloudy day, ball in play and frozen (under 1.5 px of blur), correct exposure.', xp: 100, when: 'shot', check: ({ s, m }) => s.scene === 'cloudy' && s.motion && m.motionPx < 1.5 && m.shakePx < 1.5 && ok(m) },
    { id: 'night', text: '<b>Night landscape.</b> Night light, tripod, ISO 800 or lower, sharp to ∞, correct exposure.', xp: 100, when: 'shot', check: ({ s, m }) => s.scene === 'night' && s.tripod && s.iso <= 800 && !isFinite(m.far) && ok(m) },
    { id: 'tele', text: '<b>Telephoto detail.</b> 200 mm or longer, focused on the sign, hand-held without shake, correct exposure.', xp: 100, when: 'shot', check: ({ s, m }) => s.focal >= 199 && Math.abs(s.focus - m.distSign) < 1 && !s.tripod && m.shakePx < 1.5 && ok(m) },
    { id: 'creative', text: '<b>Creative blur.</b> Tripod, 1/8 s or slower, ball streaking through a sharp scene, correct exposure.', xp: 100, when: 'shot', check: ({ s, m }) => s.tripod && s.motion && s.shutter >= 1 / 8.1 && ok(m, 0.7) },
    { id: 'clean', text: '<b>Stock photo.</b> Sunny day, ISO 100, exposure within ±0.3 stops.', xp: 80, when: 'shot', check: ({ s, m }) => s.scene === 'sunny' && s.iso === 100 && ok(m, 0.3) },
  ],
  quiz: [
    { q: 'Night, no tripod, and you need a sharp photo. Best first move?', options: ['Slower shutter', 'Raise ISO and open the aperture', 'Stop down to f/16', 'Lower ISO'], answer: 1, why: 'Without a tripod you must keep the shutter fast, so get the light from a wider aperture and more gain.' },
    { q: 'For a sharp landscape from foreground to mountains you\'d pick…', options: ['f/1.8, focus on the mountains', 'f/11, focus at the hyperfocal distance', 'f/2.8, focus at 1 m', '400 mm'], answer: 1, why: 'A mid-narrow aperture and hyperfocal focusing maximise depth of field.' },
    { q: 'The histogram is piled against the right edge. The photo is…', options: ['Underexposed', 'Overexposed with clipped highlights', 'Perfect', 'Out of focus'], answer: 1, why: 'The right edge is pure white — detail there is lost.' },
  ],

  build({ stage }) {
    const rig = makeRig(stage, { slab: true, frustumLen: 30 });
    return {
      update(dt, s, t) { rig.update(s, t); },
      readout(s, m) {
        const cls = Math.abs(m.stops) <= 0.4 ? 'good' : Math.abs(m.stops) <= 1.2 ? 'mid' : 'bad';
        return `
          <div class="row"><span>Exposure</span><b>${fmtStops(m.stops)} stops</b></div>
          <div class="status ${cls}">${Math.abs(m.stops) <= 0.4 ? 'Exposure on point' : m.stops > 0 ? 'Too bright' : 'Too dark'}</div>
          <div class="row" style="margin-top:8px"><span>Depth of field</span><b>${fmtDist(m.near)} → ${isFinite(m.far) ? fmtDist(m.far) : '∞'}</b></div>
          <div class="row"><span>Ball blur / shake</span><b>${m.motionPx.toFixed(1)} / ${m.shakePx.toFixed(1)} px</b></div>
          <div class="row"><span>Field of view</span><b>${m.fovH.toFixed(0)}°</b></div>
          <div class="row"><span>Noise</span><b>${m.noise < 0.02 ? 'clean' : m.noise < 0.06 ? 'some grain' : 'heavy grain'}</b></div>`;
      },
    };
  },
};
