/*
 * Pixel panel: what the radar echo is made of at one pixel, shown as three
 * scattering diagrams with their share, two numbers, and two what-if sliders.
 * A side panel on wide screens, a bottom sheet on small ones.
 */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Crosshair, Pin, PinOff, X } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { ScatterDiagram } from './ScatterDiagram';
import { breakdown, sigma, toDb } from '../../engine/physics';
import type { Mechanism } from '../../engine/render';
import { clamp, fmt } from '../../engine/util';
import { useMission } from '../../state/mission';

const MECHS: { id: Mechanism; name: string }[] = [
  { id: 'surface', name: 'Surface' },
  { id: 'volume', name: 'Volume' },
  { id: 'double', name: 'Double bounce' },
];
const P3 = new Float32Array(3);
const SHEET = { type: 'spring', stiffness: 300, damping: 34, mass: 0.9 } as const;

function useWide(): boolean {
  const q = '(min-width: 1024px) and (min-height: 521px)';
  const [wide, setWide] = useState(() => typeof window !== 'undefined' && window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const f = () => setWide(mq.matches);
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return wide;
}

export function PixelPanel() {
  const open = useMission((s) => s.drawerOpen), setDrawer = useMission((s) => s.setDrawer);
  const caseId = useMission((s) => s.caseId), band = useMission((s) => s.band), sensor = useMission((s) => s.sensor);
  const pinned = useMission((s) => s.pinned), probe = useMission((s) => s.probe), setPinned = useMission((s) => s.setPinned);
  const mechanism = useMission((s) => s.mechanism), setMechanism = useMission((s) => s.setMechanism);
  const share = useMission((s) => s.stats.mechShare);
  const active = pinned ?? probe;
  const isS = band === 'S';
  const wide = useWide();

  const [what, setWhat] = useState({ r: 0.3, e: 20 });
  const pixelKey = active ? caseId + ':' + active.i + ':' + active.side : '';
  useEffect(() => {
    if (active) setWhat({ r: clamp(active.state.R, 0, 1), e: clamp(active.state.E, 1, 80) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelKey]);

  const parts = useMemo(() => {
    if (!active) return null;
    const m = active.mech, sum = m.surface + m.volume + m.dbl || 1;
    return { surface: m.surface / sum, volume: m.volume / sum, double: m.dbl / sum, dominant: m.dominant };
  }, [active]);
  const sim = useMemo(() => {
    if (!active) return null;
    sigma(what.r, what.e, active.state.V, active.state.D, isS, P3);
    const b = breakdown(what.r, what.e, active.state.V, active.state.D, isS);
    return { hh: toDb(P3[0]), refl: Math.round(b.G * 100) };
  }, [active, what, isS]);
  const s = active ? (active.side === 'A' ? active.sA : active.sB) : null;

  const body = (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex flex-none items-start gap-2 px-4 pb-2 pt-3.5">
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-[16px] font-semibold leading-tight">{active ? active.cls : 'Pick a pixel'}</h2>
          {active && <p className="num mt-0.5 text-[12px] text-fog">{Math.abs(active.lat).toFixed(3)}° {active.lat < 0 ? 'S' : 'N'} · {Math.abs(active.lon).toFixed(3)}° {active.lon < 0 ? 'W' : 'E'}</p>}
        </div>
        {pinned
          ? <button type="button" className="icon-btn !h-9 !w-9" onClick={() => setPinned(null)} aria-label="Unpin this pixel" title="Unpin"><PinOff size={16} strokeWidth={1.7} /></button>
          : <span className="grid h-9 w-9 place-items-center text-fog" title="Click the map to pin a pixel"><Pin size={15} strokeWidth={1.7} /></span>}
        <button type="button" className="icon-btn !h-9 !w-9" onClick={() => setDrawer(false)} aria-label="Close the pixel panel" title="Close"><X size={17} strokeWidth={1.7} /></button>
      </header>

      <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
        {/* how the echo comes back */}
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Scattering mechanisms: select one to highlight it on the map">
          {MECHS.map((x) => {
            const on = mechanism === x.id, f = parts ? parts[x.id] : 0, dom = parts?.dominant === x.id;
            return (
              <button key={x.id} type="button" aria-pressed={on} disabled={sensor === 'optical'} onClick={() => setMechanism(on ? null : x.id)}
                className={'rounded-xl p-2 text-left transition-colors duration-200 disabled:opacity-40 ' + (on ? 'bg-cream/[0.12] shadow-[inset_0_0_0_1.5px_#D3243F]' : 'bg-night/60 shadow-[inset_0_0_0_1px_rgba(244,236,227,0.08)] hover:shadow-[inset_0_0_0_1px_rgba(244,236,227,0.3)]')}>
                <div className="aspect-[120/76]"><ScatterDiagram kind={x.id} active={on || (!mechanism && dom)} /></div>
                <div className="mt-1.5 text-[12px] font-medium leading-tight">{x.name}</div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-cream/10">
                  <div className={'h-full rounded-full ' + (dom ? 'bg-crimson' : 'bg-cream/45')} style={{ width: Math.round(f * 100) + '%' }} />
                </div>
                <div className="num mt-1 text-[11.5px] text-fog">{on && share != null ? Math.round(share * 100) + '% of map' : Math.round(f * 100) + '%'}</div>
              </button>
            );
          })}
        </div>

        {/* two numbers */}
        {active && s && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-night/60 px-3 py-2.5"><div className="num text-[20px] font-semibold">{fmt(s.HH, 1)}<span className="ml-1 text-[12px] font-normal text-fog">dB</span></div><div className="text-[12px] text-fog">Brightness, HH</div></div>
            <div className="rounded-xl bg-night/60 px-3 py-2.5"><div className="num text-[20px] font-semibold">{fmt(active.coh, 2)}</div><div className="text-[12px] text-fog">Coherence</div></div>
          </div>
        )}

        {/* what if the surface changed */}
        {sim && (
          <div className="space-y-1 rounded-xl bg-night/60 px-3 pb-3 pt-2.5">
            <label htmlFor="what-r" className="flex items-baseline justify-between text-[12.5px] font-medium">Roughness<span className="num text-[12px] font-normal text-fog">{fmt(what.r * 6, 1)} cm</span></label>
            <input id="what-r" type="range" min={0} max={100} value={Math.round(what.r * 100)} className="range" style={{ ['--p' as string]: what.r * 100 + '%' }}
              onChange={(ev) => setWhat((w) => ({ ...w, r: Number(ev.target.value) / 100 }))} />
            <label htmlFor="what-e" className="flex items-baseline justify-between text-[12.5px] font-medium">Moisture<span className="num text-[12px] font-normal text-fog">ε {fmt(what.e, what.e < 10 ? 1 : 0)}</span></label>
            <input id="what-e" type="range" min={1} max={80} step={0.5} value={what.e} className="range" style={{ ['--p' as string]: ((what.e - 1) / 79) * 100 + '%' }}
              onChange={(ev) => setWhat((w) => ({ ...w, e: Number(ev.target.value) }))} />
            <div className="flex items-center gap-3 pt-1">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream/10">
                <div className="h-full rounded-full bg-cream transition-[width] duration-150" style={{ width: clamp(((sim.hh + 36) / 36) * 100, 2, 100) + '%' }} />
              </div>
              <span className="num w-[70px] text-right text-[13px] font-semibold">{fmt(sim.hh, 1)} dB</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {!open && wide && (
          <motion.button key="pin" type="button" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            onClick={() => setDrawer(true)} aria-label="Open the pixel panel" title="Pixel"
            className="absolute z-30 grid h-11 w-11 place-items-center rounded-full bg-ink/92 text-cream shadow-[0_0_0_1px_rgba(244,236,227,0.1)] hover:bg-panel"
            style={{ right: 'var(--gut-r)', top: 'calc(var(--bar-t) + 12px)' }}>
            <Crosshair size={18} strokeWidth={1.7} />
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (wide ? (
          <motion.aside key="side" aria-label="Pixel" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} transition={SHEET}
            className="absolute z-30 flex w-[312px] flex-col" style={{ right: 'var(--gut-r)', top: 'calc(var(--bar-t) + 12px)', maxHeight: 'calc(100% - var(--bar-t) - var(--bar-b) - 24px)' }}>
            <Panel depth="deep" radius={20} className="flex min-h-0 flex-col" bodyClassName="flex min-h-0 flex-1 flex-col">{body}</Panel>
          </motion.aside>
        ) : (
          <motion.aside key="sheet" aria-label="Pixel" initial={{ y: '110%' }} animate={{ y: 0 }} exit={{ y: '110%' }} transition={SHEET}
            className="absolute inset-x-0 z-[35]" style={{ bottom: 'calc(var(--bar-b) + 8px)', paddingLeft: 'var(--gut-l)', paddingRight: 'var(--gut-r)' }}>
            <Panel depth="deep" radius={20} className="mx-auto max-w-[560px]" bodyClassName="flex max-h-[min(52vh,420px)] min-h-0 flex-col">{body}</Panel>
          </motion.aside>
        ))}
      </AnimatePresence>
    </>
  );
}
