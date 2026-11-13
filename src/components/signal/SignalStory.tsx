/*
 * Signal mode: a scroll-choreographed essay in four chapters — water, forest,
 * fault, ice — each read through two wavelengths, ending at a portal back to the console.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowUpRight, Radar } from 'lucide-react';
import { LiquidGlassPanel } from '../glass/LiquidGlassPanel';
import { MagneticButton } from '../glass/MagneticButton';
import { DualBandWave, type WaveVariant } from './DualBandWave';
import type { SceneId } from '../../engine/scenes';
import { useMission } from '../../state/mission';

interface Chapter {
  id: WaveVariant; n: string; word: string; sub: string; caseId: SceneId; place: string; body: string;
  lenses: { k: string; v: string; d: string }[];
}

const CHAPTERS: Chapter[] = [
  {
    id: 'water', n: '01', word: 'Water', sub: 'Specular silence and receding basins', caseId: 'caspian', place: 'Caspian Sea · Aktau',
    body: 'Still water is the quietest thing a radar can see. The pulse strikes, mirrors away and never comes home, so lakes and seas are black. When a basin recedes, the newly bared bed is rough and wet, and it answers. The line between silence and echo is the shoreline, redrawn every twelve days.',
    lenses: [
      { k: 'Calm water', v: '≈ −28 dB', d: 'A mirror. Almost nothing returns to the antenna.' },
      { k: 'Dielectric constant', v: '80 → 3', d: 'From open water to dry salt crust.' },
      { k: 'Repeat', v: '12 days', d: 'Each pass redraws the waterline.' },
    ],
  },
  {
    id: 'forest', n: '02', word: 'Forest', sub: 'Penetrating the canopy volume', caseId: 'pantanal', place: 'Pantanal · Rio Paraguai',
    body: 'At 9.4 cm the S-band wave scatters among leaves and twigs. At 24 cm the L-band wave is long enough to slip between them, reach the ground and, where the forest floor is flooded, bounce from water to trunk and return. One wavelength reads the canopy. The other reads what stands beneath it.',
    lenses: [
      { k: 'Flooded forest HH', v: '≈ −4 dB', d: 'Double-bounce: water, then trunk, then home.' },
      { k: 'Forest HV', v: '≈ −13 dB', d: 'Volume scattering. It falls sharply when trees are cleared.' },
      { k: 'Cloud and smoke', v: 'no effect', d: 'The record continues through the wet season.' },
    ],
  },
  {
    id: 'fault', n: '03', word: 'Fault', sub: 'Counting the fringes of a shifting crust', caseId: 'fault', place: 'Kahramanmaraş · East Anatolian Fault',
    body: 'Radar keeps the phase of every echo. Compare two passes, and a shift of half a wavelength turns the phase through one full circle: one fringe. At L-band a fringe is 11.9 cm of ground motion; at S-band, 4.7 cm. Count the fringes across a fault and you have measured an earthquake from orbit.',
    lenses: [
      { k: 'L-band fringe', v: '11.9 cm', d: 'Half of 23.8 cm, along the line of sight.' },
      { k: 'S-band fringe', v: '4.7 cm', d: 'The finer ruler, for smaller motion.' },
      { k: 'Grey speckle', v: 'γ → 0', d: 'Where the surface changed too much to compare.' },
    ],
  },
  {
    id: 'ice', n: '04', word: 'Ice', sub: 'Tracking the accelerating pulse of glaciers', caseId: 'glacier', place: 'Jakobshavn Isbræ · Greenland',
    body: 'Dry snow is almost transparent to radar: the pulse sinks in and scatters off buried ice, a bright return. Add liquid water and it is absorbed within centimetres. The ice sheet darkens as it melts, and the long polar night makes no difference to an instrument that carries its own light.',
    lenses: [
      { k: 'Melt onset', v: '−10 dB', d: 'Backscatter drops when the snow turns wet.' },
      { k: 'Polar night', v: 'still imaging', d: 'No sunlight needed from late November to mid-January.' },
      { k: 'Fast ice', v: 'tens of m / day', d: 'Too fast for fringes; speckle tracking takes over.' },
    ],
  },
];

function Lens({ k, v, d }: { k: string; v: string; d: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button type="button" className="text-left" aria-expanded={open} onClick={() => setOpen((o) => !o)} onPointerEnter={() => setOpen(true)} onPointerLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}>
      <LiquidGlassPanel refract radius={22} bodyClassName="px-4 py-2.5">
        <span className="tele block text-[8.5px] text-slate">{k}</span>
        <span className="etched mt-1.5 block whitespace-nowrap font-mono text-[15px] font-medium text-lens">{v}</span>
        <span className={'block overflow-hidden text-[11.5px] leading-snug text-lens/75 transition-[max-height,opacity,margin] duration-300 ' + (open ? 'mt-1.5 max-h-16 max-w-[190px] opacity-100' : 'max-h-0 max-w-[190px] opacity-0')}>{d}</span>
      </LiquidGlassPanel>
    </button>
  );
}

export default function SignalStory() {
  const scroller = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const setCase = useMission((s) => s.setCase), setMode = useMission((s) => s.setMode);
  const total = CHAPTERS.length + 1;

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (el) setProgress(el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight));
  }, []);
  useEffect(() => { onScroll(); }, [onScroll]);
  const goTo = (i: number) => {
    const el = scroller.current;
    const target = el?.querySelector<HTMLElement>('[data-ch="' + i + '"]');
    if (el && target) el.scrollTo({ top: target.offsetTop, behavior: 'smooth' });
  };
  const open = (id: SceneId) => { setCase(id); setMode('console'); };
  const current = Math.min(total - 1, Math.round(progress * (total - 1)));

  // orbital connector: an elliptical arc with one node per chapter and a travelling marker
  const arc = (k: number): [number, number] => { const a = -1.15 + 2.3 * k; return [46 - Math.cos(a) * 34, 250 + Math.sin(a) * 236]; };
  const arcPath = Array.from({ length: 41 }, (_, i) => arc(i / 40)).map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const dot = arc(progress);

  return (
    <div className="absolute inset-0">
      <div ref={scroller} onScroll={onScroll} className="scroll-thin absolute inset-0 snap-y snap-proximity overflow-y-auto overflow-x-hidden scroll-smooth">
        {CHAPTERS.map((c, i) => (
          <section key={c.id} data-ch={i} className="relative flex min-h-full snap-start items-center pb-10 pt-[96px]" style={{ paddingLeft: 'var(--gut-l)', paddingRight: 'var(--gut-r)' }} aria-labelledby={'ch-' + c.id}>
            <div className="mx-auto grid w-full max-w-[1340px] items-center gap-8 lg:grid-cols-12 lg:gap-10 lg:pr-16">
              <div className="lg:col-span-5">
                <p className="tele flex items-center gap-3 text-[10px] text-slate"><span className="text-lband">{c.n}</span><span className="h-px w-10 bg-lens/25" />{c.place}</p>
                <h2 id={'ch-' + c.id} className="etched mt-4 font-light uppercase leading-[0.86] text-lens [font-size:clamp(54px,9.4vw,148px)] [letter-spacing:0.12em] lg:[font-size:clamp(64px,6.7vw,112px)]">{c.word}</h2>
                <p className="mt-3 font-serif italic leading-tight text-lens/90 [font-size:clamp(20px,2.1vw,30px)]">{c.sub}</p>
                <p className="mt-5 max-w-[54ch] text-[14.5px] leading-relaxed text-lens/75 sm:text-[15.5px]">{c.body}</p>
                <div className="mt-6 flex flex-wrap gap-2.5">{c.lenses.map((l) => <Lens key={l.k} {...l} />)}</div>
                <div className="mt-7">
                  <MagneticButton tint="lband" onClick={() => open(c.caseId)}>Open in console <ArrowUpRight size={16} strokeWidth={1.8} /></MagneticButton>
                </div>
              </div>
              <div className="lg:col-span-7">
                <LiquidGlassPanel radius={30} bodyClassName="p-3 sm:p-4">
                  <div className="aspect-[16/10] w-full overflow-hidden rounded-[20px] bg-void/70 shadow-[inset_0_0_0_1px_rgba(244,251,255,0.08)]"><DualBandWave variant={c.id} /></div>
                  <div className="tele flex flex-wrap items-center gap-x-5 gap-y-1 px-2 pb-1 pt-3 text-[8.5px] text-slate">
                    <span className="flex items-center gap-2"><i className="h-[3px] w-5 rounded-full bg-lband" />L-band · 1.25 GHz · 24 cm</span>
                    <span className="flex items-center gap-2"><i className="h-[3px] w-5 rounded-full bg-sband" />S-band · 3.2 GHz · 9.4 cm</span>
                    <span className="flex items-center gap-2"><i className="h-[3px] w-5 rounded-full bg-kapton" />echo to the antenna</span>
                  </div>
                </LiquidGlassPanel>
              </div>
            </div>
          </section>
        ))}

        <section data-ch={CHAPTERS.length} className="relative flex min-h-full snap-start flex-col items-center justify-center gap-9 pb-16 pt-[96px] text-center" style={{ paddingLeft: 'var(--gut-l)', paddingRight: 'var(--gut-r)' }}>
          <p className="tele text-[10px] text-slate">Coda</p>
          <h2 className="max-w-[16ch] font-serif italic leading-[1.02] text-lens [font-size:clamp(40px,6.4vw,104px)]">Earth never stands still. NISAR measures the dance.</h2>
          <button type="button" onClick={() => setMode('console')} aria-label="Return to the live console" className="group relative grid h-[168px] w-[168px] place-items-center rounded-full">
            <span className="absolute inset-0 rounded-full border border-lband/40 [animation:lock-ring_2.6s_ease-out_infinite]" />
            <span className="absolute inset-0 rounded-full border border-sband/40 [animation:lock-ring_2.6s_1.3s_ease-out_infinite]" />
            <LiquidGlassPanel refract radius={9999} className="h-[132px] w-[132px] transition-transform duration-300 group-hover:scale-105" bodyClassName="flex h-full flex-col items-center justify-center gap-2">
              <Radar size={24} strokeWidth={1.5} className="text-lband" />
              <span className="tele text-[9px] leading-tight text-lens">Return to<br />live console</span>
            </LiquidGlassPanel>
          </button>
          <p className="max-w-[60ch] text-[12px] leading-relaxed text-slate">TerraWaltz is a demonstration built for the NASA Space Apps Challenge. Scenes, telemetry and figures are simulated; they are not NISAR measurements.</p>
        </section>
      </div>

      {/* orbital connector */}
      <nav aria-label="Chapters" className="pointer-events-none absolute right-2 top-1/2 hidden h-[500px] w-[72px] -translate-y-1/2 lg:block">
        <svg viewBox="0 0 72 500" className="h-full w-full overflow-visible" aria-hidden="true">
          <path d={arcPath} fill="none" stroke="#F4FBFF" strokeOpacity="0.2" strokeWidth="1" />
          <path d={arcPath} fill="none" stroke="#00F0FF" strokeWidth="1.4" pathLength={1} strokeDasharray={progress.toFixed(4) + ' 1'} />
          <circle cx={dot[0]} cy={dot[1]} r="4.5" fill="#00F0FF" /><circle cx={dot[0]} cy={dot[1]} r="9" fill="none" stroke="#00F0FF" strokeOpacity="0.4" />
        </svg>
        {Array.from({ length: total }, (_, i) => {
          const p = arc(i / (total - 1));
          return (
            <button key={i} type="button" onClick={() => goTo(i)} aria-label={i < CHAPTERS.length ? 'Chapter ' + CHAPTERS[i].n + ': ' + CHAPTERS[i].word : 'Coda'} aria-current={current === i ? 'step' : undefined}
              className="pointer-events-auto absolute flex h-6 -translate-y-1/2 items-center gap-2" style={{ left: p[0] - 3.5, top: p[1] }}>
              <span className={'h-[7px] w-[7px] rounded-full ' + (current === i ? 'bg-lens' : 'bg-lens/35')} />
              <span className={'tele text-[8px] ' + (current === i ? 'text-lens' : 'text-slate/70')}>{i < CHAPTERS.length ? CHAPTERS[i].n : '∞'}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
