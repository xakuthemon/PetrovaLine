/*
 * Bottom bar: the timeline (one trace, the scene's headline metric) and the image
 * controls (channel, band, and a small menu for the rest). One row on wide screens,
 * two on phones.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Cloud, Crosshair, Eye, Flag, GitCompareArrows, MoreHorizontal, Pause, Play, RefreshCw, Tag } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Segmented } from '../ui/Segmented';
import { M_MAX, clamp, monthLabel } from '../../engine/util';
import type { Series } from '../../engine/scenes';
import type { Channel } from '../../engine/mapEngine';
import { caseById } from '../../data/cases';
import { useMission } from '../../state/mission';

const CHANNELS: { id: Channel; label: string; title: string }[] = [
  { id: 'HH', label: 'HH', title: 'Horizontal send, horizontal receive' },
  { id: 'HV', label: 'HV', title: 'Cross-polarised: vegetation volume' },
  { id: 'VV', label: 'VV', title: 'Vertical send, vertical receive' },
  { id: 'INSAR', label: 'InSAR', title: 'Interferogram: ground motion between dates' },
  { id: 'RGB', label: 'RGB', title: 'False colour: HH, HV, VV' },
];
const H = 40, PAD = { l: 6, r: 6, t: 6, b: 14 };

/** keeps --bar-b / --bar-t on the console root equal to a bar's real height */
export function useBarVar(name: '--bar-b' | '--bar-t') {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current, root = el?.closest('.console') as HTMLElement | null;
    if (!el || !root) return;
    const ro = new ResizeObserver(() => root.style.setProperty(name, Math.ceil(el.getBoundingClientRect().height) + 'px'));
    ro.observe(el);
    return () => ro.disconnect();
  }, [name]);
  return ref;
}

function Timeline({ series }: { series: Series | null }) {
  const caseId = useMission((s) => s.caseId), a = useMission((s) => s.a), m = useMission((s) => s.m), playing = useMission((s) => s.playing);
  const { setM, setA, setPlaying } = useMission.getState();
  const def = caseById(caseId), tr = def.traces[0];
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(400);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(120, el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const xOf = (mm: number) => PAD.l + (mm / M_MAX) * (w - PAD.l - PAD.r);
  const mAt = (clientX: number) => { const r = box.current!.getBoundingClientRect(); return clamp(Math.round(((clientX - r.left - PAD.l) / (w - PAD.l - PAD.r)) * M_MAX), 0, M_MAX); };
  const path = useMemo(() => {
    if (!series) return null;
    const arr = series[tr.key].map((v) => v ?? 0);
    const lo = Math.min(...arr), hi = Math.max(...arr), span = hi - lo || 1;
    let d = '';
    arr.forEach((v, i) => { d += (i ? 'L' : 'M') + (PAD.l + (i / M_MAX) * (w - PAD.l - PAD.r)).toFixed(1) + ' ' + (PAD.t + (1 - (v - lo) / span) * (H - PAD.t - PAD.b)).toFixed(1); });
    return { d, area: d + 'L' + (w - PAD.r) + ' ' + (H - PAD.b) + 'L' + PAD.l + ' ' + (H - PAD.b) + 'Z' };
  }, [series, tr, w]);
  const drag = useRef(false);
  const scrub = (ev: React.PointerEvent) => { setPlaying(false); setM(mAt(ev.clientX)); };
  const month = Math.floor(m + 1e-6);
  const years = Array.from({ length: 7 }, (_, y) => y).filter((y) => w >= 320 || y % 2 === 0);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? 'Pause the timeline' : 'Play the timeline'} aria-pressed={playing}
        className="grid h-10 w-10 flex-none place-items-center rounded-full bg-cream text-ink transition-transform active:scale-95">
        {playing ? <Pause size={16} strokeWidth={2.2} /> : <Play size={16} strokeWidth={2.2} className="translate-x-px" />}
      </button>
      <div ref={box} className="relative min-w-0 flex-1 touch-none select-none" style={{ height: H }}
        onPointerDown={(ev) => { drag.current = true; ev.currentTarget.setPointerCapture(ev.pointerId); scrub(ev); }}
        onPointerMove={(ev) => { if (drag.current) scrub(ev); }}
        onPointerUp={() => { drag.current = false; }} onPointerCancel={() => { drag.current = false; }}>
        <svg width={w} height={H} className="absolute inset-0 overflow-visible" aria-hidden="true">
          <line x1={PAD.l} x2={w - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="#F4ECE3" strokeOpacity="0.14" />
          {years.map((y) => <text key={y} x={xOf(y * 12)} y={H - 2} textAnchor={y === 0 ? 'start' : y === 6 ? 'end' : 'middle'} fontSize="10" fill="#9C9797" fontFamily="Archivo, sans-serif">{w >= 320 ? 2020 + y : "'" + (20 + y)}</text>)}
          {path && <path d={path.area} fill="#D3243F" fillOpacity="0.14" />}
          {path && <path d={path.d} fill="none" stroke="#D3243F" strokeWidth="1.6" strokeLinejoin="round" />}
          <g transform={`translate(${xOf(a)},0)`}><line y1={PAD.t - 4} y2={H - PAD.b} stroke="#F4ECE3" strokeOpacity="0.5" strokeDasharray="2 2" /></g>
        </svg>
        {def.events.map((ev) => (
          <button key={ev.m} type="button" aria-label={ev.label} title={ev.label} onPointerDown={(e) => e.stopPropagation()} onClick={() => { setPlaying(false); setM(ev.m); }}
            className="absolute -top-1 h-4 w-4 -translate-x-1/2" style={{ left: xOf(ev.m) }}>
            <span className={'absolute left-1/2 top-[4px] h-[7px] w-[7px] -translate-x-1/2 rotate-45 rounded-[1px] ' + (ev.mission ? 'bg-crimson' : 'bg-cream/70')} />
          </button>
        ))}
        <div role="slider" tabIndex={0} aria-label="Date B" aria-valuemin={0} aria-valuemax={M_MAX} aria-valuenow={month} aria-valuetext={monthLabel(month)}
          onKeyDown={(ev) => {
            const st = ev.shiftKey ? 12 : 1;
            if (ev.key === 'ArrowLeft') { setPlaying(false); setM(month - st); ev.preventDefault(); }
            else if (ev.key === 'ArrowRight') { setPlaying(false); setM(month + st); ev.preventDefault(); }
            else if (ev.key === 'Home') { setM(0); ev.preventDefault(); }
            else if (ev.key === 'End') { setM(M_MAX); ev.preventDefault(); }
          }}
          className="absolute top-0 flex h-[calc(100%-12px)] w-5 -translate-x-1/2 cursor-ew-resize justify-center" style={{ left: xOf(m) }}>
          <span className="h-full w-[2px] rounded-full bg-cream" />
          <span className="absolute -top-0.5 h-3 w-3 rounded-full bg-cream shadow-[0_0_0_3px_rgba(23,24,36,0.9)]" />
        </div>
      </div>
      <div className="flex flex-none items-center gap-0.5">
        <span className="num min-w-[72px] text-right text-[14px] font-semibold">{monthLabel(month)}</span>
        <button type="button" className="icon-btn !h-9 !w-9 text-cream/80" onClick={() => setA(month === a ? 0 : month)} aria-label={month === a && a !== 0 ? 'Reset the baseline to Jan 2020' : 'Set the baseline (date A) here'} title="Set baseline here">
          <Flag size={15} strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}

function MenuItem({ icon, label, on, disabled, onClick }: { icon: ReactNode; label: string; on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="menuitemcheckbox" aria-checked={on} disabled={disabled} onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13.5px] transition-colors hover:bg-cream/10 disabled:opacity-40">
      <span className="text-cream/80">{icon}</span><span className="flex-1">{label}</span>
      <span className={'grid h-5 w-5 place-items-center rounded-full ' + (on ? 'bg-crimson text-cream' : 'shadow-[inset_0_0_0_1px_rgba(244,236,227,0.25)]')}>{on && <Check size={12} strokeWidth={3} />}</span>
    </button>
  );
}

export function ControlBar({ series }: { series: Series | null }) {
  const channel = useMission((s) => s.channel), sensor = useMission((s) => s.sensor), band = useMission((s) => s.band);
  const sweep = useMission((s) => s.sweep), change = useMission((s) => s.change), clouds = useMission((s) => s.clouds), labels = useMission((s) => s.labels);
  const drawerOpen = useMission((s) => s.drawerOpen);
  const { setChannel, setSensor, setBand, toggleSweep, toggle, setDrawer } = useMission.getState();
  const optical = sensor === 'optical';
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const bar = useBarVar('--bar-b');

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => { if (e instanceof KeyboardEvent ? e.key === 'Escape' : !menuRef.current?.contains(e.target as Node)) setMenu(false); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', close); };
  }, [menu]);

  return (
    <div ref={bar} className="pointer-events-none absolute inset-x-0 bottom-0 z-40" style={{ paddingLeft: 'var(--gut-l)', paddingRight: 'var(--gut-r)', paddingBottom: 'calc(var(--safe-b) + 10px)' }}>
      <Panel depth="deep" radius={22} className="pointer-events-auto mx-auto max-w-[1400px]"
        bodyClassName="flex flex-col gap-1.5 p-1.5 lg:flex-row lg:items-center lg:gap-4 lg:p-2 short:flex-row short:items-center short:gap-2">
        <div className="no-scrollbar flex min-w-0 items-center gap-1.5 overflow-x-auto lg:order-2 lg:flex-none">
          <Segmented id="channel-pill" label="Radar channel" size="sm" value={optical ? null : channel} onChange={(c) => setChannel(c)}
            options={CHANNELS.map((c) => ({ id: c.id, label: c.label, title: c.title }))} />
          <Segmented id="band-pill" label="Radar band" size="sm" value={band} onChange={(b) => setBand(b)}
            options={[{ id: 'L', label: 'L', title: 'L-band, 24 cm' }, { id: 'S', label: 'S', title: 'S-band, 9.4 cm' }]} />
          <div ref={menuRef} className="relative flex-none">
            <button type="button" className="icon-btn !h-9 !w-9" aria-haspopup="menu" aria-expanded={menu} aria-label="More view options" title="More" onClick={() => setMenu((v) => !v)}>
              <MoreHorizontal size={18} strokeWidth={1.8} />
            </button>
            <AnimatePresence>
              {menu && (
                <motion.div role="menu" aria-label="View options" initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.16 }}
                  className="fixed z-50 w-[230px] rounded-2xl bg-panel p-1.5 shadow-[0_0_0_1px_rgba(244,236,227,0.1),0_24px_48px_-20px_rgba(0,0,0,0.9)]"
                  style={{ right: 'var(--gut-r)', bottom: 'calc(var(--bar-b) + 8px)' }}>
                  <MenuItem icon={<Eye size={16} />} label="Optical view" on={optical} onClick={() => setSensor(optical ? 'sar' : 'optical')} />
                  {optical && <MenuItem icon={<Cloud size={16} />} label="Clouds" on={clouds} onClick={() => toggle('clouds')} />}
                  <MenuItem icon={<GitCompareArrows size={16} />} label="Change map" on={change} disabled={channel === 'INSAR' || optical} onClick={() => toggle('change')} />
                  <MenuItem icon={<RefreshCw size={16} />} label="Cycle channels" on={sweep} onClick={toggleSweep} />
                  <MenuItem icon={<Tag size={16} />} label="Place names" on={labels} onClick={() => toggle('labels')} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <button type="button" className="icon-btn !h-9 !w-9 flex-none [@media(min-width:1024px)_and_(min-height:521px)]:hidden" aria-pressed={drawerOpen} aria-label="Pixel details" title="Pixel" onClick={() => setDrawer(!drawerOpen)}>
            <Crosshair size={17} strokeWidth={1.8} />
          </button>
        </div>
        <div className="flex min-w-0 flex-1 lg:order-1"><Timeline series={series} /></div>
      </Panel>
    </div>
  );
}
