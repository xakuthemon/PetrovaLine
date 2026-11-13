/*
 * The split-comparison SAR viewport: a full-bleed radar canvas with a Liquid Glass
 * laser divider, before/after pills, a cursor readout, scale, compass and a
 * coherence gauge. All pixels come from MapEngine; this component wires it to
 * the mission state.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronsLeftRight, Minus, Plus, Maximize } from 'lucide-react';
import { LiquidGlassPanel } from '../glass/LiquidGlassPanel';
import { MapEngine, type ProbeInfo } from '../../engine/mapEngine';
import { BANDS } from '../../engine/physics';
import { POL, RAINBOW } from '../../engine/render';
import { clamp, fmt, fmtSigned, monthLabel } from '../../engine/util';
import { getScene } from '../../engine/scenes';
import { caseById } from '../../data/cases';
import { tOf, useMission } from '../../state/mission';

const coord = (lat: number, lon: number) =>
  Math.abs(lat).toFixed(3) + '°' + (lat < 0 ? 'S' : 'N') + '  ' + Math.abs(lon).toFixed(3) + '°' + (lon < 0 ? 'W' : 'E');

const RAINBOW_CSS = (() => {
  const stops: string[] = [];
  for (let k = 0; k <= 12; k++) {
    const q = Math.min(255, Math.round((k / 12) * 255)) * 3;
    stops.push(`rgb(${RAINBOW[q]},${RAINBOW[q + 1]},${RAINBOW[q + 2]}) ${((k / 12) * 100).toFixed(1)}%`);
  }
  return 'linear-gradient(90deg,' + stops.join(',') + ')';
})();

function ProbeChip({ info, x, y, w, h }: { info: ProbeInfo; x: number; y: number; w: number; h: number }) {
  const sensor = useMission((s) => s.sensor), channel = useMission((s) => s.channel), band = useMission((s) => s.band);
  const a = useMission((s) => s.a), m = useMission((s) => s.m);
  const left = x + 250 > w ? x - 236 : x + 18, top = clamp(y + 18, 8, h - 150);
  const pol = channel === 'RGB' || channel === 'INSAR' ? 'HH' : channel;
  const rows: [string, string][] = [];
  let title = info.cls;
  if (sensor === 'optical') {
    if (info.light < 0.05) title = 'Darkness · no sunlight';
    else if (info.cloud > 0.5) title = 'Cloud · surface hidden';
    else if (info.cloud > 0.15) title = 'Thin cloud · blurred';
    rows.push(['Radar would see', info.cls]);
  } else if (channel === 'INSAR' && info.side === 'B') {
    const ok = info.coh > 0.3;
    rows.push(['LOS displacement', ok ? fmtSigned(info.disp, 1) + ' cm' : 'not measurable']);
    rows.push(['Coherence', fmt(info.coh, 2)]);
    if (ok) rows.push(['Fringes', fmt(Math.abs(info.disp) / BANDS[band].fringe, 1)]);
  } else {
    rows.push(['σ⁰ ' + pol + ' A', fmt(info.sA[pol], 1) + ' dB']);
    rows.push(['σ⁰ ' + pol + ' B', fmt(info.sB[pol], 1) + ' dB']);
    rows.push(['Δ A→B', fmtSigned(info.sB[pol] - info.sA[pol], 1) + ' dB']);
  }
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 w-[218px]" style={{ transform: `translate3d(${left}px, ${top}px, 0)` }}>
      <LiquidGlassPanel depth="deep" radius={18} bodyClassName="px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className={'tele text-[8.5px] ' + (info.side === 'A' ? 'text-slate' : 'text-lband')}>{info.side} · {monthLabel(info.side === 'A' ? a : Math.floor(m + 1e-6))}</span>
          <span className="font-mono text-[9.5px] text-slate">{coord(info.lat, info.lon)}</span>
        </div>
        <div className="mt-1 text-[12.5px] font-semibold leading-tight text-lens">{title}</div>
        <div className="mt-1.5 space-y-0.5">
          {rows.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 text-[11px]"><span className="text-slate">{k}</span><span className="etched font-mono text-lens">{v}</span></div>
          ))}
        </div>
        <div className="tele mt-1.5 text-[7.5px] text-slate/80">Click to decode this pixel</div>
      </LiquidGlassPanel>
    </div>
  );
}

function Legend() {
  const sensor = useMission((s) => s.sensor), channel = useMission((s) => s.channel), band = useMission((s) => s.band);
  const sky = useMission((s) => s.stats.sky), clouds = useMission((s) => s.clouds);
  if (sensor === 'optical') {
    const bits = !sky ? '' : sky.light < 0.05 ? 'Polar night · no sunlight' : clouds ? 'Cloud cover ' + Math.round(sky.cover * 100) + ' %' + (sky.smoke > 0.2 ? ' · smoke' : '') : 'Clouds removed';
    return <div><div className="tele text-[8.5px] text-slate">Optical · reflected sunlight</div><div className="mt-1 text-[11px] text-lens">{bits}</div></div>;
  }
  if (channel === 'INSAR') {
    return (
      <div>
        <div className="tele text-[8.5px] text-slate">Wrapped phase · {BANDS[band].name}</div>
        <div className="mt-1.5 h-1.5 rounded-full" style={{ background: RAINBOW_CSS }} />
        <div className="mt-1 flex justify-between font-mono text-[9px] text-slate"><span>0</span><span>one cycle = {BANDS[band].fringe} cm</span></div>
      </div>
    );
  }
  if (channel === 'RGB') {
    return (
      <div>
        <div className="tele text-[8.5px] text-slate">False-colour composite</div>
        <div className="mt-1.5 flex gap-3 font-mono text-[10px] text-lens">
          {[['#ff5a6e', 'HH'], ['#4ade80', 'HV'], ['#60a5fa', 'VV']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>)}
        </div>
      </div>
    );
  }
  const pd = POL[channel];
  return (
    <div>
      <div className="tele text-[8.5px] text-slate">σ⁰ {channel} · {BANDS[band].name}</div>
      <div className="mt-1.5 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg,#000,#f4fbff)' }} />
      <div className="mt-1 flex justify-between font-mono text-[9px] text-slate"><span>{pd.lo} dB</span><span>{pd.hi} dB</span></div>
    </div>
  );
}

export function SARComparisonViewport({ ready }: { ready: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lensRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<MapEngine | null>(null);
  const [hover, setHover] = useState<{ info: ProbeInfo; x: number; y: number } | null>(null);
  const [scale, setScale] = useState({ km: 0.05, zoom: 1 });
  const [size, setSize] = useState({ w: 1, h: 1 });

  const caseId = useMission((s) => s.caseId), retarget = useMission((s) => s.retarget);
  const a = useMission((s) => s.a), m = useMission((s) => s.m);
  const sensor = useMission((s) => s.sensor), channel = useMission((s) => s.channel), band = useMission((s) => s.band);
  const clouds = useMission((s) => s.clouds), change = useMission((s) => s.change), mechanism = useMission((s) => s.mechanism);
  const split = useMission((s) => s.split), setSplit = useMission((s) => s.setSplit);
  const meanCoh = useMission((s) => s.stats.meanCoh);
  const def = caseById(caseId);

  const drawLens = useCallback(() => {
    const e = engine.current, c = lensRef.current;
    if (!e || !c) return;
    const ctx = c.getContext('2d');
    if (ctx) e.drawLens(ctx, e.splitX(), e.size().h / 2, 40, 2.2);
  }, []);

  useEffect(() => {
    const e = new MapEngine(canvasRef.current!, {
      onProbe: (info, x, y) => setHover(info ? { info, x, y } : null),
      onPick: (info) => { const st = useMission.getState(); st.setPinned(info); if (!st.drawerOpen) st.toggle('drawerOpen'); },
      onStats: (s) => useMission.getState().setStats(s),
      onDraw: drawLens,
      onView: (km, zoom) => setScale((p) => (Math.abs(p.km - km) / km > 0.01 ? { km, zoom } : p)),
    });
    engine.current = e;
    const ro = new ResizeObserver(() => { const s = e.size(); setSize({ w: s.w, h: s.h }); });
    ro.observe(canvasRef.current!);
    return () => { ro.disconnect(); e.destroy(); engine.current = null; };
  }, [drawLens]);

  // retarget on case change
  useEffect(() => {
    const e = engine.current;
    if (!e || !ready) return;
    const d = caseById(caseId);
    e.setCase(caseId, d.places);
    const t = window.setTimeout(() => e.focusAnchor(d.defaults.focus[0], d.defaults.focus[1]), 80);
    return () => window.clearTimeout(t);
  }, [caseId, ready]);

  // every control flows into the engine here
  useEffect(() => {
    const e = engine.current;
    if (!e || !ready) return;
    e.update({ tA: tOf(a), tB: tOf(m), sensor, channel, band, clouds, change, grid: true, places: true, mechanism });
    const st = useMission.getState();
    st.setProbe(e.infoAtAnchor(caseById(caseId).probeAnchor));
    if (st.pinned) st.setPinned(e.infoAtScene(st.pinned.x, st.pinned.y, st.pinned.side));
  }, [caseId, ready, a, m, sensor, channel, band, clouds, change, mechanism]);

  useEffect(() => { engine.current?.setSplit(split); }, [split]);

  /* ---- divider ---------------------------------------------------------- */
  const dragging = useRef(false);
  const fromEvent = (ev: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    setSplit((ev.clientX - r.left) / r.width);
  };
  const insar = sensor === 'sar' && channel === 'INSAR';
  const kind = sensor === 'optical' ? 'Optical' : channel === 'RGB' ? 'RGB' : insar ? 'Interferogram' : 'SAR ' + channel;
  const scene = ready ? getScene(caseId) : null;

  // scale bar: a round number of kilometres between 56 and 120 px
  const opts = [0.25, 0.5, 1, 2, 5, 10, 20];
  const L = opts.find((q) => q / scale.km >= 56) ?? 20;

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden bg-[#020305]">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        role="img" aria-label={'Simulated radar scene: ' + def.place + '. Drag to pan, scroll to zoom, hover for pixel values.'} />

      {/* retarget: arc sweep and lock-on pulse */}
      <div key={retarget} className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2">
        <span className="absolute inset-0 rounded-full border border-lband/70" style={{ animation: 'lock-ring 1100ms cubic-bezier(.2,.7,.2,1) forwards' }} />
        <span className="absolute inset-[60px] rounded-full border border-lens/60" style={{ animation: 'lock-ring 1100ms 140ms cubic-bezier(.2,.7,.2,1) forwards', opacity: 0 }} />
        <svg viewBox="0 0 100 100" className="absolute inset-0" style={{ animation: 'sweep-arc 1200ms cubic-bezier(.3,.6,.2,1) forwards', opacity: 0 }}>
          <path d="M50 4 A46 46 0 0 1 96 50" fill="none" stroke="#F5B041" strokeWidth="0.8" strokeLinecap="round" />
        </svg>
      </div>

      {/* laser divider with the glass lens handle */}
      <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: split * 100 + '%' }}>
        <div className="laser absolute inset-y-0 -left-px w-[2px]" />
        <div className="pointer-events-auto absolute inset-y-0 -left-4 w-8 cursor-ew-resize touch-none"
          onPointerDown={(ev) => { dragging.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); fromEvent(ev); }}
          onPointerMove={(ev) => { if (dragging.current) fromEvent(ev); }}
          onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}
          onDoubleClick={() => setSplit(0.5)} />
        <div role="slider" tabIndex={0} aria-label="Before and after divider" aria-orientation="horizontal" aria-valuemin={2} aria-valuemax={98} aria-valuenow={Math.round(split * 100)}
          className="pointer-events-auto absolute top-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none rounded-full"
          onKeyDown={(ev) => {
            const st = ev.shiftKey ? 0.1 : 0.02;
            if (ev.key === 'ArrowLeft') { setSplit(split - st); ev.preventDefault(); }
            else if (ev.key === 'ArrowRight') { setSplit(split + st); ev.preventDefault(); }
            else if (ev.key === 'Home') { setSplit(0.02); ev.preventDefault(); }
            else if (ev.key === 'End') { setSplit(0.98); ev.preventDefault(); }
          }}
          onPointerDown={(ev) => { dragging.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); }}
          onPointerMove={(ev) => { if (dragging.current) fromEvent(ev); }}
          onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
          <LiquidGlassPanel refract radius={9999} bodyClassName="flex h-[92px] w-[52px] flex-col items-center justify-center gap-1.5">
            <canvas ref={lensRef} width={88} height={88} className="h-10 w-10 rounded-full shadow-[inset_0_0_0_1px_rgba(255,255,255,0.5),0_0_0_1px_rgba(0,0,0,0.5)]" aria-hidden="true" />
            <ChevronsLeftRight size={16} strokeWidth={1.8} className="text-lens" />
          </LiquidGlassPanel>
        </div>
        {/* temporal pills */}
        <div className="absolute right-3 top-[calc(50%-92px)] whitespace-nowrap">
          <LiquidGlassPanel depth="deep" radius={9999} bodyClassName="flex h-7 items-center gap-2 pl-1 pr-3">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-lens/85 font-mono text-[10px] font-semibold text-void">A</span>
            <span className="etched font-mono text-[11px] text-lens">{monthLabel(a)}</span>
            <span className="tele hidden text-[8px] text-slate sm:inline">{insar ? 'Reference' : kind}</span>
          </LiquidGlassPanel>
        </div>
        <div className="absolute left-3 top-[calc(50%-92px)] whitespace-nowrap">
          <LiquidGlassPanel depth="deep" radius={9999} bodyClassName="flex h-7 items-center gap-2 pl-1 pr-3">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-lband font-mono text-[10px] font-semibold text-void">B</span>
            <span className="etched font-mono text-[11px] text-lens">{monthLabel(Math.floor(m + 1e-6))}</span>
            <span className="tele hidden text-[8px] text-slate sm:inline">{insar && scene?.insar === 'repeat12' ? '12-day pair' : kind}</span>
          </LiquidGlassPanel>
        </div>
      </div>

      {hover && <ProbeChip info={hover.info} x={hover.x} y={hover.y} w={size.w} h={size.h} />}

      {/* instrument cluster: zoom, legend, scale, compass, coherence */}
      <div className="absolute z-10 hidden w-[206px] sm:block" style={{ left: 'var(--gut-l)', bottom: 148 }}>
        <LiquidGlassPanel depth="deep" radius={22} bodyClassName="space-y-3 p-3.5">
          <Legend />
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="h-1.5 border-x border-b border-lens/90" style={{ width: Math.round(L / scale.km) }} />
              <div className="mt-1 font-mono text-[9.5px] text-lens">{L < 1 ? L * 1000 + ' m' : L + ' km'}</div>
            </div>
            <svg viewBox="0 0 32 32" className="h-8 w-8 flex-none" role="img" aria-label="North is up">
              <circle cx="16" cy="16" r="13.5" fill="none" stroke="#F4FBFF" strokeOpacity="0.3" />
              <path d="M16 4 L19.5 16 L16 14 L12.5 16 Z" fill="#00F0FF" />
              <path d="M16 28 L19.5 16 L16 18 L12.5 16 Z" fill="#F4FBFF" fillOpacity="0.35" />
              <text x="16" y="3.4" textAnchor="middle" fontSize="5" fill="#F4FBFF" fontFamily="'JetBrains Mono Variable', monospace">N</text>
            </svg>
          </div>
          <div className="flex items-center gap-3">
            <svg viewBox="0 0 44 26" className="h-[26px] w-11 flex-none" aria-hidden="true">
              <path d="M4 22 A18 18 0 0 1 40 22" fill="none" stroke="#F4FBFF" strokeOpacity="0.18" strokeWidth="3" strokeLinecap="round" />
              <path d="M4 22 A18 18 0 0 1 40 22" fill="none" stroke={insar ? '#FF2A85' : '#00F0FF'} strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${clamp(meanCoh, 0, 1) * 100} 100`} />
            </svg>
            <div className="leading-none">
              <div className="tele text-[8px] text-slate">Coherence A→B</div>
              <div className="etched mt-1.5 font-mono text-[13px] text-lens">γ {fmt(meanCoh, 2)}</div>
            </div>
          </div>
          <div className="flex gap-1.5">
            {([['Zoom in', Plus, () => engine.current?.zoomBy(1.5)], ['Zoom out', Minus, () => engine.current?.zoomBy(1 / 1.5)], ['Whole scene', Maximize, () => engine.current?.resetView()]] as const).map(([label, Icon, fn]) => (
              <button key={label} type="button" aria-label={label} onClick={fn}
                className="grid h-8 flex-1 place-items-center rounded-full bg-lens/[0.07] text-lens shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition-colors hover:bg-lens/[0.16]">
                <Icon size={14} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </LiquidGlassPanel>
      </div>

      {!ready && (
        <div className="absolute inset-0 z-20 grid place-items-center">
          <LiquidGlassPanel depth="deep" radius={9999} bodyClassName="flex items-center gap-3 px-5 py-3">
            <span className="h-2 w-2 animate-ping rounded-full bg-lband" />
            <span className="tele text-[10px] text-lens">Locking on · {def.name}</span>
          </LiquidGlassPanel>
        </div>
      )}
    </div>
  );
}
