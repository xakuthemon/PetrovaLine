# TerraWaltz

**NISAR Surface Change & Radar Physics Explorer** — an interactive story map and analytical dashboard for the NASA Space Apps Challenge *"Dancing with the SARs"*.

TerraWaltz explains how the NASA–ISRO NISAR radar (L-band 24 cm, S-band 9.4 cm) sees through cloud, smoke and darkness, and how three physical quantities turn into pictures of a changing Earth:

- **Surface roughness** — smooth surfaces mirror the pulse away, rough ones scatter it back.
- **Dielectric constant (moisture)** — wet materials reflect more; liquid water in snow absorbs.
- **Phase (InSAR)** — two passes compared give ground motion to the centimetre.

> **All imagery and numbers are simulated.** Scenes are generated procedurally in the browser and the geography is schematic. They illustrate the physics; they are not NISAR products.

## Run it

No build, no dependencies, no network.

```bash
open index.html
```

or serve the folder:

```bash
python3 -m http.server 8000
```

A single self-contained file (CSS, JS and fonts inlined) is in `dist/terrawaltz.html`. Rebuild it with:

```bash
node tools/build-single.mjs
```

## The four movements

| | Movement | Place | What the radar shows |
|---|---|---|---|
| I | *Adagio* — The Retreating Shore | Caspian Sea · Aktau & Lake Karakol, Kazakhstan | Dielectric contrast between water and exposed seabed; HH/HV on reed beds; port settlement in InSAR |
| II | *Allegro* — The Flood Pulse | Rio Paraguai floodplain · Pantanal, Brazil | L-band double-bounce under the canopy (HH); clearing in HV; water-level change from InSAR |
| III | *Presto* — The Rupture | East Anatolian Fault · Kahramanmaraş (San Andreas context) | Co-seismic fringes, damage proxy, a subsiding urban basin |
| IV | *Largo* — The Ice Stream | Jakobshavn Isbræ · Greenland | Calving-front retreat, melt-season backscatter drop, polar night, 12-day ice motion |

## What you can do

- **Before / after divider** — drag it, or focus it and use the arrow keys. Date A is the baseline, date B follows the timeline. *Set A to this date* turns any month into the baseline, which is how you isolate an InSAR pair.
- **Sensor** — *Optical (cloud-obscured)* versus *NISAR SAR (cloud-penetrating)*. Toggle the cloud layer to see what a clear sky would show.
- **Channel** — HH, HV, VV, InSAR phase and an RGB composite. Each one updates the map and a plain-language note on what the pulse is reacting to. Hover a button to preview its note.
- **Band** — L or S. Changes fringe spacing, canopy penetration and apparent roughness.
- **Layers** — clouds, A→B change mask, places, graticule, chart sample area.
- **Probe** — hover any pixel for coordinates, surface class, σ⁰ at A and B, displacement and coherence. Click to send the pixel to the Physics Decoder.
- **Timeline** — play / pause, scrub, jump to events. Charts stay in sync; click or drag a chart to scrub.
- **Story** — scroll the sidebar; each chapter sets the map to the view it describes.
- **Physics Decoder** — roughness and dielectric sliders with a live ray diagram (specular, diffuse, double-bounce, volume, absorption).
- **Decision desk** — drivers, impacts and a policy brief you can copy, download as Markdown or print.

Keys: `Space` play · `←` `→` one month · `1`–`4` switch movement.

## How it works

```
index.html            layout and onboarding modal
css/styles.css        mission-control theme
js/util.js            seeded noise, helpers
js/physics.js         backscatter model (Fresnel reflectivity, roughness, volume, double-bounce)
js/scenes.js          four procedural scenes: date → per-pixel surface state
js/render.js          state → SAR amplitude, interferogram, optical view with clouds / night
js/cases.js           story chapters, channel notes, decision content
js/map.js             comparison canvas, pan / zoom, probe, graticule, places
js/simulator.js       Radar Physics Decoder widget
js/charts.js          synchronized SVG time series
js/app.js             state and wiring
tools/build-single.mjs  bundles everything into dist/terrawaltz.html
```

Each scene maps a date to a per-pixel state (roughness, dielectric constant, vegetation volume, vertical structure, coherence, line-of-sight displacement). One backscatter function turns that state into HH, HV and VV. The same function drives the Physics Decoder, so the sliders and the map obey the same rules. Chart series are sampled from the scenes themselves, month by month.

The model is a teaching approximation tuned to typical L-band values (calm water ≈ −28 dB, forest HV ≈ −13 dB, flooded forest HH ≈ −4 dB). Interferograms wrap `2 × displacement / wavelength`, so one fringe is 11.9 cm at L-band and 4.7 cm at S-band.

## Notes

- **Timeline.** NISAR launched on 30 July 2025. Earlier years are shown as an L-band analogue so each story has a baseline.
- **Chart colours** were checked for colour-vision-deficiency separation and contrast on the panel surface.
- **Fonts.** IBM Plex Sans, IBM Plex Mono and Instrument Serif are bundled under the SIL Open Font License (see `assets/fonts/`).
- **Accessibility.** Keyboard access throughout, visible focus, a data-table view for the charts, and reduced-motion support.
