/*
 * The radar map: before / after split with a draggable divider, a small hover
 * readout, zoom and a one-line legend. Pixels come from MapEngine.
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronsLeftRight, Maximize, Minus, Plus } from 'lucide-react';
import { MapEngine, type ProbeInfo } from '../../engine/mapEngine';
import { BANDS } from '../../engine/physics';
import { POL, RAINBOW } from '../../engine/render';
import { clamp, fmt, fmtSigned, monthLabel } from '../../engine/util';
import { caseById } from '../../data/cases';
import { tOf, useMission } from '../../state/mission';
import { Mark } from '../../brand/Logo';

const PHASE_CSS = (() => {
  const stops: string[] = [];
  for (let k = 0; k <= 12; k++) {
    const q = Math.min(255, Math.round((k / 12) * 255)) * 3;
    stops.push(`rgb(${RAINBOW[q]},${RAINBOW[q + 1]},${RAINBOW[q + 2]}) ${((k / 12) * 100).toFixed(1)}%`);
  }
  return 'linear-gradient(90deg,' + stops.join(',') + ')';
})();

/** hover readout: what the pixel is and one number */
function Probe({ info, x, y, w, h }: { info: ProbeInfo; x: number; y: number; w: number; h: number }) {
  const sensor = useMission((s) => s.sensor), channel = useMission((s) => s.channel);
  const left = x + 210 > w ? x - 196 : x + 16, top = clamp(y + 16, 8, h - 90);
  const pol = channel === 'RGB' || channel === 'INSAR' ? 'HH' : channel;
  let value = '';
  if (sensor === 'optical') value = info.light < 0.05 ? 'Dark: no sunlight' : info.cloud > 0.5 ? 'Hidden by cloud' : '';
  else if (channel === 'INSAR' && info.side === 'B') value = info.coh > 0.3 ? fmtSigned(info.disp, 1) + ' cm motion' : 'Too noisy to measure';
  else value = fmt((info.side === 'A' ? info.sA : info.sB)[pol], 1) + ' dB';
  return (
    <div className="pointer-events-none absolute left-0 top-0 z-20 w-[184px] rounded-xl bg-ink/92 px-3 py-2 shadow-[0_0_0_1px_rgba(244,236,227,0.1)]" style={{ transform: `translate3d(${left}px, ${top}px, 0)` }}>
      <div className="text-[13px] font-semibold leading-tight">{info.cls}</div>
      {value && <div className="num mt-0.5 text-[12.5px] text-cream/70">{value}</div>}
    </div>
  );
}

function Legend() {
  const sensor = useMission((s) => s.sensor), channel = useMission((s) => s.channel), band = useMission((s) => s.band);
  if (sensor === 'optical') return null;
  if (channel === 'RGB') {
    return (
      <div className="flex items-center gap-3 text-[12px] text-cream/80">
        {[['#ff5a6e', 'HH'], ['#4ade80', 'HV'], ['#60a5fa', 'VV']].map(([c, l]) => <span key={l} className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full" style={{ background: c }} />{l}</span>)}
      </div>
    );
  }
  const insar = channel === 'INSAR';
  return (
    <div className="w-[150px]">
      <div className="h-1.5 rounded-full" style={{ background: insar ? PHASE_CSS : 'linear-gradient(90deg,#000,#F4ECE3)' }} />
      <div className="num mt-1 flex justify-between text-[11px] text-cream/65">
        {insar ? <><span>0</span><span>{BANDS[band].fringe} cm</span></> : <><span>{POL[channel].lo} dB</span><span>{POL[channel].hi} dB</span></>}
      </div>
    </div>
  );
}

export function SARComparisonViewport({ ready }: { ready: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engine = useRef<MapEngine | null>(null);
  const [hover, setHover] = useState<{ info: ProbeInfo; x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 1, h: 1 });

  const caseId = useMission((s) => s.caseId), retarget = useMission((s) => s.retarget);
  const a = useMission((s) => s.a), m = useMission((s) => s.m);
  const sensor = useMission((s) => s.sensor), channel = useMission((s) => s.channel), band = useMission((s) => s.band);
  const clouds = useMission((s) => s.clouds), change = useMission((s) => s.change), mechanism = useMission((s) => s.mechanism);
  const labels = useMission((s) => s.labels);
  const split = useMission((s) => s.split), setSplit = useMission((s) => s.setSplit);
  const def = caseById(caseId);

  useEffect(() => {
    const e = new MapEngine(canvasRef.current!, {
      onProbe: (info, x, y) => setHover(info ? { info, x, y } : null),
      onPick: (info) => { const st = useMission.getState(); st.setPinned(info); st.setDrawer(true); },
      onStats: (s) => useMission.getState().setStats(s),
    });
    engine.current = e;
    const ro = new ResizeObserver(() => { const s = e.size(); setSize({ w: s.w, h: s.h }); });
    ro.observe(canvasRef.current!);
    return () => { ro.disconnect(); e.destroy(); engine.current = null; };
  }, []);

  useEffect(() => {
    const e = engine.current;
    if (!e || !ready) return;
    const d = caseById(caseId);
    e.setCase(caseId, d.places);
    const t = window.setTimeout(() => e.focusAnchor(d.defaults.focus[0], d.defaults.focus[1]), 80);
    return () => window.clearTimeout(t);
  }, [caseId, ready]);

  useEffect(() => {
    const e = engine.current;
    if (!e || !ready) return;
    e.update({ tA: tOf(a), tB: tOf(m), sensor, channel, band, clouds, change, grid: false, places: labels, mechanism });
    const st = useMission.getState();
    st.setProbe(e.infoAtAnchor(caseById(caseId).probeAnchor));
    if (st.pinned) st.setPinned(e.infoAtScene(st.pinned.x, st.pinned.y, st.pinned.side));
  }, [caseId, ready, a, m, sensor, channel, band, clouds, change, mechanism, labels]);

  useEffect(() => { engine.current?.setSplit(split); }, [split]);

  const dragging = useRef(false);
  const fromEvent = (ev: React.PointerEvent) => { const r = wrap.current!.getBoundingClientRect(); setSplit((ev.clientX - r.left) / r.width); };
  const key = (ev: React.KeyboardEvent) => {
    const st = ev.shiftKey ? 0.1 : 0.02;
    if (ev.key === 'ArrowLeft') { setSplit(split - st); ev.preventDefault(); }
    else if (ev.key === 'ArrowRight') { setSplit(split + st); ev.preventDefault(); }
    else if (ev.key === 'Home') { setSplit(0.02); ev.preventDefault(); }
    else if (ev.key === 'End') { setSplit(0.98); ev.preventDefault(); }
  };

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden bg-night">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
        role="img" aria-label={'Simulated radar scene: ' + def.place + '. Drag to pan, scroll or pinch to zoom.'} />

      {/* soft ground under the bars so text stays readable on bright imagery */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[220px] bg-gradient-to-b from-ink/80 via-ink/35 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-[200px] bg-gradient-to-t from-ink/80 via-ink/30 to-transparent" />

      {/* case change: one ring */}
      <span key={retarget} className="pointer-events-none absolute left-1/2 top-1/2 z-10 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-crimson/80" style={{ animation: 'pulse-ring 1000ms cubic-bezier(.2,.7,.2,1) forwards', opacity: 0 }} />

      {/* divider */}
      <div className="pointer-events-none absolute inset-y-0 z-10" style={{ left: split * 100 + '%' }}>
        <div className="absolute inset-y-0 -left-px w-[2px] bg-cream/90 shadow-[0_0_0_1px_rgba(23,24,36,0.35)]" />
        <div className="pointer-events-auto absolute inset-y-0 -left-4 w-8 cursor-ew-resize touch-none"
          onPointerDown={(ev) => { dragging.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); fromEvent(ev); }}
          onPointerMove={(ev) => { if (dragging.current) fromEvent(ev); }}
          onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}
          onDoubleClick={() => setSplit(0.5)} />
        <div role="slider" tabIndex={0} aria-label="Before and after divider" aria-orientation="horizontal" aria-valuemin={2} aria-valuemax={98} aria-valuenow={Math.round(split * 100)}
          className="pointer-events-auto absolute top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize touch-none place-items-center rounded-full bg-cream text-ink shadow-[0_6px_18px_rgba(0,0,0,0.45)]"
          onKeyDown={key}
          onPointerDown={(ev) => { dragging.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); }}
          onPointerMove={(ev) => { if (dragging.current) fromEvent(ev); }}
          onPointerUp={() => { dragging.current = false; }} onPointerCancel={() => { dragging.current = false; }}>
          <ChevronsLeftRight size={18} strokeWidth={2} />
        </div>
        {/* dates either side of the line */}
        <div className="absolute flex -translate-x-1/2 items-center gap-0 whitespace-nowrap text-[12.5px] font-medium" style={{ top: 'calc(var(--bar-t) + 92px)' }}>
          <span className="num flex items-center gap-1.5 rounded-l-full bg-ink/85 py-1 pl-2.5 pr-2"><i className="h-1.5 w-1.5 rounded-full bg-crimson" />{monthLabel(Math.floor(m + 1e-6))}</span>
          <span className="num flex items-center gap-1.5 rounded-r-full bg-ink/85 py-1 pl-2 pr-2.5 text-cream/75">{monthLabel(a)}<i className="h-1.5 w-1.5 rounded-full bg-cream/70" /></span>
        </div>
      </div>

      {hover && <Probe info={hover.info} x={hover.x} y={hover.y} w={size.w} h={size.h} />}

      {/* zoom and legend */}
      <div className="absolute z-20 flex items-end gap-3" style={{ left: 'var(--gut-l)', bottom: 'calc(var(--bar-b) + 12px)' }}>
        <div className="flex flex-col overflow-hidden rounded-full bg-ink/88 shadow-[0_0_0_1px_rgba(244,236,227,0.08)]">
          {([['Zoom in', Plus, () => engine.current?.zoomBy(1.5)], ['Zoom out', Minus, () => engine.current?.zoomBy(1 / 1.5)], ['Whole scene', Maximize, () => engine.current?.resetView()]] as const).map(([label, Icon, fn]) => (
            <button key={label} type="button" aria-label={label} title={label} onClick={fn} className="grid h-10 w-10 place-items-center text-cream transition-colors hover:bg-cream/10">
              <Icon size={16} strokeWidth={1.8} />
            </button>
          ))}
        </div>
        <div className="hidden pb-1 sm:block"><Legend /></div>
      </div>

      {!ready && (
        <div className="absolute inset-0 z-20 grid place-items-center">
          <div className="flex flex-col items-center gap-4">
            <Mark className="w-[132px] animate-pulse" />
            <span className="text-[13px] text-cream/70">Loading {def.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}
