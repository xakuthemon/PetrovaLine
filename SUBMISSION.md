# Petrova Line · NASA Space Apps Challenge 2026

Text for each field of the Space Apps project page, written to the [Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/). Copy a section into the matching field.

Fill in the bracketed parts first (team, members, and the challenge title if it differs).

---

## Project name

Petrova Line

## Challenge

Dancing with the SARs

## Team

[Team name] · [Member 1], [Member 2], [Member 3]

## High-level summary

Petrova Line is an installable web app that shows how NASA–ISRO's NISAR radar reads a moving planet. A scroll story flies from NISAR's 747 km orbit to its 12 m reflector, sends its two radar waves (L-band 24 cm, S-band 9.4 cm) to the ground, fills in the 12-day coverage, and lifts four places off the globe: a retreating Caspian shore, a flooded Pantanal forest, the 2023 Kahramanmaraş earthquake and the Jakobshavn glacier. A radar console then lets anyone compare two dates, switch polarisation and band, read an interferogram, see which scattering mechanism dominates a pixel, and export a brief.

It answers the challenge by making radar's physics (roughness, moisture, structure and phase) visible and hands-on, so people can read SAR imagery before they open real NISAR data. It matters because radar sees through cloud, smoke and darkness, which is when floods, fires and earthquakes most need eyes on the ground.

## Project demo

Seven-slide deck (PDF, title and intro included):
https://github.com/xakuthemon/PetrovaLine/blob/claude/terrawaltz-nisar-dashboard-zl94vt/submission/petrova-line-demo.pdf

Once the branch is merged, use `.../blob/main/submission/petrova-line-demo.pdf`. The link opens without a login because the repository is public.

## Final project

- Code: https://github.com/xakuthemon/PetrovaLine
- Live app: https://xakuthemon.github.io/PetrovaLine/ (after GitHub Pages is switched on, see the checklist)
- Offline copy: `release/petrova-line.html` opens straight from disk

## Project details

**What it does**

- *Story*: nine scroll slides over one 3D stage. The camera moves from a planet wrapped in orbits to NISAR, follows the two radar waves to the ground, shows the 12-day coverage, then visits four places, where a terrain tile rises from the globe and a scan line sweeps from the "before" to the "after" radar image.
- *Console*: a full-screen radar map with a before/after divider, five channels (HH, HV, VV, InSAR, false colour), L or S band, an optical view with clouds for comparison, a change map, a 2020–2026 timeline, a pixel panel that splits the echo into surface, volume and double-bounce scattering with what-if sliders for roughness and moisture, and an export of the brief as Markdown, JSON or text.
- *App*: installs on phones, tablets and desktops, and works offline after the first visit.

**How it works**

The globe is drawn from NASA's 4K Blue Marble and Black Marble maps with terrain shading, cloud cover and sun glint, and the 3D stage adapts its resolution to stay smooth on laptops and phones. Each scene maps a date to a per-pixel surface state: roughness, dielectric constant (moisture), vegetation volume, vertical structure, coherence and line-of-sight motion. One backscatter model turns that state into HH, HV and VV at L- or S-band, and the same model drives the pixel panel. Interferograms wrap `2 × displacement / wavelength`, so one fringe is 11.9 cm at L-band and 4.7 cm at S-band. The globe uses NASA Blue Marble and Black Marble imagery. NISAR's orbit is drawn at its real altitude and inclination.

**Benefits**

Students and newcomers learn to read radar by changing one thing at a time and watching the image respond. Planners can see what a NISAR product can show for water, forests, faults and ice, and take away a short brief.

**Tools**

TypeScript, React, Vite, Tailwind CSS, Three.js (WebGL), GSAP, Lenis, Motion, zustand, lucide icons. Runs entirely in the browser; no server.

## Use of artificial intelligence

- **Code.** Most of the code was written with an AI coding assistant (Claude Code, Anthropic), working from the team's concept, brief and design direction. This is also stated in `package.json`, in the page metadata (`<meta name="generator">`), in `src/main.tsx` and in the app's About panel.
- **Data.** The radar scenes and every figure in them are synthetic. They are generated in the browser by code written with AI assistance; the app's About panel and the demo deck say so.
- **Images.** The demo deck shows screenshots of the app. [Confirm: whether the Petrova Line logo artwork was made with an AI image tool. If it was, the guide asks for a visible watermark on it.]
- **Idea.** AI was not used to choose how to answer the challenge. [Confirm this matches how your team worked.]
- NASA branding is not used or modified.

## NASA data

- **NISAR mission facts** (NASA/JPL): 747 km sun-synchronous orbit at 98.4°, 12-day repeat, 12 m mesh reflector, L-band (24 cm) and S-band (3.2 GHz, about 9.4 cm; NASA's quick facts round it to 10 cm), launch on 30 July 2025. These drive the orbit, the coverage animation, the two wave ribbons, the fringe spacing and the band switch. https://nisar.jpl.nasa.gov/nisarmission
- **NISAR data products** (NASA Earthdata): what the mission's products will contain; the console mirrors those layers (backscatter by polarisation, interferograms, coherence). https://www.earthdata.nasa.gov/news/now-nisar-launched-heres-what-you-can-expect-from-data
- **Blue Marble** (NASA Visible Earth): the globe's 4K day map. https://visibleearth.nasa.gov/collection/1484/blue-marble
- **Black Marble** (NASA Earth Observatory): city lights on the night side of the globe. https://earthobservatory.nasa.gov/features/NightLights

The radar scenes themselves are simulated with these parameters; they are not NISAR measurements. Loading NISAR level-2 products from NASA's Alaska Satellite Facility archive is the next step.

## Space agency partner data

NISAR is a joint NASA–ISRO mission; the S-band radar is ISRO's. We used the published mission parameters only, not ISRO data products.

## References

- NISAR quick facts, NASA/JPL press kit: https://www.jpl.nasa.gov/press-kits/nisar/quick-facts/
- NISAR mission overview, NASA Science: https://science.nasa.gov/mission/nisar/
- Earth maps: NASA Blue Marble and Black Marble, plus a topography map, a water mask and a cloud map, all taken from the examples of the `three-globe` package (MIT): https://github.com/vasturiano/three-globe
- Libraries: React, Vite, TypeScript, Tailwind CSS, Three.js, GSAP, Lenis, Motion, zustand, lucide-react
- Fonts: Inter Tight, Archivo and JetBrains Mono (SIL Open Font License), bundled from Fontsource
- All other code, the scene simulation and the 3D models are original to this project

## Before you submit

- [ ] Team name and members here (to put them on slide 1 of the deck too, edit `submission/deck/index.html` and rebuild the PDF with `node tools/make-deck.mjs`)
- [ ] Confirm the challenge title and the two "Confirm" notes under *Use of artificial intelligence*
- [ ] Switch on GitHub Pages: Settings › Pages › Source: *GitHub Actions*, then merge to `main` (the workflow in `.github/workflows/pages.yml` publishes the app)
- [ ] Open every link in a private window to check that none asks for a login
- [ ] Tick the terms and "Confirm All Work is Original" boxes on the project page
- [ ] Submit before Sunday 15 November, 11:59 pm local time of your event
