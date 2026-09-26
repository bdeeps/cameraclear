// Storyboard for the Glassbox short video. Each scene opens a chapter, sets
// values, then animates settings from → to over the scene ([from, to, log?]).
// The Glassbox studio plays it frame by frame through window.glassbox.director.
export const STORYBOARD = [
  { chapter: 'obscura', ms: 4600, set: { pin: 0.1, lens: false }, anim: { dist: [8, 4.6] },
    caption: 'Every camera is just a dark box with a hole in it.' },
  { chapter: 'obscura', ms: 4600, anim: { pin: [0.05, 0.55, true] },
    caption: 'Bigger hole: a brighter picture, but a blurrier one.' },
  { chapter: 'obscura', ms: 4200, anim: { lens: [false, true] },
    caption: 'A lens bends every ray back to one point. Bright and sharp.' },
  { chapter: 'anatomy', ms: 5200, set: { xray: false }, anim: { explode: [0, 1] }, spin: 1.2,
    caption: 'Inside a real camera: lens, iris, shutter, sensor.' },
  { chapter: 'aperture', ms: 5400, anim: { aperture: [2, 16, true] },
    caption: 'Aperture: wide melts the background. Narrow keeps it all sharp.' },
  { chapter: 'shutter', ms: 5400, anim: { shutter: [1 / 1000, 1 / 8, true] },
    caption: 'Shutter speed: leave it open longer and motion smears.' },
  { chapter: 'iso', ms: 5000, anim: { iso: [100, 12800, true] },
    caption: 'ISO turns up the volume on the light, and on the noise.' },
  { chapter: 'focal', ms: 5000, anim: { focal: [16, 300, true] },
    caption: 'Focal length decides how much of the world fits in.' },
];
