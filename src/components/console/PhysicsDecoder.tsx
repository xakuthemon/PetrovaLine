/*
 * Right-hand Liquid Glass drawer: what the radar is reacting to at the active
 * pixel, the three scattering mechanisms, what-if sliders, and the mission insight.
 */
import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Atom, FileText, MapPin, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { LiquidGlassPanel } from '../glass/LiquidGlassPanel';
import { MagneticButton } from '../glass/MagneticButton';
import { SOFT_SPRING } from '../glass/LensPill';
import { ScatterDiagram } from './ScatterDiagram';
import { BANDS, breakdown, sigma, toDb } from '../../engine/physics';
import type { Mechanism } from '../../engine/render';
import { clamp, fmt, monthLabel } from '../../engine/util';
import { caseById } from '../../data/cases';
import { useMission } from '../../state/mission';

const MECHS: { id: Mechanism; name: string; sub: string }[] = [
  { id: 'surface', name: 'Surface', sub: 'specular · rough' },
  { id: 'volume', name: 'Volume', sub: 'canopy · snowpack' },
  { id: 'double', name: 'Double-bounce', sub: 'trunks · walls' },
];
const P3 = new Float32Array(3);

function Stat({ k, v, tone = 'text-lens' }: { k: string; v: string; tone?: string }) {
  return (
    <div className="rounded-2xl bg-black/25 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
      <div className="tele text-[8px] text-slate">{k}</div>
      <div className={'etched mt-1.5 font-mono text-[14px] font-medium ' + tone}>{v}</div>
    </div>
  );
}

export function PhysicsDecoder() {
  const open = useMission((s) => s.drawerOpen), toggle = useMission((s) => s.toggle);
  const caseId = useMission((s) => s.caseId), band = useMission((s) => s.band), sensor = useMission((s) => s.sensor);
  const pinned = useMission((s) => s.pinned), probe = useMission((s) => s.probe);
  const mechanism = useMission((s) => s.mechanism), setMechanism = useMission((s) => s.setMechanism);
  const share = useMission((s) => s.stats.mechShare);
  const a = useMission((s) => s.a), m = useMission((s) => s.m);
  const setPinned = useMission((s) => s.setPinned), setExportOpen = useMission((s) => s.setExportOpen);
  const def = caseById(caseId);
  const active = pinned ?? probe;
  const isS = band === 'S';

  // what-if sliders start from the active pixel
  const [what, setWhat] = useState({ r: 0.3, e: 20 });
  const pixelKey = active ? caseId + ':' + active.i + ':' + active.side : '';
  useEffect(() => {
    if (active) setWhat({ r: clamp(active.state.R, 0, 1), e: clamp(active.state.E, 1, 80) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixelKey]);

  const derived = useMemo(() => {
    if (!active) return null;
    const mm = active.mech, parts = [mm.surface, mm.volume, mm.dbl].sort((x, y) => y - x);
    const conf = Math.round(clamp(52 + 47 * ((parts[0] - parts[1]) / (parts[0] + 1e-5)), 52, 99));
    const s = active.side === 'A' ? active.sA : active.sB;
    return { dominant: mm.dominant, conf, ratio: s.HH - s.HV, hh: s.HH };
  }, [active]);

  const sim = useMemo(() => {
    if (!active) return null;
    sigma(what.r, what.e, active.state.V, active.state.D, isS, P3);
    const b = breakdown(what.r, what.e, active.state.V, active.state.D, isS);
    const hh = toDb(P3[0]);
    const regime = b.dbl >= b.surface && b.dbl >= b.volume && b.dbl > 0.01 ? 'Double-bounce' : b.volume > b.surface && b.volume > 0.012 ? 'Volume scattering' : hh < -18.5 ? 'Specular · dark pixel' : 'Diffuse backscatter';
    return { hh, regime, refl: Math.round(b.G * 100) };
  }, [active, what, isS]);

  const shown: Mechanism = mechanism ?? derived?.dominant ?? 'surface';
  const lam = BANDS[band].lambda;

  return (
    <>
      <AnimatePresence>
        {!open && (
          <motion.button type="button" key="open" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={SOFT_SPRING}
            onClick={() => toggle('drawerOpen')} aria-label="Open the radar physics decoder"
            className="lg absolute z-30 flex h-11 items-center gap-2 px-4 text-[12px] font-medium text-lens max-lg:bottom-[196px] lg:top-[182px]" data-depth="deep"
            style={{ right: 'var(--gut-r)', ['--lg-r' as string]: '9999px' }}>
            <span className="lg-body flex items-center gap-2"><PanelRightOpen size={16} strokeWidth={1.7} /> Decoder</span>
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {open && (
          <motion.aside key="drawer" aria-label="Radar physics decoder" initial={{ opacity: 0, x: 48, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 48, scale: 0.97 }} transition={SOFT_SPRING}
            className="absolute z-30 max-lg:bottom-[196px] max-lg:h-[min(52vh,440px)] lg:bottom-[148px] lg:top-[182px] lg:w-[364px]"
            style={{ right: 'var(--gut-r)', left: undefined }}>
            <div className="h-full max-lg:w-[calc(100vw-var(--gut-l)-var(--gut-r))]">
              <LiquidGlassPanel depth="deep" radius={28} className="h-full" bodyClassName="flex h-full flex-col">
                <header className="flex flex-none items-center gap-2.5 px-5 pb-3 pt-4">
                  <Atom size={17} strokeWidth={1.6} className="text-lband" />
                  <h2 className="tele text-[10px] text-lens">Radar physics decoder</h2>
                  <button type="button" onClick={() => toggle('drawerOpen')} aria-label="Close the decoder"
                    className="ml-auto grid h-8 w-8 place-items-center rounded-full text-slate transition-colors hover:bg-lens/10 hover:text-lens"><PanelRightClose size={16} strokeWidth={1.7} /></button>
                </header>

                <div className="scroll-thin min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-5">
                  {/* active pixel */}
                  <section>
                    <div className="flex items-center gap-2">
                      <MapPin size={13} strokeWidth={1.8} className={pinned ? 'text-kapton' : 'text-slate'} />
                      <span className="tele text-[8.5px] text-slate">{pinned ? 'Pinned pixel' : 'Default sample region'}</span>
                      {pinned && <button type="button" onClick={() => setPinned(null)} className="tele ml-auto text-[8px] text-lband underline decoration-lband/40 underline-offset-2">Release</button>}
                    </div>
                    <div className="mt-1.5 text-[17px] font-semibold leading-tight tracking-tight text-lens">{active ? active.cls : 'Acquiring…'}</div>
                    {active && (
                      <div className="mt-1 font-mono text-[10.5px] text-slate">
                        {Math.abs(active.lat).toFixed(3)}°{active.lat < 0 ? 'S' : 'N'} {Math.abs(active.lon).toFixed(3)}°{active.lon < 0 ? 'W' : 'E'} · {active.side} · {monthLabel(active.side === 'A' ? a : Math.floor(m + 1e-6))}
                      </div>
                    )}
                  </section>

                  {/* mechanisms */}
                  <section>
                    <div className="tele mb-2 text-[8.5px] text-slate">Scattering mechanism · select to highlight on the map</div>
                    <div className="grid grid-cols-3 gap-2">
                      {MECHS.map((x) => {
                        const on = mechanism === x.id, dom = derived?.dominant === x.id;
                        return (
                          <button key={x.id} type="button" aria-pressed={on} disabled={sensor === 'optical'} onClick={() => setMechanism(on ? null : x.id)}
                            className={'relative rounded-2xl p-2 text-left transition-colors duration-200 disabled:opacity-40 ' + (on ? 'bg-kapton/15 shadow-[inset_0_0_0_1px_rgba(245,176,65,0.7),inset_0_1px_0_rgba(255,255,255,0.3)]' : 'bg-black/25 shadow-[inset_0_0_0_1px_rgba(244,251,255,0.1)] hover:shadow-[inset_0_0_0_1px_rgba(244,251,255,0.3)]')}>
                            <div className="aspect-[120/76]"><ScatterDiagram kind={x.id} active={on || (!mechanism && dom)} /></div>
                            <div className="mt-1 text-[11.5px] font-semibold leading-tight text-lens">{x.name}</div>
                            <div className="tele mt-1 text-[7px] leading-tight text-slate">{x.sub}</div>
                            {dom && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-lband" title="Dominant at the active pixel" />}
                          </button>
                        );
                      })}
                    </div>
                    {mechanism && share != null && (
                      <p className="mt-2 font-mono text-[10.5px] text-kapton">{fmt(share * 100, 1)} % of the scene at date B is dominated by {MECHS.find((q) => q.id === mechanism)!.name.toLowerCase()} scattering.</p>
                    )}
                  </section>

                  {/* readouts */}
                  {derived && active && (
                    <section className="grid grid-cols-2 gap-2">
                      <Stat k="Dominant return" v={MECHS.find((q) => q.id === derived.dominant)!.name} tone="text-lband" />
                      <Stat k="HH / HV ratio" v={fmt(derived.ratio, 1) + ' dB'} />
                      <Stat k="Coherence γ" v={fmt(active.coh, 2)} />
                      <Stat k="Confidence" v={derived.conf + ' %'} tone="text-kapton" />
                    </section>
                  )}

                  <p className="text-[13px] leading-relaxed text-lens/85">{def.mechanisms[shown].where}</p>

                  {/* what-if */}
                  {sim && (
                    <section className="rounded-2xl bg-black/25 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                      <div className="tele text-[8.5px] text-slate">What if this surface changed?</div>
                      <label className="mt-3 flex items-baseline justify-between text-[12px] font-medium text-lens" htmlFor="what-r">
                        Surface roughness <span className="font-mono text-[10px] text-slate">{fmt(what.r * 6, 1)} cm rms · {what.r * 6 < lam / 16 ? 'smooth' : what.r * 6 < lam / 6 ? 'medium' : 'rough'} at {lam} cm</span>
                      </label>
                      <input id="what-r" type="range" min={0} max={100} value={Math.round(what.r * 100)} className="glass-range" style={{ ['--p' as string]: what.r * 100 + '%' }}
                        onChange={(ev) => setWhat((w) => ({ ...w, r: Number(ev.target.value) / 100 }))} />
                      <label className="mt-2 flex items-baseline justify-between text-[12px] font-medium text-lens" htmlFor="what-e">
                        Dielectric constant <span className="font-mono text-[10px] text-slate">ε {fmt(what.e, what.e < 10 ? 1 : 0)} · reflects {sim.refl} %</span>
                      </label>
                      <input id="what-e" type="range" min={1} max={80} step={0.5} value={what.e} className="glass-range" style={{ ['--p' as string]: ((what.e - 1) / 79) * 100 + '%', ['--tint' as string]: '255, 42, 133' }}
                        onChange={(ev) => setWhat((w) => ({ ...w, e: Number(ev.target.value) }))} />
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="text-[12px] text-lens/85">{sim.regime}</span>
                        <span className="etched font-mono text-[13px] text-lens">σ⁰ HH {fmt(sim.hh, 1)} dB</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-lens/10">
                        <div className="h-full rounded-full bg-lens/80 transition-[width] duration-150" style={{ width: clamp(((sim.hh + 36) / 36) * 100, 2, 100) + '%' }} />
                      </div>
                    </section>
                  )}

                  {/* insight */}
                  <section className="rounded-2xl p-3.5 shadow-[inset_0_0_0_1px_rgba(245,176,65,0.5),inset_0_1px_0_rgba(255,255,255,0.25)]" style={{ background: 'linear-gradient(180deg, rgba(245,176,65,0.16), rgba(245,176,65,0.05))' }}>
                    <div className="tele text-[8.5px] text-kapton">Actionable mission insight</div>
                    <p className="mt-2 text-[13.5px] font-medium leading-snug text-lens">{def.mechanisms[shown].insight}</p>
                  </section>
                </div>

                <footer className="flex-none px-5 pb-4 pt-1">
                  <MagneticButton primary tint="kapton" className="w-full justify-center" onClick={() => setExportOpen(true)}>
                    <FileText size={16} strokeWidth={1.7} /> <span className="tele text-[10.5px]">Export mission brief</span>
                  </MagneticButton>
                </footer>
              </LiquidGlassPanel>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
