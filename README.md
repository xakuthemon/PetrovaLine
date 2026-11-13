# TerraWaltz

**Dancing with the SARs** — an interactive mission experience inspired by the NASA–ISRO NISAR radar satellite, built for the NASA Space Apps Challenge.

Two radar wavelengths (L-band 24 cm, S-band 9.4 cm) read water, forests, fault lines and ice. TerraWaltz lets you fly from orbit into a working radar console and see how roughness, moisture and phase become pictures of a changing Earth.

> **All imagery, telemetry and figures are simulated.** Scenes are generated procedurally in the browser and the geography is schematic. They illustrate the physics; they are not NISAR products.

## Run it

```bash
npm install
```

```bash
npm run dev
```

No server at hand: open `release/terrawaltz.html` directly. It is the whole app in one file (code, styles and fonts inlined).

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run build` | typecheck + production build in `dist/` |
| `npm run preview` | serve `dist/` |
| `npm run build:single` | one-file build, copied to `release/terrawaltz.html` |
| `npm run build:embed` | body-only fragment for sandboxed hosts (no download or print buttons) |

## Three modes, one page

A floating **Mission Capsule** stays on screen in every mode: mode switcher, sub-satellite latitude / longitude / altitude, next pass, UTC clock. The mode is mirrored in the URL (`#orbit`, `#console`, `#signal`).

### Orbit

A WebGL scene built entirely in code: the NISAR spacecraft (12 m mesh reflector, 9 m boom, gold-foil bus, solar arrays, feed) over a shadowed Earth with an eclipse rim, and two wave ribbons drawn at the true 24 : 9.4 wavelength ratio. Telemetry lenses float around it and the scene follows the pointer.

- **Enter Radar Console** dives the camera down the radar swath into the console.
- **Follow Current Pass** opens the console on the next target under the simulated ground track.

### Console

A full-viewport radar image with glass instruments floating over it.

| | Case | What the radar shows |
|---|---|---|
| 01 | Caspian Sea · Aktau & Lake Karakol | shoreline retreat, wetland loss, port settlement |
| 02 | Pantanal wetlands | flood pulse under the canopy, clearing |
| 03 | Kahramanmaraş fault | co-seismic fringes, damage, a subsiding basin |
| 04 | Jakobshavn glacier | calving-front retreat, melt, ice motion |

- **Case switcher** (top): live thumbnails, acquisition badge and headline metric. Switching retargets the view.
- **Before / after divider**: drag the lens handle, or focus it and use the arrow keys. Date A is the baseline; date B follows the timeline.
- **Channel dock**: HH, HV, VV, InSAR phase and false-colour RGB. **Sweep** cycles them. Also here: Optical / SAR, L or S band, change mask, clouds.
- **Probe**: hover a pixel for coordinates, surface class and σ⁰; click to pin it in the decoder.
- **Physics Decoder** (right drawer, a sheet on phones): three scattering diagrams — surface, volume, double-bounce. Selecting one highlights the pixels where that mechanism dominates. Shows dominant return, HH/HV ratio, coherence, confidence, what-if sliders for roughness and dielectric constant, and an actionable insight.
- **Timeline** (bottom): 2020–2026, three traces per case, draggable playhead, play / pause, *Set A here*.
- **Export Mission Brief**: Markdown, JSON or plain text; choose sections; download, copy or print a dossier.

Keys: `Space` play · `←` `→` one month · `1`–`4` switch case.

### Signal

A scroll essay in four chapters — WATER, FOREST, FAULT, ICE — each with an animated dual-band diagram of how 24 cm and 9.4 cm waves meet that medium, and a link that opens the matching case in the console. It ends with a portal back to the console.

## How it works

```
src/
  main.tsx, App.tsx, index.css     entry, mode layout, Liquid Glass material and tokens
  state/mission.ts                 one zustand store for every control
  data/cases.ts, data/orbit.ts     case content, simulated orbit telemetry
  engine/
    physics.ts                     backscatter model (Fresnel, roughness, volume, double-bounce)
    scenes.ts                      four procedural scenes: date -> per-pixel surface state
    render.ts                      state -> SAR amplitude, interferogram, optical view, overlays
    mapEngine.ts                   comparison canvas, pan / zoom, probe, graticule
    brief.ts                       mission brief in Markdown / JSON / text
  three/
    SatelliteModel.ts              procedural NISAR spacecraft
    apsisScene.ts                  Earth, orbit, wave ribbons, camera rig and dive
  components/
    glass/                         LiquidGlassPanel, LensPill, MagneticButton, SVG filters
    MissionCapsule.tsx, ApsisBackdrop.tsx
    orbit/  console/  signal/      the three modes
tools/make-embed.mjs               post-processing for the one-file builds
release/terrawaltz.html            committed one-file build
```

Each scene maps a date to a per-pixel state (roughness, dielectric constant, vegetation volume, vertical structure, coherence, line-of-sight displacement). One backscatter function turns that state into HH, HV and VV; the same function drives the decoder sliders and the mechanism highlight, so the map and the diagrams obey the same rules. Timeline traces are sampled from the scenes month by month.

The model is a teaching approximation tuned to typical L-band values (calm water ≈ −28 dB, forest HV ≈ −13 dB, flooded forest HH ≈ −4 dB). Interferograms wrap `2 × displacement / wavelength`: one fringe is 11.9 cm at L-band and 4.7 cm at S-band.

Stack: React 18, Vite, TypeScript (strict), Tailwind, zustand, Motion, Three.js, lucide-react.

## Known limits

- **Simulated data.** Nothing here is a mission product; the capsule and every exported brief say so.
- **Edge refraction is Chromium-only.** The glass bends its backdrop through an SVG displacement filter. Safari and Firefox get blur, rim light and pointer sheen without the distortion. Slow devices drop the distortion, then the heavy blur, automatically.
- **Timeline.** NISAR launched on 30 July 2025. Earlier years are shown as an L-band analogue so each case has a baseline.
- **Spacecraft model.** Proportions follow the published dimensions (12 m reflector, 9 m boom); the rest is an illustration.
- **Motion.** With `prefers-reduced-motion`, the camera dive becomes a cross-fade and ambient loops stop.

## Licences

Inter, JetBrains Mono and Instrument Serif are bundled from `@fontsource` under the SIL Open Font License. Three.js, React, Motion, zustand and lucide are MIT / ISC.
