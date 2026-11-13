/*
 * TerraWaltz — mission brief builder (Markdown, JSON, plain text).
 */
import { monthLabel } from './util';
import { BANDS, type BandId } from './physics';
import type { Channel } from './mapEngine';
import type { CaseDef, Values } from '../data/cases';

export type BriefFormat = 'md' | 'json' | 'txt';
export type BriefSection = 'figures' | 'physics' | 'drivers' | 'impacts' | 'actions' | 'monitor';
export const SECTIONS: { id: BriefSection; label: string }[] = [
  { id: 'figures', label: 'Key figures' },
  { id: 'physics', label: 'Radar physics' },
  { id: 'drivers', label: 'Physical drivers' },
  { id: 'impacts', label: 'Community & ecosystem impact' },
  { id: 'actions', label: 'Recommended actions' },
  { id: 'monitor', label: 'Monitoring request' },
];

export interface BriefInput {
  def: CaseDef;
  values: Values;
  a: number;
  m: number;
  channel: Channel;
  band: BandId;
  sections: Record<BriefSection, boolean>;
  analyst: string;
}

const CAVEAT = 'Figures come from a procedurally simulated demonstration scenario, not from NISAR measurements. Replace them with mission products before any decision.';

export function briefFilename(i: BriefInput, f: BriefFormat): string {
  return 'terrawaltz-brief-' + i.def.id + '-' + monthLabel(Math.floor(i.m + 1e-6)).toLowerCase().replace(' ', '-') + '.' + f;
}

function model(i: BriefInput) {
  const b = BANDS[i.band], s = i.sections, d = i.def;
  return {
    title: 'Mission brief: ' + d.name,
    case: d.index,
    location: d.place,
    focus: d.focusLine,
    alert: d.brief.levelLabel,
    window: { from: monthLabel(i.a), to: monthLabel(Math.floor(i.m + 1e-6)) },
    instrument: { channel: i.channel, band: b.name, frequencyGHz: b.ghz, wavelengthCm: b.lambda },
    analyst: i.analyst.trim() || undefined,
    summary: d.brief.headline + '.',
    figures: s.figures ? d.brief.figures(i.values) : undefined,
    physics: s.physics ? {
      channel: d.channelNotes[i.channel],
      surface: d.mechanisms.surface.where,
      volume: d.mechanisms.volume.where,
      doubleBounce: d.mechanisms.double.where,
    } : undefined,
    drivers: s.drivers ? d.drivers.map((x) => ({ driver: x.t, confidence: x.conf, detail: x.d })) : undefined,
    impacts: s.impacts ? d.impacts.map((x) => ({ impact: x.t, detail: x.d })) : undefined,
    actions: s.actions ? d.brief.actions : undefined,
    monitoring: s.monitor ? d.brief.monitor : undefined,
    source: 'TerraWaltz simulated NISAR-like scenario',
    caveat: CAVEAT,
  };
}

export function buildBrief(i: BriefInput, format: BriefFormat): string {
  const b = model(i);
  if (format === 'json') return JSON.stringify(b, null, 2);
  const md = format === 'md';
  const L: string[] = [];
  const h1 = (t: string) => L.push(md ? '# ' + t : t.toUpperCase(), md ? '' : '='.repeat(t.length), '');
  const h2 = (t: string) => L.push('', md ? '## ' + t : t.toUpperCase(), md ? '' : '-'.repeat(t.length));
  const kv = (k: string, v: string) => L.push(md ? '**' + k + ':** ' + v : k + ': ' + v);
  const strong = (t: string) => (md ? '**' + t + '**' : t);

  h1(b.title);
  kv('Case', b.case + ' · ' + b.focus);
  kv('Location', b.location);
  kv('Alert level', b.alert);
  kv('Observation window', b.window.from + ' to ' + b.window.to);
  kv('Instrument', b.instrument.channel + ' · ' + b.instrument.band + ' ' + b.instrument.frequencyGHz + ' GHz (' + b.instrument.wavelengthCm + ' cm)');
  if (b.analyst) kv('Prepared by', b.analyst);
  kv('Source', b.source);
  h2('Summary');
  L.push(b.summary);
  if (b.figures) { h2('Key figures'); b.figures.forEach((f) => L.push('- ' + f.k + ': ' + f.v)); }
  if (b.physics) {
    h2('Radar physics');
    L.push('- ' + strong('This channel.') + ' ' + b.physics.channel);
    L.push('- ' + strong('Surface scattering.') + ' ' + b.physics.surface);
    L.push('- ' + strong('Volume scattering.') + ' ' + b.physics.volume);
    L.push('- ' + strong('Double-bounce.') + ' ' + b.physics.doubleBounce);
  }
  if (b.drivers) { h2('Physical drivers (hypothesis)'); b.drivers.forEach((x) => L.push('- ' + strong(x.driver) + ' (' + x.confidence.toLowerCase() + ' confidence). ' + x.detail)); }
  if (b.impacts) { h2('Community and ecosystem impact'); b.impacts.forEach((x) => L.push('- ' + strong(x.impact + '.') + ' ' + x.detail)); }
  if (b.actions) { h2('Recommended actions'); b.actions.forEach((a, k) => L.push(k + 1 + '. ' + a)); }
  if (b.monitoring) { h2('Monitoring request'); L.push(b.monitoring); }
  L.push('', md ? '---' : '-'.repeat(40), 'Caveat: ' + b.caveat);
  return L.join('\n');
}

export const MIME: Record<BriefFormat, string> = { md: 'text/markdown', json: 'application/json', txt: 'text/plain' };
