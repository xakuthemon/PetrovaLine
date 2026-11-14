# TerraWaltz

**Dancing with the SARs** — an interactive experience inspired by the NASA–ISRO NISAR radar satellite, built for the NASA Space Apps Challenge.

The site has two parts: a scroll presentation that tells the mission in nine slides over one 3D stage, and a radar console where you work with four simulated scenes.

> **All radar scenes and figures are simulated.** They are generated in the browser to illustrate the physics; they are not NISAR products. The globe uses NASA Blue Marble and Black Marble imagery.

## Run it

```bash
npm install
```

```bash
npm run dev
```

No server at hand: open `release/terrawaltz.html` directly. It is the whole app in one file.

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run build` | typecheck + production build in `dist/` |
| `npm run preview` | serve `dist/` |
| `npm run build:single` | one-file build, copied to `release/terrawaltz.html` |
| `npm run build:embed` | body-only fragment for sandboxed hosts (no download or print buttons) |

## The presentation (`#story`)

One WebGL stage stays fixed while the page scrolls. Each slide holds for a while (its inner animation plays with the scroll), then the camera travels to the next one. Text builds in like a keynote slide when its slide takes the screen.

| # | Slide | On stage |
|---|---|---|
| 1 | Nothing on Earth stands still | Globe with a gold limb ring that draws itself, hairline orbits that draw on, moving satellites, NISAR labelled on its 747 km orbit |
| 2 | 12 m | Camera flies to the procedural spacecraft |
| 3 | 24 cm · 9.4 cm | L- and S-band waves grow from the reflector to the ground at their true wavelength ratio |
| 4 | 12 days | Ground tracks fill the globe, 173 orbits in a 12-day cycle |
| 5–8 | Water, Forest, Fault, Ice | The globe turns to the place; a terrain slab lifts off it and a scan line sweeps from the "before" to the "after" radar image |
| 9 | Earth is always dancing | Back to the full constellation, with a way into the console |

Keys: `↓` `↑` `PageDown` `PageUp` `Space` move between slides, `Home` / `End` jump to the ends. The dots on the right jump to a slide.

With `prefers-reduced-motion`, smooth scrolling, the intro and the text builds are off, and camera moves become cuts.

## The console (`#console`)

A full-viewport radar image with glass instruments over it.

| Case | What the radar shows |
|---|---|
| Caspian Sea · Aktau & Lake Karakol | shoreline retreat, wetland loss, port settlement |
| Pantanal wetlands | flood pulse under the canopy, clearing |
| Kahramanmaraş fault | co-seismic fringes, damage, a subsiding basin |
| Jakobshavn glacier | calving-front retreat, melt, ice motion |

- **Case switcher** (top): live thumbnails and a headline metric.
- **Before / after divider**: drag the handle, or focus it and use the arrow keys.
- **Channel dock**: HH, HV, VV, InSAR phase and false-colour RGB; **Sweep** cycles them. Also Optical / SAR, L or S band, change mask, clouds.
- **Probe**: hover a pixel for coordinates, surface class and σ⁰; click to pin it in the decoder.
- **Physics Decoder**: surface, volume and double-bounce scattering; selecting one highlights where it dominates. What-if sliders for roughness and dielectric constant.
- **Timeline**: 2020–2026, draggable playhead, play / pause, *Set A here*.
- **Export Mission Brief**: Markdown, JSON or plain text; download, copy or print.

Keys: `Space` play · `←` `→` one month · `1`–`4` switch case.

## How it works

```
src/
  App.tsx, index.css            story / console routing, tokens, glass and landing styles
  landing/
    film.ts                     slides, scroll map (hold + travel), shared curves
    Landing.tsx                 scroll container (Lenis), keynote builds (GSAP), chrome
    slab.worker.ts, slabData.ts renders the slab images off the main thread
  three/
    landingScene.ts             globe, orbits, satellites, NISAR, waves, coverage, slab, camera rig
    SatelliteModel.ts           procedural NISAR spacecraft
  engine/                       backscatter physics, four procedural scenes, renderers, map engine
  components/console/           the console
  state/mission.ts              one zustand store
  assets/earth/                 Blue Marble (day) and Black Marble (night lights) textures
tools/make-embed.mjs            post-processing for the one-file builds
release/terrawaltz.html         committed one-file build
```

Each simulated scene maps a date to a per-pixel state (roughness, dielectric constant, vegetation volume, vertical structure, coherence, line-of-sight displacement). One backscatter function turns that state into HH, HV and VV, and the same function drives the decoder. The slabs on the landing use the same renderer, so they match the console.

Stack: React 18, Vite, TypeScript (strict), Tailwind, Three.js, GSAP, Lenis, Motion, zustand, lucide-react.

## Known limits

- **Simulated scenes.** Nothing in the console or on the slabs is a mission product.
- **Schematic orbits.** The constellation is decorative; NISAR's own orbit uses its real altitude and inclination.
- **Edge refraction is Chromium-only** in the console glass; other browsers get blur, rim light and sheen.
- **Timeline.** NISAR launched on 30 July 2025. Earlier years are shown as an L-band analogue so each case has a baseline.

## Credits and licences

- Earth imagery: NASA Visible Earth, Blue Marble and Black Marble (public domain), taken from the examples of the `three-globe` package and downscaled.
- Inter Tight and JetBrains Mono, bundled from `@fontsource` under the SIL Open Font License.
- Three.js, React, GSAP, Lenis, Motion, zustand and lucide are MIT / ISC or the GSAP standard licence.
