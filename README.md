# CameraClear

**Box No. 001 of [Glassbox](https://glassbox.how).** ▶ Play: https://glassbox.how/cameraclear/ · 📖 Explainer: https://glassbox.how/e/cameraclear/

An interactive 3D game that teaches how cameras work: light, lenses, focus, aperture,
shutter speed, ISO, exposure, focal length and depth of field.

Each chapter has:

- a **3D model** you can orbit, zoom and poke (Three.js)
- **sliders** that drive the model live
- a **simulated camera screen** that renders a small outdoor scene with real depth of field,
  motion blur, camera shake, exposure and ISO noise. Tap it to focus, press the red button (or Space) to shoot
- **missions** that earn XP, a **quiz**, and **definitions** for every term

## Run it

```bash
npm start
```

Then open http://localhost:5173. (`npm start` runs `python3 serve.py`, a static server with caching turned off.
Any static server works; ES modules just need to be served over http, not opened as `file://`.)

Three.js loads from the jsDelivr CDN, so you need an internet connection the first time.

## Chapters

| # | Chapter | 3D model |
|---|---------|----------|
| 1 | How a Camera Sees | Camera obscura: rays through a pinhole, upside-down image, add a lens |
| 2 | Anatomy of a Camera | A camera that explodes into parts you can click |
| 3 | Focus | Ray diagram with a moving lens, blur circle, plane of focus, 1/f = 1/u + 1/v |
| 4 | Aperture | Iris blades that open and close, light particles passing through |
| 5 | Shutter Speed | Focal-plane shutter curtains in slow motion (including the travelling slit) |
| 6 | ISO & the Sensor | Photosite wells filling with photons, Bayer filter, gain, noise, clipping |
| 7 | Exposure Triangle | The bucket analogy: tap width, how long it runs, bucket size |
| 8 | Focal Length & FOV | The world, with the camera's field-of-view pyramid |
| 9 | Depth of Field | The in-focus zone drawn into the world |
| 10 | Pro Mode | Full manual control and six photo assignments |

## Code map

- `js/app.js`: shell, game state (XP, missions, quiz), camera screen, main loop
- `js/stage.js`: the 3D stage (renderer, orbit controls, labels, picking)
- `js/photosim.js`: the simulated camera (DOF shader, sub-frame motion blur, exposure, noise)
- `js/world.js`: the outdoor scene the camera photographs, plus the light presets
- `js/optics.js`: exposure, DOF, FOV and blur maths
- `js/chapters/*.js`: one file per chapter (text, controls, missions, quiz, 3D build)
- `js/glossary.js`: every definition

Progress is saved in `localStorage`. `window.cameraclear` exposes the stage and settings for debugging.

## Glassbox

- `glassbox.json`: the question, hook, explainer beats and key terms shown on glassbox.how
- `js/reel.js`: the storyboard the Glassbox studio records into Reels, Shorts and a YouTube video
- `window.glassbox.director` (end of `js/app.js`): lets the studio render the storyboard frame by frame
- `glassbox/`: the published video, carousel slides, thumbnail and post copy

## License

MIT
