/*
 * TerraWaltz — case-study content: the four movements.
 * Month indices count from January 2020 (0) to September 2026 (80).
 * Context sentences describe the real places; every number on the map and in
 * the charts comes from the simulated scenario in scenes.js.
 */
(function () {
  'use strict';
  const TW = (window.TW = window.TW || {});

  const LAUNCH = { m: 66, label: 'Jul 2025 · NISAR launches', kind: 'mission' };

  const POL_INFO = {
    HH: {
      name: 'HH', role: 'Surface · double-bounce',
      text: 'Sent horizontal, received horizontal. The pulse comes back strongest when it bounces twice: off smooth wet ground or water, then off a trunk, reed or wall. Rough bare ground also returns well.',
      bright: 'flooded vegetation, buildings, rough wet soil', dark: 'calm water, smooth dry ground',
    },
    HV: {
      name: 'HV', role: 'Vegetation · biomass volume',
      text: 'Sent horizontal, received vertical. Only objects that twist the wave return this channel: branches, stems and leaves scattering the pulse many times inside a canopy.',
      bright: 'forest and dense reeds', dark: 'bare ground, water, pavement, pasture',
    },
    VV: {
      name: 'VV', role: 'Roughness · water',
      text: 'Sent vertical, received vertical. The most direct reading of small-scale surface roughness and moisture: wind ripples on water, tilled or cracked soil, wet sediment.',
      bright: 'rough or wet bare surfaces, wind-roughened water', dark: 'calm water, dry smooth crusts',
    },
    INSAR: {
      name: 'InSAR', role: 'Phase · displacement',
      text: 'Compares the phase of two passes over the same ground. One full colour cycle is half a wavelength of motion along the line of sight. Grey speckle means the surface changed too much to compare.',
      bright: '', dark: '',
    },
    RGB: {
      name: 'RGB', role: 'HH · HV · VV composite',
      text: 'Three channels at once: red is HH, green is HV, blue is VV. Read the colour as the scattering mechanism.',
      bright: 'green = canopy volume · pink-white = double-bounce', dark: 'purple = bare surface · black = calm water',
    },
  };

  const cases = [
    /* ------------------------------------------------------------------ I */
    {
      id: 'caspian', numeral: 'I', tempo: 'Adagio', title: 'The Retreating Shore', short: 'Caspian shore',
      place: 'Caspian Sea · Aktau & Lake Karakol, Kazakhstan', tag: 'Hometown spotlight',
      summary: 'The Caspian has no outlet, so its level follows the balance of river inflow and evaporation. As it falls, a shallow shelf turns into salt flat and a coastal wetland loses its water.',
      events: [{ m: 41, label: 'Jun 2023 · Aktau declares a local emergency as the falling sea threatens its water intake' }, LAUNCH],
      pois: [
        { anchor: 'city', label: 'Aktau', note: 'Coastal city built on desalinated Caspian water. Dense blocks return a strong double-bounce signal.' },
        { anchor: 'port', label: 'Port & breakwater', note: 'Harbour basin loses depth as the sea drops. The reclaimed yard settles slowly, visible in InSAR.' },
        { anchor: 'plant', label: 'Power & desalination plant', note: 'Its water intake depends on sea level; its warm discharge feeds the Karakol lagoon.' },
        { anchor: 'karakol', label: 'Lake Karakol', note: 'Lagoon and reed beds that shelter wintering swans and flamingos.' },
        { anchor: 'flats', label: 'Exposed seabed', note: 'Former sea floor. Wet mud near the waterline, dry salt crust further inland.' },
      ],
      chapters: [
        {
          title: 'The shore steps back',
          body: 'Left of the divider is January 2020, right is September 2026. Calm water mirrors the radar pulse away from the satellite, so the sea is black. Where the sea has withdrawn, a grey band of new land appears along the coast.',
          look: 'Drag the divider across the southern bay, where the shelf is shallowest and the retreat is widest.',
          view: { mode: 'sar', pol: 'HH', band: 'L', a: 0, m: 80, split: 0.5, layers: { change: false }, focus: ['flats', 1.5] },
        },
        {
          title: 'Why not just use a camera?',
          body: 'This is the same coast as an optical sensor would record it. Winter cloud decks and summer dust hide the shoreline on many passes, and a camera cannot tell wet mud from dry crust under haze.',
          look: 'Scrub the timeline to watch the cloud cover change, then switch back to NISAR SAR.',
          view: { mode: 'optical', a: 0, m: 73, split: 0.5, layers: { clouds: true, change: false }, focus: ['flats', 1] },
        },
        {
          title: 'Salt flats: reading moisture',
          body: 'Water has a dielectric constant near 80, dry salt and sand near 3. Freshly exposed mud is wet and returns a bright signal. As it dries into smooth salt crust, the return fades. The change layer marks gains in cyan and losses in amber.',
          look: 'The bright rim follows the waterline seaward year after year.',
          view: { mode: 'sar', pol: 'VV', band: 'L', a: 0, m: 80, split: 0.3, layers: { change: true }, focus: ['flats', 2] },
        },
        {
          title: 'Karakol: when the reeds lose their water',
          body: 'Reeds standing in water give a strong HH double-bounce: pulse to water, water to stem, stem back to the satellite. When the water line leaves, HH drops first. HV, which tracks the plant material itself, declines later as the stranded reeds die back.',
          look: 'In the composite, flooded reeds are pale pink-white and stranded reeds turn dull green. Compare the HH and HV lines in the chart.',
          view: { mode: 'sar', pol: 'RGB', band: 'L', a: 0, m: 80, split: 0.5, layers: { change: false }, focus: ['karakol', 2.4] },
        },
        {
          title: 'Infrastructure on moving ground',
          body: 'The interferogram compares the radar phase of two dates. Around the port, reclaimed land settles a few centimetres. At S-band one colour cycle is 4.7 cm of motion, so the same settlement draws more fringes than at L-band.',
          look: 'Switch between L-band and S-band and count the rings around the port.',
          view: { mode: 'sar', pol: 'INSAR', band: 'S', a: 0, m: 80, split: 0.25, layers: { change: false }, focus: ['port', 2.2] },
        },
      ],
      polNotes: {
        HH: 'Here: reed beds standing in lagoon water and city blocks are brightest. The open sea and dry salt crust are dark.',
        HV: 'Here: only the reed beds return much cross-polarised signal. It fades as stranded reeds die back.',
        VV: 'Here: wet mud at the new waterline is bright, dry crust is dark, and wind patches roughen the sea.',
        INSAR: 'Here: rings around the port mark settling fill; the exposed seabed compacts as it dries. Water is grey because it never repeats.',
        RGB: 'Here: pink-white reeds in water, magenta city blocks, purple desert, black sea.',
      },
      charts: {
        back: { title: 'Backscatter · Karakol reed belt', unit: 'dB', digits: 1, series: [{ key: 'b1', name: 'HH' }, { key: 'b2', name: 'HV' }] },
        area: { title: 'Surface area', unit: 'km²', digits: 1, series: [{ key: 'a1', name: 'Exposed seabed' }, { key: 'a2', name: 'Karakol wetland' }] },
        disp: { title: 'Subsidence · port fill (LOS)', unit: 'cm', digits: 1, series: [{ key: 'd1', name: 'Displacement' }] },
      },
      decision: {
        drivers: [
          { t: 'Less water in, more water out', d: 'The level follows Volga inflow against evaporation. Lower inflow and a warmer, drier basin both push it down.', conf: 'High' },
          { t: 'A shallow shelf amplifies the retreat', d: 'On a gentle slope, a metre of level change moves the shoreline by hundreds of metres to kilometres.', conf: 'High' },
          { t: 'The lagoon depends on plant discharge', d: 'Karakol is fed by cooling-water outflow. Intake limits and evaporation shrink it independently of the sea.', conf: 'Medium' },
        ],
        impacts: [
          { t: 'Drinking water and power', d: 'Aktau depends on seawater intake for desalination and cooling. A lower sea raises pumping cost and outage risk.' },
          { t: 'Port access', d: 'Shallower approaches reduce vessel draft and cargo per call, and raise dredging needs.' },
          { t: 'Wintering birds', d: 'Reed beds standing in water shelter swans and flamingos. Stranded reeds give less cover and food.' },
          { t: 'Dust and salt', d: 'Dry seabed becomes a source of salt-laden dust that reaches the city and rangeland.' },
        ],
        brief: {
          level: 'warning', levelLabel: 'Warning',
          headline: 'Shoreline retreat and wetland loss are advancing together along the Aktau coast',
          figures: (v) => [
            { k: 'New land since Jan 2020', v: TW.util.fmt(v.a1, 1) + ' km²' },
            { k: 'Karakol wetland', v: TW.util.fmtSigned(v.a2 - v.a2_0, 1) + ' km² (' + TW.util.fmtSigned(((v.a2 - v.a2_0) / v.a2_0) * 100, 0) + ' %)' },
            { k: 'Reed-belt HH', v: TW.util.fmtSigned(v.b1 - v.b1_0, 1) + ' dB' },
            { k: 'Port fill settlement', v: TW.util.fmt(v.d1, 1) + ' cm' },
          ],
          actions: [
            'Survey intake depth margins at the power and desalination plant against a further 0.5 m and 1 m fall.',
            'Hold a minimum water level in Karakol through managed discharge during the wintering season.',
            'Map newly exposed seabed for dust control before it dries into loose crust.',
            'Add port approach bathymetry and quay settlement to routine monitoring.',
          ],
          monitor: 'Track shoreline position and lagoon extent on every 12-day NISAR pass; flag a reed-belt HH drop of more than 3 dB as habitat loss.',
        },
      },
    },

    /* ----------------------------------------------------------------- II */
    {
      id: 'pantanal', numeral: 'II', tempo: 'Allegro', title: 'The Flood Pulse', short: 'Amazon & Pantanal',
      place: 'Rio Paraguai floodplain · Pantanal & southern Amazon edge, Brazil', tag: null,
      summary: 'Each year a flood wave spreads under the forest canopy of the world\'s largest tropical wetland, while clearing advances on the upland. Both happen under cloud or smoke.',
      events: [
        { m: 8, label: 'Sep 2020 · record fire season in the Pantanal' },
        { m: 57, label: 'Oct 2024 · Paraguay River at record lows' }, LAUNCH,
      ],
      pois: [
        { anchor: 'river', label: 'Rio Paraguai', note: 'Open water mirrors the pulse away: black in every channel.' },
        { anchor: 'forest', label: 'Floodplain forest', note: 'Chart sample area. Bright in HH when water stands under the trees.' },
        { anchor: 'plain', label: 'Seasonal grassland', note: 'Shallow flooding with emergent grass is grey; deeper open water is black.' },
        { anchor: 'frontier', label: 'Clearing frontier', note: 'Rectangular plots spread from the road. Fresh clearings are rough; pasture is dark in HV.' },
        { anchor: 'reserve', label: 'Protected forest', note: 'Intact canopy: steady HV through every season.' },
      ],
      chapters: [
        {
          title: 'The flood you cannot see',
          body: 'Peak flood arrives in the rainy season, when cloud covers the basin on most days. Even on a clear day, a camera sees only treetops: water standing under the canopy is invisible from above.',
          look: 'Turn the clouds off. Flooded forest and dry forest look the same in the optical view.',
          view: { mode: 'optical', a: 33, m: 40, split: 0.5, layers: { clouds: true, change: false }, focus: ['forest', 1] },
        },
        {
          title: 'Double-bounce lights up the water under the trees',
          body: 'L-band waves are 24 cm long, long enough to pass through leaves and twigs. Under the canopy they hit the water surface, bounce to a trunk and return to the satellite. Flooded forest turns several decibels brighter in HH. Left is the dry season of October 2022, right is the flood of May 2023.',
          look: 'Bright forest along the river is standing in water. Black areas are open floodwater over grassland.',
          view: { mode: 'sar', pol: 'HH', band: 'L', a: 33, m: 40, split: 0.5, layers: { change: false }, focus: ['forest', 1.7] },
        },
        {
          title: 'HV counts the trees',
          body: 'Cross-polarised signal comes from the canopy volume itself, so it barely notices the flood. It drops sharply where forest is removed. The change layer marks every plot cleared since January 2020 in amber.',
          look: 'Clearing follows the road and its side tracks. Thin strips of forest remain along plot boundaries.',
          view: { mode: 'sar', pol: 'HV', band: 'L', a: 0, m: 80, split: 0.2, layers: { change: true }, focus: ['frontier', 2.1] },
        },
        {
          title: 'A drought year: the pulse that did not arrive',
          body: 'The same month in two years. In May 2023 the flood reached across the plain. In May 2024 the river stayed low and most floodplain forest stood dry, which lengthens the fire season that follows.',
          look: 'Step through the Mays of 2020 to 2026 with the timeline and compare with the inundated-area chart.',
          view: { mode: 'sar', pol: 'HH', band: 'L', a: 40, m: 52, split: 0.5, layers: { change: false }, focus: ['plain', 1.3] },
        },
        {
          title: 'Measuring water level from orbit',
          body: 'Because the double-bounce path touches the water surface, a rise in water level shortens the path and shifts the radar phase. Fringes inside flooded forest map how much the level changed between March and May 2023, without a single gauge.',
          look: 'Fringes appear only where trees stand in water. Dry forest decorrelates into grey.',
          view: { mode: 'sar', pol: 'INSAR', band: 'L', a: 38, m: 40, split: 0.15, layers: { change: false }, focus: ['forest', 1.5] },
        },
      ],
      polNotes: {
        HH: 'Here: flooded forest is brightest, dry forest mid-grey, open floodwater and the river black.',
        HV: 'Here: forest is bright whether flooded or not. Pasture and fresh clearings are dark rectangles.',
        VV: 'Here: similar to HH but with a weaker double-bounce, so flooded forest stands out less.',
        INSAR: 'Here: fringes inside flooded forest record water-level change. S-band cannot reach the water through the canopy, so its fringes fade.',
        RGB: 'Here: flooded forest glows pale yellow-pink, dry forest green, pasture purple, water black.',
      },
      charts: {
        back: { title: 'Backscatter · floodplain forest', unit: 'dB', digits: 1, series: [{ key: 'b1', name: 'HH' }, { key: 'b2', name: 'HV' }] },
        area: { title: 'Surface area', unit: 'km²', digits: 0, series: [{ key: 'a1', name: 'Inundated' }, { key: 'a2', name: 'Forest cleared since 2020' }] },
        disp: { title: 'Water level under canopy vs Jan 2020', unit: 'cm', digits: 0, series: [{ key: 'd1', name: 'Level change' }] },
      },
      decision: {
        drivers: [
          { t: 'Rainfall in the upper basin sets the pulse', d: 'Flood extent follows wet-season rain upstream by weeks to months. Weak rains mean a small, short flood.', conf: 'High' },
          { t: 'Roads open the upland', d: 'Clearing spreads outward from the road network in regular plots, the pattern seen in HV.', conf: 'High' },
          { t: 'Dry floodplain carries fire', d: 'When the pulse fails, grass and peat dry out and burn in the following dry season.', conf: 'Medium' },
        ],
        impacts: [
          { t: 'Fisheries and river transport', d: 'Fish breed in flooded forest. Low stages also halt barge traffic on the Paraguay River.' },
          { t: 'Cattle and ranch livelihoods', d: 'Ranching is timed to the flood. Both extreme floods and failed pulses cut grazing.' },
          { t: 'Wildlife', d: 'Jaguars, giant otters and hyacinth macaws depend on the seasonal wetland mosaic.' },
          { t: 'Carbon and smoke', d: 'Clearing and wetland fire release carbon and send smoke to cities downwind.' },
        ],
        brief: {
          level: 'watch', levelLabel: 'Watch',
          headline: 'Flood pulse is irregular and upland clearing continues to advance from the road network',
          figures: (v) => [
            { k: 'Inundated area now', v: TW.util.fmt(v.a1, 0) + ' km²' },
            { k: 'Forest cleared since Jan 2020', v: TW.util.fmt(v.a2, 0) + ' km²' },
            { k: 'Floodplain forest HH', v: TW.util.fmt(v.b1, 1) + ' dB' },
            { k: 'Water level vs Jan 2020', v: TW.util.fmtSigned(v.d1, 0) + ' cm' },
          ],
          actions: [
            'Issue a fire-season outlook whenever peak inundated area stays below half of a normal year.',
            'Send field teams to new HV-loss plots within one 12-day cycle, before burning hides the evidence.',
            'Share under-canopy flood maps with fisheries and river-transport agencies each month.',
            'Prioritise enforcement along feeder roads, where clearing begins.',
          ],
          monitor: 'Inundation from HH and clearing from HV on every pass; cloud and smoke do not interrupt the record.',
        },
      },
    },

    /* ---------------------------------------------------------------- III */
    {
      id: 'fault', numeral: 'III', tempo: 'Presto', title: 'The Rupture', short: 'Fault zone',
      place: 'East Anatolian Fault · Kahramanmaraş, Türkiye — with San Andreas context', tag: null,
      summary: 'A locked fault stores strain for centuries and releases it in seconds. Radar interferometry maps the whole displacement field, and the slower sinking of a pumped basin, to the centimetre.',
      events: [{ m: 37, label: '6 Feb 2023 · Mw 7.8 and Mw 7.5 earthquakes' }, LAUNCH],
      pois: [
        { anchor: 'rupture', label: 'Surface rupture', note: 'The two sides slid past each other. Fringes pack tightly here until the signal decorrelates.' },
        { anchor: 'town', label: 'Fault-side town', note: 'Chart sample area. Collapsed buildings lose their double-bounce return.' },
        { anchor: 'city', label: 'Urban basin', note: 'Scenario: groundwater pumping compacts the sediments under the city.' },
        { anchor: 'basin', label: 'Farmed plain', note: 'Fields decorrelate with every crop cycle; broad subsidence shows through at L-band.' },
        { anchor: 'lake', label: 'Fault-zone lake', note: 'Water never repeats between passes: no phase, no colour.' },
      ],
      chapters: [
        {
          title: 'Loading, silently',
          body: 'From January 2020 to January 2023 the fault is locked. The two plates creep past each other far from the fault, bending the crust by millimetres a year. The interferogram is almost flat, apart from one set of rings: a basin sinking as groundwater is pumped.',
          look: 'Find the rings near the city. Everything else is within a fraction of a fringe.',
          view: { mode: 'sar', pol: 'INSAR', band: 'L', a: 0, m: 36, split: 0.12, layers: { change: false }, focus: ['city', 1] },
        },
        {
          title: '6 February 2023',
          body: 'An image pair from January and March 2023 brackets the earthquakes. Each colour cycle is 11.9 cm of ground motion toward or away from the satellite. The fringes run parallel to the fault and tighten toward it, where the ground moved most.',
          look: 'Count the cycles from the scene edge to the rupture: more than ten on each side, with opposite sense.',
          view: { mode: 'sar', pol: 'INSAR', band: 'L', a: 36, m: 38, split: 0.08, layers: { change: false }, focus: ['rupture', 1] },
        },
        {
          title: 'One wavelength, two rulers',
          body: 'S-band waves are 9.4 cm long, so one fringe is 4.7 cm of motion. The same earthquake draws two and a half times as many fringes, and the image breaks into noise sooner near the fault. L-band keeps coherence over vegetation and large motions; S-band is the finer ruler for small ones.',
          look: 'Toggle between L-band and S-band on this pair.',
          view: { mode: 'sar', pol: 'INSAR', band: 'S', a: 36, m: 38, split: 0.08, layers: { change: false }, focus: ['rupture', 1.6] },
        },
        {
          title: 'Damage in the dark',
          body: 'The earthquakes struck before dawn in a winter storm. Radar needs neither daylight nor clear sky. Standing buildings return a strong double-bounce; where they collapse, HH drops and the change layer turns amber.',
          look: 'Compare the fault-side town with the larger city further from the rupture.',
          view: { mode: 'sar', pol: 'HH', band: 'L', a: 36, m: 38, split: 0.5, layers: { change: true }, focus: ['town', 2.2] },
        },
        {
          title: 'The slower hazard: a sinking basin',
          body: 'After the earthquake the picture is dominated by slow processes: afterslip along the fault and compaction of pumped aquifers. California\'s Central Valley, beside the San Andreas Fault, has sunk by tens of centimetres a year in drought. Each ring here is another 11.9 cm.',
          look: 'Move the timeline and watch rings grow outward from the city.',
          view: { mode: 'sar', pol: 'INSAR', band: 'L', a: 41, m: 80, split: 0.1, layers: { change: false }, focus: ['city', 1.8] },
        },
      ],
      polNotes: {
        HH: 'Here: towns are brightest. Slopes facing the radar are bright, slopes facing away are in shadow. Collapsed blocks turn darker.',
        HV: 'Here: mountain shrubland and green crops return cross-polarised signal; towns and bare fields do not.',
        VV: 'Here: tilled, wet fields are bright in winter; the fault-zone lake is black.',
        INSAR: 'Here: fringes parallel to the fault are the earthquake; rings are the sinking basin; grey along the rupture is where the ground broke.',
        RGB: 'Here: towns are pink-white, crops shift from purple to green through the season, mountains are grey-green.',
      },
      charts: {
        back: { title: 'Backscatter · fault-side town', unit: 'dB', digits: 1, series: [{ key: 'b1', name: 'HH' }, { key: 'b2', name: 'HV' }] },
        area: { title: 'Damaged built-up area (proxy)', unit: 'km²', digits: 1, series: [{ key: 'a1', name: 'Damage proxy' }] },
        disp: { title: 'Ground displacement · urban basin (LOS)', unit: 'cm', digits: 0, series: [{ key: 'd1', name: 'Displacement' }] },
      },
      decision: {
        drivers: [
          { t: 'Plate motion on a locked fault', d: 'Anatolia slides west past Arabia. Strain stored since the last large rupture was released in February 2023.', conf: 'High' },
          { t: 'Afterslip keeps the ground moving', d: 'The fault continues to slip quietly for months to years, decaying with time.', conf: 'High' },
          { t: 'Groundwater pumping compacts the basin', d: 'Scenario: sediments under the city lose pore pressure and compact, most of it permanently.', conf: 'Medium' },
        ],
        impacts: [
          { t: 'Lives and housing', d: 'The 2023 earthquakes killed more than 50,000 people across Türkiye and Syria and left millions without homes.' },
          { t: 'Rebuilding on moving ground', d: 'New housing sited on a subsiding basin or near the rupture inherits the next hazard.' },
          { t: 'Canals, pipelines and rail', d: 'Linear infrastructure crossing the fault or the basin edge is strained by differential motion.' },
          { t: 'Flood risk', d: 'A sinking basin floor changes drainage and deepens flooding.' },
        ],
        brief: {
          level: 'critical', levelLabel: 'Critical',
          headline: 'Co-seismic rupture mapped; urban basin continues to subside through reconstruction',
          figures: (v) => [
            { k: 'Urban basin displacement (LOS)', v: TW.util.fmt(v.d1, 0) + ' cm' },
            { k: 'Damaged built-up area (proxy)', v: TW.util.fmt(v.a1, 1) + ' km²' },
            { k: 'Town HH vs Jan 2020', v: TW.util.fmtSigned(v.b1 - v.b1_0, 1) + ' dB' },
            { k: 'Fringe spacing', v: '11.9 cm (L) · 4.7 cm (S)' },
          ],
          actions: [
            'Use the displacement map to set no-build setbacks along the mapped rupture.',
            'Check reconstruction sites against the subsidence bowl before foundations are poured.',
            'Cap groundwater abstraction where subsidence exceeds 3 cm a year and meter the largest wells.',
            'Re-level canals, rail and pipelines that cross the fault or the basin margin.',
          ],
          monitor: 'A 12-day InSAR time series separates afterslip from basin compaction; damage-proxy maps within one pass of any future event.',
        },
      },
    },

    /* ----------------------------------------------------------------- IV */
    {
      id: 'glacier', numeral: 'IV', tempo: 'Largo', title: 'The Ice Stream', short: 'Jakobshavn',
      place: 'Jakobshavn Isbræ (Sermeq Kujalleq) · Ilulissat Icefjord, Greenland', tag: null,
      summary: 'One of the fastest glaciers on Earth drains part of the Greenland Ice Sheet into a fjord. Its front advances and retreats with the seasons, and in summer the ice-sheet surface melts. For two months a year there is no sunlight at all.',
      events: [{ m: 19, label: 'Aug 2021 · rain recorded at the summit of the ice sheet' }, LAUNCH],
      pois: [
        { anchor: 'front', label: 'Calving front', note: 'Advances in winter, breaks back in summer. Long-term trend is retreat.' },
        { anchor: 'melange', label: 'Ice mélange', note: 'Packed icebergs and sea ice: very rough, very bright.' },
        { anchor: 'trunk', label: 'Fast-flowing trunk', note: 'Crevassed ice moving tens of metres a day. Too fast for interferometry.' },
        { anchor: 'melt', label: 'Melt-season sample', note: 'Chart sample area. Bright dry firn turns dark when it melts.' },
        { anchor: 'town', label: 'Ilulissat', note: 'Town at the fjord mouth. The sun stays below the horizon from late November to mid-January.' },
      ],
      chapters: [
        {
          title: 'Polar night',
          body: 'This is December as an optical sensor records it: nothing. At 69° north the sun does not rise for about two months. Radar carries its own illumination, so the record continues through the dark.',
          look: 'Switch the sensor to NISAR SAR. The whole fjord appears.',
          view: { mode: 'optical', a: 66, m: 71, split: 0.5, layers: { clouds: true, change: false }, focus: ['front', 1] },
        },
        {
          title: 'The front that breathes',
          body: 'The calving front advances through winter while mélange holds it in place, then breaks back in summer. Year over year it sits further inland. Left is April 2020, right is September 2026.',
          look: 'Drag the divider over the front. Play the timeline to watch it move with the seasons.',
          view: { mode: 'sar', pol: 'HH', band: 'L', a: 3, m: 80, split: 0.5, layers: { change: false }, focus: ['front', 2.4] },
        },
        {
          title: 'Melt turns the ice sheet dark',
          body: 'Dry snow is nearly transparent to radar: the pulse enters and scatters off buried ice layers, a bright return. Liquid water raises the dielectric constant and absorbs the pulse within centimetres. The surface turns dark by ten decibels or more. Left is March 2025, right is July 2025.',
          look: 'The dark zone climbs inland through June and July. Black dots are melt ponds.',
          view: { mode: 'sar', pol: 'HH', band: 'L', a: 62, m: 66, split: 0.5, layers: { change: false }, focus: ['melt', 1.4] },
        },
        {
          title: 'Too fast for fringes',
          body: 'This interferogram spans one 12-day repeat in March. Slow ice draws clean fringes that tighten toward the trunk. Inside the trunk the ice moves hundreds of metres between passes and the phase is lost. There, speed is measured by tracking the speckle pattern instead.',
          look: 'Bedrock is a single flat colour: it does not move.',
          view: { mode: 'sar', pol: 'INSAR', band: 'L', a: 62, m: 62, split: 0.06, layers: { change: false }, focus: ['trunk', 1.2] },
        },
      ],
      polNotes: {
        HH: 'Here: dry firn and mélange are bright; melting snow, melt ponds and open water are dark.',
        HV: 'Here: volume scattering in dry firn and crevassed ice is bright. It disappears when the snow is wet.',
        VV: 'Here: similar to HH; wind-roughened water in the bay shows up most clearly.',
        INSAR: 'Here: 12-day ice motion. Fringes on slow ice, grey noise on the fast trunk and on melting snow, flat colour on bedrock.',
        RGB: 'Here: dry firn is near white, bare ice grey-green, melting snow dark, water black.',
      },
      charts: {
        back: { title: 'Backscatter · upper ablation zone', unit: 'dB', digits: 1, series: [{ key: 'b1', name: 'HH' }, { key: 'b2', name: 'HV' }] },
        area: { title: 'Glacier area change at the front', unit: 'km²', digits: 1, series: [{ key: 'a1', name: 'Area vs Jan 2020' }] },
        disp: { title: 'Ice-surface lowering near the front', unit: 'm', digits: 1, series: [{ key: 'd1', name: 'Elevation change' }] },
      },
      decision: {
        drivers: [
          { t: 'Warm ocean water at the front', d: 'Water entering the fjord at depth melts the front from below and weakens it.', conf: 'High' },
          { t: 'Longer, stronger melt seasons', d: 'Surface melt lowers the ice and sends water to the bed, which can speed the flow.', conf: 'High' },
          { t: 'Loss of winter mélange', d: 'Rigid mélange braces the front. When it breaks up early, calving starts early.', conf: 'Medium' },
        ],
        impacts: [
          { t: 'Global sea level', d: 'This single glacier drains several percent of the ice sheet. Its discharge is a direct contribution to sea-level rise.' },
          { t: 'Ilulissat and the fjord', d: 'Fishing, hunting routes and tourism depend on ice conditions in the fjord, a UNESCO World Heritage site.' },
          { t: 'Iceberg hazard', d: 'Large calving events send waves and icebergs toward shipping lanes in Disko Bay.' },
          { t: 'Coastal planning worldwide', d: 'Flow speed and thinning feed the projections that coastal cities plan against.' },
        ],
        brief: {
          level: 'warning', levelLabel: 'Warning',
          headline: 'Calving front is retreating year over year; melt reaches further inland each summer',
          figures: (v) => [
            { k: 'Glacier area at front vs Jan 2020', v: TW.util.fmtSigned(v.a1, 1) + ' km²' },
            { k: 'Surface lowering near front', v: TW.util.fmt(v.d1, 1) + ' m' },
            { k: 'Ablation-zone HH now', v: TW.util.fmt(v.b1, 1) + ' dB' },
            { k: 'Sunlight needed', v: 'none' },
          ],
          actions: [
            'Feed 12-day front position and flow speed into ice-discharge estimates for sea-level projections.',
            'Issue calving and iceberg advisories for Disko Bay when the winter mélange breaks up.',
            'Keep melt-extent maps running through cloud and polar night to close the surface mass balance.',
            'Pair radar with fjord temperature moorings to link ocean heat to retreat.',
          ],
          monitor: 'HH melt extent, front position and offset-tracked velocity on every pass, year-round.',
        },
      },
    },
  ];

  TW.cases = cases;
  TW.POL_INFO = POL_INFO;
})();
