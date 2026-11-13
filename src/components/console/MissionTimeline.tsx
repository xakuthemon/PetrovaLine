/*
 * Bottom-docked temporal scrubber, 2020–2026. Three spline traces per case with
 * refractive fills, event markers, the baseline flag (A) and a draggable glass
 * playhead lens that drives date B for the whole console.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Flag, Pause, Play } from 'lucide-react';
import { LiquidGlassPanel } from '../glass/LiquidGlassPanel';
import { M_MAX, clamp, fmt, monthLabel } from '../../engine/util';
import type { Series } from '../../engine/scenes';
import { caseById, valuesAt, type Tone } from '../../data/cases';
import { useMission } from '../../state/mission';

const HEX: Record<Tone, string> = { lband: '#00F0FF', sband: '#FF2A85', kapton: '#F5B041' };
const H = 78, PAD = { l: 10, r: 10, t: 8, b: 17 };

export function MissionTimeline({ series }: { series: Series | null }) {
  const caseId = useMission((s) => s.caseId), a = useMission((s) => s.a), m = useMission((s) => s.m);
  const playing = useMission((s) => s.playing), speed = useMission((s) => s.speed);
  const { setM, setA, setPlaying, setSpeed } = useMission.getState();
  const def = caseById(caseId);
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [tip, setTip] = useState<{ x: number; label: string } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(160, el.clientWidth)));
    ro.observe(el);
    setW(Math.max(160, el.clientWidth));
    return () => ro.disconnect();
  }, []);

  const xOf = (mm: number) => PAD.l + (mm / M_MAX) * (w - PAD.l - PAD.r);
  const mAt = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    return clamp(Math.round(((clientX - r.left - PAD.l) / (w - PAD.l - PAD.r)) * M_MAX), 0, M_MAX);
  };

  const paths = useMemo(() => {
    if (!series) return [];
    return def.traces.map((tr) => {
      const arr = series[tr.key].map((v) => v ?? 0);
      const lo = Math.min(...arr), hi = Math.max(...arr), span = hi - lo || 1;
      const yOf = (v: number) => PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b);
      let d = '';
      arr.forEach((v, i) => { d += (i ? 'L' : 'M') + (PAD.l + (i / M_MAX) * (w - PAD.l - PAD.r)).toFixed(1) + ' ' + yOf(v).toFixed(1); });
      const area = d + 'L' + (w - PAD.r).toFixed(1) + ' ' + (H - PAD.b) + 'L' + PAD.l + ' ' + (H - PAD.b) + 'Z';
      return { tr, d, area, yOf, arr };
    });
  }, [series, def, w]);

  const values = series ? valuesAt(series, m) : null;
  const drag = useRef(false);
  const scrub = (ev: React.PointerEvent) => { setPlaying(false); setM(mAt(ev.clientX)); };
  const month = Math.floor(m + 1e-6);

  return (
    <div className="absolute inset-x-0 bottom-3.5 z-30" style={{ paddingLeft: 'var(--gut-l)', paddingRight: 'var(--gut-r)' }}>
      <LiquidGlassPanel depth="deep" radius={28} bodyClassName="flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4">
        {/* transport */}
        <div className="flex flex-none flex-col items-center gap-1.5">
          <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause the timeline' : 'Play the timeline'} aria-pressed={playing}
            className="relative grid h-11 w-11 place-items-center rounded-full text-lens transition-transform active:scale-95"
            style={{ background: 'radial-gradient(120% 140% at 30% 0%, rgba(0,240,255,0.45), rgba(0,240,255,0.10) 60%)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65), inset 0 -6px 12px -6px rgba(0,240,255,0.55), 0 0 0 0.5px rgba(0,240,255,0.5), 0 8px 20px -10px rgba(0,240,255,0.8)' }}>
            {playing ? <Pause size={17} strokeWidth={2} /> : <Play size={17} strokeWidth={2} className="translate-x-px" />}
          </button>
          <button type="button" onClick={() => setSpeed(speed === 1 ? 2 : speed === 2 ? 0.5 : 1)} aria-label={'Playback speed ' + speed + '×. Change speed'}
            className="tele hidden rounded-full px-2 py-0.5 text-[8.5px] text-slate transition-colors hover:text-lens sm:block">{speed}×</button>
        </div>

        {/* traces + playhead */}
        <div ref={box} className="relative min-w-0 flex-1 touch-none select-none" style={{ height: H }}
          onPointerDown={(ev) => { drag.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); scrub(ev); }}
          onPointerMove={(ev) => { if (drag.current) scrub(ev); }}
          onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }}>
          <svg width={w} height={H} className="absolute inset-0 overflow-visible" aria-hidden="true">
            <defs>
              {def.traces.map((tr) => (
                <linearGradient key={tr.key} id={'tl-' + tr.key} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" stopColor={HEX[tr.tone]} stopOpacity="0.28" /><stop offset="1" stopColor={HEX[tr.tone]} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {Array.from({ length: 7 }, (_, y) => (
              <g key={y}>
                <line x1={xOf(y * 12)} x2={xOf(y * 12)} y1={PAD.t} y2={H - PAD.b} stroke="#F4FBFF" strokeOpacity="0.09" />
                {(w >= 300 || y % 2 === 0) && <text x={xOf(y * 12)} y={H - 4} textAnchor={y === 0 ? 'start' : 'middle'} fontSize="9" fill="#7C8D9E" fontFamily="'JetBrains Mono Variable', monospace">{w >= 300 ? 2020 + y : "'" + (20 + y)}</text>}
              </g>
            ))}
            {paths.map((p) => <path key={'a' + p.tr.key} d={p.area} fill={'url(#tl-' + p.tr.key + ')'} />)}
            {paths.map((p) => <path key={p.tr.key} d={p.d} fill="none" stroke={HEX[p.tr.tone]} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 4px ' + HEX[p.tr.tone] + '88)' }} />)}
            {values && paths.map((p) => <circle key={'d' + p.tr.key} cx={xOf(m)} cy={p.yOf(values[p.tr.key])} r="3.2" fill={HEX[p.tr.tone]} stroke="#04060A" strokeWidth="1.5" />)}
            {/* baseline flag */}
            <g transform={`translate(${xOf(a)},0)`}>
              <line y1={PAD.t - 4} y2={H - PAD.b} stroke="#F4FBFF" strokeOpacity="0.55" strokeDasharray="2 3" />
              <rect x="-6.5" y={PAD.t - 8} width="13" height="12" rx="3" fill="#F4FBFF" fillOpacity="0.9" />
              <text y={PAD.t + 1} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#04060A" fontFamily="'JetBrains Mono Variable', monospace">A</text>
            </g>
          </svg>
          {/* events */}
          {def.events.map((ev) => (
            <button key={ev.m} type="button" aria-label={ev.label} onPointerDown={(e) => e.stopPropagation()} onClick={() => { setPlaying(false); setM(ev.m); }}
              onPointerEnter={() => setTip({ x: xOf(ev.m), label: ev.label })} onPointerLeave={() => setTip(null)} onFocus={() => setTip({ x: xOf(ev.m), label: ev.label })} onBlur={() => setTip(null)}
              className="absolute top-0 h-4 w-4 -translate-x-1/2" style={{ left: xOf(ev.m) }}>
              <span className={'absolute left-1/2 top-[3px] h-2 w-2 -translate-x-1/2 rotate-45 rounded-[2px] ' + (ev.mission ? 'bg-lband' : 'bg-kapton')} />
            </button>
          ))}
          {tip && (
            <div className="pointer-events-none absolute bottom-full z-10 mb-2 w-max max-w-[260px] -translate-x-1/2 rounded-xl bg-umbra/95 px-3 py-1.5 text-[11.5px] leading-snug text-lens shadow-[0_0_0_1px_rgba(244,251,255,0.2)]" style={{ left: clamp(tip.x, 130, w - 130) }}>{tip.label}</div>
          )}
          {/* playhead lens */}
          <div role="slider" tabIndex={0} aria-label="Date B" aria-valuemin={0} aria-valuemax={M_MAX} aria-valuenow={month} aria-valuetext={monthLabel(month)}
            onKeyDown={(ev) => {
              const st = ev.shiftKey ? 12 : 1;
              if (ev.key === 'ArrowLeft') { setPlaying(false); setM(month - st); ev.preventDefault(); }
              else if (ev.key === 'ArrowRight') { setPlaying(false); setM(month + st); ev.preventDefault(); }
              else if (ev.key === 'Home') { setM(0); ev.preventDefault(); }
              else if (ev.key === 'End') { setM(M_MAX); ev.preventDefault(); }
            }}
            className="lg absolute top-0 w-[18px] -translate-x-1/2 cursor-ew-resize" data-refract="true"
            style={{ left: xOf(m), height: H - PAD.b + 4, ['--lg-r' as string]: '9px', background: 'linear-gradient(180deg, rgba(244,251,255,0.22), rgba(0,240,255,0.10))' }}>
            <span className="absolute left-1/2 top-1 h-[calc(100%-8px)] w-px -translate-x-1/2 bg-lens/90" />
          </div>
        </div>

        {/* readout */}
        <div className="flex flex-none flex-col items-end gap-1">
          <div className="flex items-center gap-2">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-lband font-mono text-[10px] font-semibold text-void">B</span>
            <span className="etched whitespace-nowrap font-mono text-[16px] font-medium text-lens sm:text-[19px]">{monthLabel(month)}</span>
          </div>
          <button type="button" onClick={() => setA(month === a ? 0 : month)} disabled={month === a && a === 0}
            className="tele flex items-center gap-1.5 text-[8.5px] text-slate transition-colors hover:text-lens disabled:opacity-40">
            <Flag size={11} strokeWidth={1.8} /> {month === a && a !== 0 ? 'Reset A to Jan 2020' : 'Set A here'}
          </button>
        </div>
        {values && (
          <div className="hidden w-[232px] flex-none flex-col gap-1.5 border-l border-lens/12 pl-4 xl:flex">
            {def.traces.map((tr) => (
              <div key={tr.key} className="flex items-center gap-2 text-[11px]">
                <span className="h-[3px] w-3 flex-none rounded-full" style={{ background: HEX[tr.tone], boxShadow: '0 0 6px ' + HEX[tr.tone] }} />
                <span className="min-w-0 flex-1 truncate text-slate">{tr.name}</span>
                <span className="etched font-mono text-lens">{fmt(values[tr.key], tr.digits)}<span className="ml-1 text-[9px] text-slate">{tr.unit}</span></span>
              </div>
            ))}
          </div>
        )}
      </LiquidGlassPanel>
    </div>
  );
}
