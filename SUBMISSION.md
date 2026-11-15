# Petrova Line

Our submission for NASA Space Apps Challenge 2026.

## Project name

Petrova Line

## Challenge

Dancing with the SARs

## Team

Petrova Line: Kdyr Asset, Issa Abilmansur, Murat Abdirakhim

## High-level summary

Petrova Line is a web app that shows how NISAR, the joint NASA–ISRO radar satellite, sees the Earth. You can install it like a normal app (it's a PWA).

There are two parts. The first is a scroll story: you start at NISAR's orbit 747 km up, zoom in on its 12 m reflector, follow the L-band (24 cm) and S-band (9.4 cm) waves down to the ground, watch the 12-day coverage fill in, and then visit four places: the shrinking Caspian shoreline, flooded forest in the Pantanal, the 2023 Kahramanmaraş earthquake and Jakobshavn glacier. The second part is a radar console where you can compare two dates, switch polarisation and band, read an interferogram, check which scattering mechanism dominates a pixel, and export a short brief.

SAR images are hard to read if you don't know what roughness, moisture, structure and phase do to the signal. We wanted people to be able to play with those directly before they open real NISAR data. Radar also works through cloud, smoke and at night, which is often when you need imagery of a flood, fire or earthquake the most.

## Project demo

7-slide deck (PDF): https://github.com/xakuthemon/PetrovaLine/blob/main/submission/petrova-line-demo.pdf

## Final project

- Repo: https://github.com/xakuthemon/PetrovaLine
- Live app: https://xakuthemon.github.io/PetrovaLine/
- Offline build: `release/petrova-line.html` (just open it from disk, no server needed)

## Project details

### What it does

**Story.** Nine slides scrolling over one 3D scene. The camera starts on a globe with orbits around it, moves to NISAR, follows both radar waves to the ground, shows the 12-day coverage, then goes through the four locations. At each one a terrain tile lifts off the globe and a scan line wipes from the "before" radar image to the "after".

**Console.** A full-screen radar map with a before/after divider, plus:

- 5 channels: HH, HV, VV, InSAR, false colour
- L-band / S-band switch
- optical view with clouds, to compare against radar
- change map and a 2020–2026 timeline
- pixel panel that splits the echo into surface, volume and double-bounce scattering, with sliders for roughness and moisture so you can see what changes
- brief export as Markdown, JSON or plain text

**PWA.** Installs on phones, tablets and desktops, and works offline after the first visit.

### How it works

The globe uses NASA's 4K Blue Marble and Black Marble maps, with terrain shading, clouds and sun glint on top. The renderer lowers its resolution when it needs to, so it stays smooth on laptops and phones. NISAR's orbit is drawn at its real altitude and inclination.

Each scene is basically a function from a date to a per-pixel surface state: roughness, dielectric constant (moisture), vegetation volume, vertical structure, coherence and line-of-sight motion. One backscatter model turns that state into HH, HV and VV at L- or S-band. The pixel panel runs the same model, so its breakdown always matches the map.

Interferograms show `2 × displacement / wavelength` fringes (wrapped), so one fringe is 11.9 cm of motion at L-band and 4.7 cm at S-band.

### Benefits

Students and people new to radar can change one thing at a time and see how the image reacts. Planners get a quick idea of what NISAR products can show for water, forests, faults and ice, and can take a short brief with them.

### Tools

TypeScript, React, Vite, Tailwind CSS, Three.js (WebGL), GSAP, Lenis, Motion, zustand, lucide icons. Everything runs in the browser, there's no backend.

## Use of artificial intelligence

- Code: most of the code was written with Claude Code (Anthropic's AI coding assistant), working from our concept, brief and design direction. We also note this in `package.json`, the page's `<meta name="generator">` tag, `src/main.tsx` and the app's About panel.
- Data: the radar scenes and all the numbers in them are synthetic. They're generated in the browser by code written with AI help, and every view that shows them has a visible "Simulated" label.
- Images: the demo deck uses screenshots of the app. [TODO: was the logo made with an AI image tool? If yes, the guide needs a visible watermark on it.]
- Idea: we didn't use AI to decide how to approach the challenge. [TODO: confirm]
- We don't use or modify any NASA branding.

## NASA data

- NISAR mission facts (NASA/JPL): 747 km sun-synchronous orbit at 98.4°, 12-day repeat, 12 m mesh reflector, L-band (24 cm) and S-band (3.2 GHz, ~9.4 cm; NASA's quick facts round it to 10 cm), launched 30 July 2025. We use these for the orbit, the coverage animation, the two wave ribbons, fringe spacing and the band switch. https://nisar.jpl.nasa.gov/nisarmission
- NISAR data products (NASA Earthdata): what goes into the mission's products. The console layers follow them (backscatter per polarisation, interferograms, coherence). https://www.earthdata.nasa.gov/news/now-nisar-launched-heres-what-you-can-expect-from-data
- Blue Marble (NASA Visible Earth): 4K day texture for the globe. https://visibleearth.nasa.gov/collection/1484/blue-marble
- Black Marble (NASA Earth Observatory): city lights on the night side. https://earthobservatory.nasa.gov/features/NightLights

Note: the radar scenes are simulated from these parameters. They are not real NISAR measurements. Next step is loading actual NISAR Level-2 products from NASA's Alaska Satellite Facility (ASF) archive.

## Space agency partner data

NISAR is a joint NASA–ISRO mission and the S-band radar is ISRO's. We only used the published mission parameters, no ISRO data products.

## References

- NISAR quick facts, NASA/JPL press kit: https://www.jpl.nasa.gov/press-kits/nisar/quick-facts/
- NISAR mission overview, NASA Science: https://science.nasa.gov/mission/nisar/
