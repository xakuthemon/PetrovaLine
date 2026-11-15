# Petrova Line

How NASA–ISRO's NISAR radar reads a moving planet: a 3D scroll story and a radar console, as an installable web app. Built for the NASA Space Apps Challenge 2026.

> **The radar scenes and figures are simulated.** They are generated in the browser from a physical model set to NISAR's two bands; they are not mission data. The globe uses NASA Blue Marble and Black Marble imagery.

- Submission text for every form field: [SUBMISSION.md](SUBMISSION.md)
- Demo deck, 7 slides: [submission/petrova-line-demo.pdf](submission/petrova-line-demo.pdf)
- Offline copy: [release/petrova-line.html](release/petrova-line.html) (download and open)

## Run it

```bash
npm install
```

```bash
npm run dev
```

| Script | What it does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | typecheck + installable app in `dist/` (manifest, icons, offline service worker) |
| `npm run preview` | serve `dist/` |
| `npm run build:single` | one-file build, copied to `release/petrova-line.html` |
| `npm run build:embed` | body-only fragment for sandboxed hosts |
| `node tools/make-deck.mjs` | render the demo deck to PDF (needs Playwright) |
| `node tools/make-icons.mjs` | rebuild the app icons from the logo geometry (needs Playwright) |

The workflow in `.github/workflows/pages.yml` publishes `dist/` to GitHub Pages on every push to `main` once Pages is set to *GitHub Actions* in the repository settings.

## The app

**Story** (`#story`). One WebGL stage on a navy-and-champagne set; scrolling moves the camera between nine slides, each slide builds in a few words, and a scroll that stops between two slides glides on to the nearer one.

1. The planet inside a few dozen gold orbits, with NISAR on its 747 km sun-synchronous orbit
2. The spacecraft and its 12 m reflector
3. The two radar waves, L-band 24 cm and S-band 9.4 cm, at their true ratio
4. The 12-day repeat cycle filling the globe
5. to 8. Water, Forest, Fault, Ice: the globe turns to the place, a terrain tile rises from it and a scan line sweeps from the "before" to the "after" radar image
9. The logo, and a way into the app

Keys: `↓` `↑` `Space` `PageDown` `PageUp` `Home` `End`.

**Console** (`#console`). A full-screen radar map.

- Scenes: Water (Caspian Sea), Forest (Pantanal), Fault (Kahramanmaraş), Ice (Jakobshavn)
- Before/after divider (drag, or arrow keys)
- Channels HH, HV, VV, InSAR, false colour; L or S band; optical view with clouds, change map, channel cycling and place names under `⋯`
- Pixel panel: what the echo is made of (surface, volume, double bounce) and what-if sliders for roughness and moisture; selecting a mechanism highlights it on the map
- Timeline 2020–2026 with the scene's headline metric; play, scrub, set the baseline date
- Export a brief as Markdown, JSON or text; print it

Keys: `Space` play · `←` `→` one month · `1`–`4` scene.

**Devices.** Phones (portrait and landscape), tablets, desktops and wide screens. Installable (Add to Home Screen, or the install button in Chromium browsers); works offline after the first visit. Reduced motion turns off smooth scrolling, the opening animation and text builds, and turns camera moves into cuts.

## How it works

```
src/
  brand/                 logo mark, drawn in code from the logo artwork
  landing/               the story: slides and scroll map, text builds, slab renderer in a worker
  three/landingScene.ts  globe, orbits, NISAR and its trail, spacecraft, waves, coverage, terrain tiles
  three/SatelliteModel.ts  procedural NISAR spacecraft
  components/console/    the radar console
  engine/                backscatter physics, four procedural scenes, renderers, map engine, brief export
  state/mission.ts       one store for every control
public/                  manifest, icons, service worker
submission/              demo deck (HTML source, screens, PDF)
```

**The Earth** uses 4K day and night maps (loaded after the opening, when the page is idle), terrain shading from a topography map, a cloud layer that casts shadows, sun glint on open water and a thin atmosphere. The page runs one animation loop for smooth scrolling and the 3D stage, compiles every shader and uploads every texture before the camera needs it, and lowers the stage's pixel density on slower GPUs to hold the frame rate.

Each scene maps a date to a per-pixel state (roughness, dielectric constant, vegetation volume, vertical structure, coherence, line-of-sight motion). One backscatter function turns it into HH, HV and VV; the same function drives the pixel panel. Interferograms wrap `2 × displacement / wavelength`: one fringe is 11.9 cm at L-band and 4.7 cm at S-band.

## Use of AI

Most of the code was written with an AI coding assistant (Claude Code, Anthropic) from the team's concept and design direction. The radar scenes are synthetic and labelled "Simulated" wherever they appear. See [SUBMISSION.md](SUBMISSION.md#use-of-artificial-intelligence).

## Data and credits

- NISAR mission facts: [NASA/JPL](https://nisar.jpl.nasa.gov/nisarmission)
- Earth imagery: NASA [Blue Marble](https://visibleearth.nasa.gov/collection/1484/blue-marble) and [Black Marble](https://earthobservatory.nasa.gov/features/NightLights); these, the topography map, the water mask and the cloud map come from the examples of [three-globe](https://github.com/vasturiano/three-globe) (MIT)
- Fonts: Inter Tight, Archivo and JetBrains Mono (SIL Open Font License), via Fontsource
- Libraries: React, Vite, TypeScript, Tailwind CSS, Three.js, GSAP, Lenis, Motion, zustand, lucide-react
