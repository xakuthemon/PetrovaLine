# TerraWaltz

**NISAR Surface Change & Radar Physics Explorer** — an interactive story map and analytical dashboard for the NASA Space Apps Challenge *"Dancing with the SARs"*.

TerraWaltz explains how the NASA–ISRO NISAR radar (L-band 1.25 GHz / 24 cm, S-band 3.2 GHz / 9.4 cm) sees through cloud, smoke and darkness, and how three physical quantities turn into pictures of a changing Earth:

- **Surface roughness** — smooth surfaces mirror the pulse away, rough ones scatter it back.
- **Dielectric constant (moisture)** — wet materials reflect more; liquid water in snow absorbs.
- **Phase (InSAR)** — two passes compared give ground motion to the centimetre.

> **All imagery and numbers are simulated.** The spacecraft model and the scenes are generated procedurally in the browser and the geography is schematic. They illustrate the physics; they are not NISAR products.

## Run it

No build, no install, no network.

```bash
open index.html
```

or serve the folder:

```bash
python3 -m http.server 8000
```

A single self-contained file (CSS, JS, fonts and Three.js inlined) is in `dist/terrawaltz.html`. Rebuild it with:

```bash
node tools/build-single.mjs
```

## Two views

### 01 · Spacecraft

An asymmetric split: editorial copy on the left, a WebGL scene of the NISAR spacecraft on the right. The model is built entirely in code with Three.js:

- **I3K bus** in gold MLI foil (procedural crinkle normal and roughness maps), the octagonal **radar instrument structure** with radiator panels, and the **L / S-band feed aperture**.
- Two **solar arrays** with cell grid lines, a **9 m truss boom** in two hinged segments with a GPS antenna at the tip.
- The **12 m drum reflector**: perimeter truss, front and rear geodesic nets, tension ties and a translucent gold mesh surface that casts a mesh-patterned shadow.
- A **radar beam** reflected 37° off nadir onto a contour drawing of the Caspian shore at Aktau and Lake Karakol. The scan line reveals the simulated SAR image of the same scene used in the console.

Scrolling flies the camera through four stations (overview, reflector, feed, swath). Moving the pointer adds parallax, dragging rotates, and hovering a pin or a part of the model fades in a CAD-style callout. The subsystem list gives the same callouts from the keyboard. If WebGL or Three.js is unavailable, a line schematic stands in and the copy still follows the scroll.

Below the hero: why active radar, what the echo carries, and an index of the four case studies.

### 02 · Console

| | Movement | Place | What the radar shows |
|---|---|---|---|
| 01 | *Adagio* — The Retreating Shore | Caspian Sea · Aktau & Lake Karakol, Kazakhstan | Dielectric contrast between water and exposed seabed; HH/HV on reed beds; port settlement in InSAR |
| 02 | *Allegro* — The Flood Pulse | Rio Paraguai floodplain · Pantanal, Brazil | L-band double-bounce under the canopy (HH); clearing in HV; water-level change from InSAR |
| 03 | *Presto* — The Rupture | East Anatolian Fault · Kahramanmaraş (San Andreas context) | Co-seismic fringes, damage proxy, a subsiding urban basin |
| 04 | *Largo* — The Ice Stream | Jakobshavn Isbræ · Greenland | Calving-front retreat, melt-season backscatter drop, polar night, 12-day ice motion |

- **Before / after divider** — drag it, or focus it and use the arrow keys. Date A is the baseline, date B follows the timeline. *Set A to this date* turns any month into the baseline, which is how you isolate an InSAR pair.
- **Sensor** — *Optical (cloud-obscured)* versus *NISAR SAR (cloud-penetrating)*. Toggle the cloud layer to see what a clear sky would show.
- **Channel** — HH, HV, VV, InSAR phase and an RGB composite, each with a plain-language note on what the pulse is reacting to. Hover a button to preview its note.
- **Band** — L or S. Changes fringe spacing, canopy penetration and apparent roughness.
- **Layers** — clouds, A→B change mask, places, graticule, chart sample area.
- **Probe** — hover any pixel for coordinates, surface class, σ⁰ at A and B, displacement and coherence. Click to send the pixel to the Physics Decoder.
- **Timeline** — play / pause, scrub, jump to events. Charts stay in sync; click or drag a chart to scrub.
- **Story** — scroll the sidebar; each chapter sets the map to the view it describes.
- **Physics Decoder** — roughness and dielectric sliders with a live ray diagram (specular, diffuse, double-bounce, volume, absorption).
- **Decision desk** — drivers, impacts and a policy brief you can copy, download as Markdown or print.
- **Why Active Radar?** — the primer dialog, from the button in the nav.

Keys in the console: `Space` play · `←` `→` one month · `1`–`4` switch movement.

## Design system

Flat surfaces, hairline rules, 2–3 px radii, no blur, glow or decorative gradients. One signal colour (`#00F0FF`) for active data elements, amber for alerts. Inter for text, JetBrains Mono for telemetry, coordinates, bands and timestamps, tabular numerals throughout. Motion is linear or ease-out and short; `prefers-reduced-motion` stops the drift and the pulses.

## How it works

```
index.html              both views and the dialogs
css/styles.css          design tokens and layout
js/util.js              seeded noise, helpers
js/physics.js           backscatter model (Fresnel reflectivity, roughness, volume, double-bounce)
js/scenes.js            four procedural scenes: date → per-pixel surface state
js/render.js            state → SAR amplitude, interferogram, optical view with clouds / night
js/cases.js             story chapters, channel notes, decision content
js/map.js               comparison canvas, pan / zoom, probe, graticule, places
js/simulator.js         Radar Physics Decoder widget
js/charts.js            synchronized SVG time series
js/spacecraft.js        procedural NISAR model, lighting, beam and terrain (Three.js)
js/hero.js              scroll stations, callouts, pointer parallax and drag
js/app.js               state, view routing (#mission / #console) and wiring
vendor/three.min.js     Three.js r149 (MIT), vendored so the app runs offline
tools/build-single.mjs  bundles everything into dist/terrawaltz.html
```

Each scene maps a date to a per-pixel state (roughness, dielectric constant, vegetation volume, vertical structure, coherence, line-of-sight displacement). One backscatter function turns that state into HH, HV and VV. The same function drives the Physics Decoder, so the sliders and the map obey the same rules. Chart series are sampled from the scenes themselves, month by month.

The model is a teaching approximation tuned to typical L-band values (calm water ≈ −28 dB, forest HV ≈ −13 dB, flooded forest HH ≈ −4 dB). Interferograms wrap `2 × displacement / wavelength`, so one fringe is 11.9 cm at L-band and 4.7 cm at S-band.

## Notes

- **Spacecraft model.** Proportions follow the published subsystem dimensions (12 m reflector, 9 m boom); everything else is an illustration, not an engineering model.
- **Timeline.** NISAR launched on 30 July 2025. Earlier years are shown as an L-band analogue so each story has a baseline.
- **Chart colours** were checked for colour-vision-deficiency separation and contrast on the panel surface.
- **Licences.** Inter and JetBrains Mono are bundled under the SIL Open Font License (`assets/fonts/`). Three.js is MIT (`vendor/three.LICENSE.txt`).
- **Accessibility.** Keyboard access throughout, visible focus, a data-table view for the charts, and reduced-motion support.
