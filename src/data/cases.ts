/*
 * Petrova Line — mission cases.
 * Month indices count from January 2020 (0) to September 2026 (80).
 * Context sentences describe the real places; every number on the map and in the
 * traces comes from the simulated scenario in engine/scenes.ts.
 */
import { fmt, fmtSigned } from '../engine/util';
import type { SceneId, Series } from '../engine/scenes';
import type { Channel } from '../engine/mapEngine';
import type { Mechanism } from '../engine/render';

export type Tone = 'lband' | 'sband' | 'kapton';
export type SeriesKey = keyof Series;

/** Metric values at the current date, plus the January 2020 value of each (`*_0`). */
export type Values = Record<SeriesKey, number> & Record<`${SeriesKey}_0`, number>;

export interface Trace { key: SeriesKey; name: string; unit: string; digits: number; tone: Tone }
export interface CaseEvent { m: number; label: string; mission?: boolean }
export interface CaseDef {
  id: SceneId;
  index: string;
  name: string;
  region: string;
  focusLine: string;
  badge: string;
  place: string;
  defaults: { channel: Channel; a: number; m: number; split: number; focus: [string, number] };
  /** the named place used as the default "active pixel region" in the decoder */
  probeAnchor: string;
  headline: (v: Values) => { label: string; value: string };
  traces: [Trace, Trace, Trace];
  events: CaseEvent[];
  places: { anchor: string; label: string }[];
  channelNotes: Record<Channel, string>;
  mechanisms: Record<Mechanism, { where: string; insight: string }>;
  drivers: { t: string; d: string; conf: 'High' | 'Medium' }[];
  impacts: { t: string; d: string }[];
  brief: {
    level: 'watch' | 'warning' | 'critical';
    levelLabel: string;
    headline: string;
    figures: (v: Values) => { k: string; v: string }[];
    actions: string[];
    monitor: string;
  };
}

const LAUNCH: CaseEvent = { m: 66, label: 'Jul 2025 · NISAR launches', mission: true };

export const CHANNELS: { id: Channel; label: string; role: string; text: string; tone: Tone | 'lens' }[] = [
  { id: 'HH', label: 'HH', role: 'Surface · double-bounce', tone: 'lband',
    text: 'Sent horizontal, received horizontal. Strongest where the pulse bounces twice, off smooth wet ground and then a trunk, reed or wall. Rough bare ground also returns well.' },
  { id: 'HV', label: 'HV', role: 'Vegetation · biomass volume', tone: 'kapton',
    text: 'Sent horizontal, received vertical. Only objects that twist the wave return this channel: branches, stems and leaves scattering the pulse many times inside a canopy.' },
  { id: 'VV', label: 'VV', role: 'Roughness · water', tone: 'lband',
    text: 'Sent vertical, received vertical. The most direct reading of small-scale roughness and moisture: wind ripples on water, tilled soil, wet sediment.' },
  { id: 'INSAR', label: 'InSAR', role: 'Phase · displacement', tone: 'sband',
    text: 'Compares the phase of two passes. One full colour cycle is half a wavelength of motion along the line of sight. Grey speckle means the surface changed too much to compare.' },
  { id: 'RGB', label: 'RGB', role: 'False-colour composite', tone: 'lens',
    text: 'Red is HH, green is HV, blue is VV. Green reads as canopy volume, pink-white as double-bounce, purple as bare surface, black as calm water.' },
];

export const CASES: CaseDef[] = [
  /* ------------------------------------------------------------------ 01 */
  {
    id: 'caspian', index: '01', name: 'Caspian Sea', region: 'Aktau / Lake Karakol', place: 'Caspian Sea · Aktau & Lake Karakol, Kazakhstan',
    focusLine: 'Shoreline displacement & water regression', badge: 'L+S · DUAL-POL',
    defaults: { channel: 'HH', a: 0, m: 80, split: 0.5, focus: ['flats', 1.12] }, probeAnchor: 'reeds',
    headline: (v) => ({ label: 'New land since 2020', value: fmt(v.a1, 1) + ' km²' }),
    traces: [
      { key: 'a1', name: 'Exposed seabed', unit: 'km²', digits: 1, tone: 'kapton' },
      { key: 'a2', name: 'Karakol wetland', unit: 'km²', digits: 1, tone: 'lband' },
      { key: 'b1', name: 'Reed-belt HH', unit: 'dB', digits: 1, tone: 'sband' },
    ],
    events: [{ m: 41, label: 'Jun 2023 · Aktau declares a local emergency as the falling sea threatens its water intake' }, LAUNCH],
    places: [
      { anchor: 'city', label: 'Aktau' }, { anchor: 'port', label: 'Port' }, { anchor: 'plant', label: 'Power & desalination' },
      { anchor: 'karakol', label: 'Lake Karakol' }, { anchor: 'flats', label: 'Exposed seabed' },
    ],
    channelNotes: {
      HH: 'Reed beds standing in lagoon water and city blocks are brightest. The open sea and dry salt crust are dark.',
      HV: 'Only the reed beds return much cross-polarised signal. It fades as stranded reeds die back.',
      VV: 'Wet mud at the new waterline is bright, dry crust is dark, and wind patches roughen the sea.',
      INSAR: 'Rings around the port mark settling fill; exposed seabed compacts as it dries. Water is grey because it never repeats.',
      RGB: 'Pink-white reeds in water, magenta city blocks, purple desert, black sea.',
    },
    mechanisms: {
      surface: { where: 'Open sea and dry salt crust mirror the pulse away and stay dark. Wet mud at the new waterline is rougher and brighter.',
        insight: 'Follow the bright wet rim: it is the active shoreline. Map the dried crust behind it for dust control before it breaks up.' },
      volume: { where: 'Only the reed canopy scatters inside its volume here. The signal weakens as stranded reeds die back.',
        insight: 'A falling HV over the reed belt is the early sign of habitat loss, months before the reeds disappear from optical imagery.' },
      double: { where: 'Reeds standing in water and city blocks: pulse to water or street, to stem or wall, and straight back.',
        insight: 'An HH drop of more than 3 dB over the reed belt means the water has left. Hold a minimum lagoon level through the wintering season.' },
    },
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
        { k: 'New land since Jan 2020', v: fmt(v.a1, 1) + ' km²' },
        { k: 'Karakol wetland', v: fmtSigned(v.a2 - v.a2_0, 1) + ' km² (' + fmtSigned(((v.a2 - v.a2_0) / v.a2_0) * 100, 0) + ' %)' },
        { k: 'Reed-belt HH', v: fmtSigned(v.b1 - v.b1_0, 1) + ' dB' },
        { k: 'Port fill settlement', v: fmt(v.d1, 1) + ' cm' },
      ],
      actions: [
        'Survey intake depth margins at the power and desalination plant against a further 0.5 m and 1 m fall.',
        'Hold a minimum water level in Karakol through managed discharge during the wintering season.',
        'Map newly exposed seabed for dust control before it dries into loose crust.',
        'Add port approach bathymetry and quay settlement to routine monitoring.',
      ],
      monitor: 'Track shoreline position and lagoon extent on every 12-day pass; flag a reed-belt HH drop of more than 3 dB as habitat loss.',
    },
  },

  /* ------------------------------------------------------------------ 02 */
  {
    id: 'pantanal', index: '02', name: 'Pantanal Wetlands', region: 'Rio Paraguai, Brazil', place: 'Rio Paraguai floodplain · Pantanal, Brazil',
    focusLine: 'Seasonal inundation & wetland hydrology', badge: 'L · QUAD-POL',
    defaults: { channel: 'HH', a: 33, m: 40, split: 0.5, focus: ['forest', 1.15] }, probeAnchor: 'forest',
    headline: (v) => ({ label: 'Inundated now', value: fmt(v.a1, 0) + ' km²' }),
    traces: [
      { key: 'a1', name: 'Inundated area', unit: 'km²', digits: 0, tone: 'lband' },
      { key: 'a2', name: 'Forest cleared', unit: 'km²', digits: 0, tone: 'kapton' },
      { key: 'b1', name: 'Floodplain forest HH', unit: 'dB', digits: 1, tone: 'sband' },
    ],
    events: [
      { m: 8, label: 'Sep 2020 · record fire season in the Pantanal' },
      { m: 57, label: 'Oct 2024 · Paraguay River at record lows' }, LAUNCH,
    ],
    places: [
      { anchor: 'river', label: 'Rio Paraguai' }, { anchor: 'forest', label: 'Floodplain forest' }, { anchor: 'plain', label: 'Seasonal grassland' },
      { anchor: 'frontier', label: 'Clearing frontier' }, { anchor: 'reserve', label: 'Protected forest' },
    ],
    channelNotes: {
      HH: 'Flooded forest is brightest, dry forest mid-grey, open floodwater and the river black.',
      HV: 'Forest is bright whether flooded or not. Pasture and fresh clearings are dark rectangles.',
      VV: 'Similar to HH but with a weaker double-bounce, so flooded forest stands out less.',
      INSAR: 'Fringes inside flooded forest record water-level change. S-band cannot reach the water through the canopy, so its fringes fade.',
      RGB: 'Flooded forest glows pale yellow-pink, dry forest green, pasture purple, water black.',
    },
    mechanisms: {
      surface: { where: 'The river, the lakes and open floodwater over grassland mirror the pulse away. Pasture returns a weak surface echo.',
        insight: 'Black is open water. Use its extent each pass for river-transport notices and flood maps, cloud or no cloud.' },
      volume: { where: 'Dry forest canopy and savanna scatter the pulse inside their volume.',
        insight: 'A sharp HV loss in rectangular plots is clearing. Send field teams within one 12-day cycle, before burning hides the evidence.' },
      double: { where: 'Forest standing in water: L-band passes through the leaves, reflects off the water and a trunk, and returns.',
        insight: 'Bright HH forest is flooded under the canopy. When its peak area stays below half of a normal year, issue a fire-season outlook.' },
    },
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
        { k: 'Inundated area now', v: fmt(v.a1, 0) + ' km²' },
        { k: 'Forest cleared since Jan 2020', v: fmt(v.a2, 0) + ' km²' },
        { k: 'Floodplain forest HH', v: fmt(v.b1, 1) + ' dB' },
        { k: 'Water level vs Jan 2020', v: fmtSigned(v.d1, 0) + ' cm' },
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

  /* ------------------------------------------------------------------ 03 */
  {
    id: 'fault', index: '03', name: 'Kahramanmaraş Fault', region: 'East Anatolian Fault, Türkiye', place: 'East Anatolian Fault · Kahramanmaraş, Türkiye',
    focusLine: 'Coseismic ground deformation', badge: 'L · InSAR PAIR',
    defaults: { channel: 'INSAR', a: 36, m: 38, split: 0.12, focus: ['rupture', 1] }, probeAnchor: 'town',
    headline: (v) => ({ label: 'Basin displacement', value: fmt(v.d1, 0) + ' cm' }),
    traces: [
      { key: 'd1', name: 'LOS displacement', unit: 'cm', digits: 0, tone: 'lband' },
      { key: 'a1', name: 'Damage proxy', unit: 'km²', digits: 1, tone: 'sband' },
      { key: 'b1', name: 'Fault-side town HH', unit: 'dB', digits: 1, tone: 'kapton' },
    ],
    events: [{ m: 37, label: '6 Feb 2023 · Mw 7.8 and Mw 7.5 earthquakes' }, LAUNCH],
    places: [
      { anchor: 'rupture', label: 'Surface rupture' }, { anchor: 'town', label: 'Fault-side town' }, { anchor: 'city', label: 'Urban basin' },
      { anchor: 'basin', label: 'Farmed plain' }, { anchor: 'lake', label: 'Fault-zone lake' },
    ],
    channelNotes: {
      HH: 'Towns are brightest. Slopes facing the radar are bright, slopes facing away are in shadow. Collapsed blocks turn darker.',
      HV: 'Mountain shrubland and green crops return cross-polarised signal; towns and bare fields do not.',
      VV: 'Tilled, wet fields are bright in winter; the fault-zone lake is black.',
      INSAR: 'Fringes parallel to the fault are the earthquake; rings are the sinking basin; grey along the rupture is where the ground broke.',
      RGB: 'Towns are pink-white, crops shift from purple to green through the season, mountains are grey-green.',
    },
    mechanisms: {
      surface: { where: 'Bare and tilled fields, rock, and the fault-zone lake. Their brightness follows tillage and rain.',
        insight: 'Seasonal field changes are not earthquake damage. Mask farmland before producing a damage map.' },
      volume: { where: 'Mountain shrubland and green crops. These surfaces lose coherence fastest between passes.',
        insight: 'Vegetated slopes decorrelate; rely on the longer L-band wavelength to keep fringes readable across them.' },
      double: { where: 'Towns: streets and walls form right angles that return the pulse along its own path.',
        insight: 'A loss of double-bounce inside a town marks collapsed buildings. Use it to rank search zones within one pass.' },
    },
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
        { k: 'Urban basin displacement (LOS)', v: fmt(v.d1, 0) + ' cm' },
        { k: 'Damaged built-up area (proxy)', v: fmt(v.a1, 1) + ' km²' },
        { k: 'Town HH vs Jan 2020', v: fmtSigned(v.b1 - v.b1_0, 1) + ' dB' },
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

  /* ------------------------------------------------------------------ 04 */
  {
    id: 'glacier', index: '04', name: 'Jakobshavn Glacier', region: 'Ilulissat Icefjord, Greenland', place: 'Jakobshavn Isbræ · Ilulissat Icefjord, Greenland',
    focusLine: 'Ice velocity & calving-front retreat', badge: 'L · 12-DAY PAIR',
    defaults: { channel: 'HH', a: 62, m: 66, split: 0.5, focus: ['front', 1.1] }, probeAnchor: 'melt',
    headline: (v) => ({ label: 'Surface lowering', value: fmt(v.d1, 1) + ' m' }),
    traces: [
      { key: 'd1', name: 'Surface lowering', unit: 'm', digits: 1, tone: 'lband' },
      { key: 'a1', name: 'Front area change', unit: 'km²', digits: 1, tone: 'kapton' },
      { key: 'b1', name: 'Ablation-zone HH', unit: 'dB', digits: 1, tone: 'sband' },
    ],
    events: [{ m: 19, label: 'Aug 2021 · rain recorded at the summit of the ice sheet' }, LAUNCH],
    places: [
      { anchor: 'front', label: 'Calving front' }, { anchor: 'melange', label: 'Ice mélange' }, { anchor: 'trunk', label: 'Fast trunk' },
      { anchor: 'melt', label: 'Melt zone' }, { anchor: 'town', label: 'Ilulissat' },
    ],
    channelNotes: {
      HH: 'Dry firn and mélange are bright; melting snow, melt ponds and open water are dark.',
      HV: 'Volume scattering in dry firn and crevassed ice is bright. It disappears when the snow is wet.',
      VV: 'Similar to HH; wind-roughened water in the bay shows up most clearly.',
      INSAR: 'One 12-day pair. Fringes on slow ice, grey noise on the fast trunk and on melting snow, flat colour on bedrock.',
      RGB: 'Dry firn is near white, bare ice grey-green, melting snow dark, water black.',
    },
    mechanisms: {
      surface: { where: 'Melting snow, melt ponds, bedrock and open water. Liquid water absorbs the pulse within centimetres.',
        insight: 'The dark melt line is the day’s melt extent. Feed it into the surface mass balance through cloud and polar night.' },
      volume: { where: 'Dry firn and crevassed ice: the pulse enters the snowpack and scatters off buried ice layers.',
        insight: 'Bright firn is a cold, dry snowpack. Watch how far upslope it retreats each summer: that is the melt season lengthening.' },
      double: { where: 'Icebergs and blocks of mélange in the fjord return a strong corner echo.',
        insight: 'Rigid winter mélange braces the calving front. Its break-up is the cue for calving and iceberg advisories in Disko Bay.' },
    },
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
        { k: 'Glacier area at front vs Jan 2020', v: fmtSigned(v.a1, 1) + ' km²' },
        { k: 'Surface lowering near front', v: fmt(v.d1, 1) + ' m' },
        { k: 'Ablation-zone HH now', v: fmt(v.b1, 1) + ' dB' },
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
];

export const caseById = (id: SceneId): CaseDef => CASES.find((c) => c.id === id)!;

/** Sample a monthly series at a fractional month. */
export function sampleSeries(arr: (number | null)[], m: number): number {
  const v0 = arr[0] ?? 0;
  if (!(m > 0)) return v0;
  const i = Math.floor(m), f = m - i;
  if (i >= arr.length - 1) return arr[arr.length - 1] ?? 0;
  return (arr[i] ?? 0) + ((arr[i + 1] ?? 0) - (arr[i] ?? 0)) * f;
}

export function valuesAt(series: Series, m: number): Values {
  const out = {} as Record<string, number>;
  (Object.keys(series) as SeriesKey[]).forEach((k) => {
    out[k] = sampleSeries(series[k], m);
    out[k + '_0'] = series[k][0] ?? 0;
  });
  return out as Values;
}
