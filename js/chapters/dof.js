import { makeRig } from '../rig.js';
import { APERTURES, INF, fmtF, fmtMM, fmtDist, autoShutter, dof } from '../optics.js';

export default {
  id: 'dof',
  title: 'Depth of Field',
  subtitle: 'How deep is the slice of sharpness?',
  world: true,
  view: { pos: [5.2, 3.6, 2.6], target: [0, 1, -3.5] },
  learn: `
    <p>Only the <dfn data-t="plane-of-focus">plane of focus</dfn> (yellow) is perfectly sharp. But things a little in front and behind still look sharp, because their <dfn data-t="circle-of-confusion">blur circles</dfn> are too small to notice. That zone — green in the 3D view — is the <dfn data-t="depth-of-field">depth of field</dfn>.</p>
    <p>Three things make it <b>shallower</b>: a <b>wider aperture</b>, a <b>longer focal length</b>, and <b>focusing closer</b>. Reverse them for deep focus.</p>
    <p class="tip"><b>Landscape trick:</b> focus at the <dfn data-t="hyperfocal">hyperfocal distance</dfn> and everything from half that distance to infinity is sharp. The "Set hyperfocal" button does the maths.</p>`,
  terms: ['depth-of-field', 'plane-of-focus', 'circle-of-confusion', 'hyperfocal', 'bokeh', 'aperture'],
  photo: true,
  defaults: { aperture: 2.8, focus: 2.5, focal: 50, scene: 'cloudy', iso: 100 },
  onChange(s) { s.shutter = autoShutter(s); },
  modeLabel: () => 'Av',
  controls: [
    { key: 'aperture', type: 'stops', label: 'Aperture', values: APERTURES, fmt: fmtF, term: 'aperture', ends: ['shallow', 'deep'] },
    { key: 'focus', type: 'log', label: 'Focus distance', min: 0.5, max: 100, inf: INF, term: 'focus-distance', fmt: fmtDist },
    { key: 'focal', type: 'log', label: 'Focal length', min: 14, max: 400, term: 'focal-length', fmt: fmtMM },
    {
      type: 'buttons', label: 'Quick focus', items: [
        { label: 'Hiker', act: (s, m) => { s.focus = m.distHiker; } },
        { label: 'Sign', act: (s, m) => { s.focus = m.distSign; } },
        { label: 'Autumn tree', act: (s, m) => { s.focus = m.distTree; } },
        { label: 'Set hyperfocal', event: 'hyperfocal', act: (s) => { s.focus = Math.min(dof(s).hyperfocal, INF); } },
      ],
    },
  ],
  missions: [
    { id: 'portrait', text: 'Portrait: focus on the hiker with less than 30 cm depth of field. Shoot.', xp: 70, when: 'shot', check: ({ s, m }) => Math.abs(s.focus - m.distHiker) < 0.3 && m.dofTotal < 0.3 },
    { id: 'landscape', text: 'Landscape: sharp from 4 m (or closer) all the way to ∞. Shoot.', xp: 70, when: 'shot', check: ({ m }) => !isFinite(m.far) && m.near <= 4 },
    { id: 'deep', text: 'Focus on the far tree while the hiker stays blurry. Shoot.', xp: 60, when: 'shot', check: ({ s, m }) => s.focus >= 15 && s.focus < 60 && m.near > m.distHiker + 0.5 },
    { id: 'hyper', text: 'Press "Set hyperfocal" and look where the far limit goes.', xp: 30, when: 'event', check: ({ event }) => event === 'hyperfocal' },
  ],
  quiz: [
    { q: 'Which gives the SHALLOWEST depth of field?', options: ['24 mm at f/11, focused at 10 m', '85 mm at f/1.8, focused at 2 m', '50 mm at f/8, focused at 5 m', '16 mm at f/16, focused at 3 m'], answer: 1, why: 'Long focal length + wide aperture + close focus all shrink depth of field.' },
    { q: 'Focusing at the hyperfocal distance makes everything sharp from…', options: ['The lens to the focus point', 'Half the hyperfocal distance to infinity', 'Infinity only', '1 m to 2 m'], answer: 1, why: 'That is the definition — and why landscape photographers love it.' },
    { q: 'Depth of field is usually…', options: ['Equal in front and behind the focus point', 'Deeper behind the focus point than in front', 'Deeper in front', 'Always zero'], answer: 1, why: 'Roughly a third in front and two-thirds behind at normal distances — watch the green zone.' },
  ],

  build({ stage }) {
    const rig = makeRig(stage, { slab: true, frustumLen: 30 });
    return {
      update(dt, s, t) { rig.update(s, t); },
      readout(s, m) {
        const deep = !isFinite(m.far);
        return `
          <div class="row"><span>Near limit of sharpness</span><b>${fmtDist(m.near)}</b></div>
          <div class="row"><span>Focus distance</span><b>${fmtDist(s.focus)}</b></div>
          <div class="row"><span>Far limit of sharpness</span><b>${deep ? '∞' : fmtDist(m.far)}</b></div>
          <div class="row"><span>Total depth of field</span><b>${deep ? '∞' : fmtDist(m.dofTotal)}</b></div>
          <div class="bar good"><i style="width:${deep ? 100 : Math.min(100, Math.max(2, (m.dofTotal / 20) * 100))}%"></i></div>
          <div class="row"><span>Hyperfocal distance</span><b>${fmtDist(m.hyperfocal)}</b></div>
          <div class="row"><span>Blur of hiker / sign / tree</span><b>${m.hikerBlur.toFixed(0)} / ${m.signBlur.toFixed(0)} / ${m.treeBlur.toFixed(0)} px</b></div>`;
      },
    };
  },
};
