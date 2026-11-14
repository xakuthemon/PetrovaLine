/*
 * Lower-centre channel dock: polarisations, interferogram and composite behind a
 * tinted liquid lens, plus Sweep, the L/S band switch and the optical comparison.
 */
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Cloud, Eye, GitCompareArrows, Radar, RefreshCw } from 'lucide-react';
import { LiquidGlassPanel } from '../glass/LiquidGlassPanel';
import { LensPill, type Tint } from '../glass/LensPill';
import { CHANNELS, caseById } from '../../data/cases';
import { BANDS } from '../../engine/physics';
import { useMission } from '../../state/mission';
import { SWEEP_MS } from '../../hooks/useConsole';

const TINT: Record<string, Tint> = { HH: 'lband', HV: 'kapton', VV: 'lband', INSAR: 'sband', RGB: 'lens' };

export function LiquidChannelDock() {
  const channel = useMission((s) => s.channel), sensor = useMission((s) => s.sensor), band = useMission((s) => s.band);
  const sweep = useMission((s) => s.sweep), change = useMission((s) => s.change), clouds = useMission((s) => s.clouds);
  const caseId = useMission((s) => s.caseId);
  const { setChannel, setSensor, setBand, toggleSweep, toggle } = useMission.getState();
  const optical = sensor === 'optical';
  const info = CHANNELS.find((c) => c.id === channel)!;
  const note = caseById(caseId).channelNotes[channel];
  // the note shows for a few seconds after each change, then gets out of the way
  const noteKey = optical ? 'optical' : channel + caseId;
  const [noteOn, setNoteOn] = useState(true);
  useEffect(() => { setNoteOn(true); const t = window.setTimeout(() => setNoteOn(false), 4000); return () => window.clearTimeout(t); }, [noteKey]);
  const btn = 'relative flex h-10 flex-none items-center gap-1.5 rounded-full px-3.5 text-[12.5px] font-medium transition-colors duration-200';

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-[132px] z-30 flex flex-col items-center gap-2" style={{ paddingLeft: 'var(--gut-l)', paddingRight: 'var(--gut-r)' }}>
      {/* what the pulse is reacting to */}
      <AnimatePresence mode="wait">
        {noteOn && <motion.div key={noteKey} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}
          className="pointer-events-auto hidden max-w-[640px] md:block">
          <LiquidGlassPanel depth="deep" radius={18} bodyClassName="px-4 py-2 text-center">
            {optical ? (
              <p className="text-[12px] leading-snug text-lens/85"><span className="tele mr-2 text-[8.5px] text-kapton">Optical</span>A camera records reflected sunlight. Cloud, smoke and night hide the surface; radar does not see them.</p>
            ) : (
              <p className="text-[12px] leading-snug text-lens/85"><span className="tele mr-2 text-[8.5px] text-lband">{info.label} · {info.role}</span>{note}</p>
            )}
          </LiquidGlassPanel>
        </motion.div>}
      </AnimatePresence>

      <LiquidGlassPanel depth="deep" refract radius={9999} className="pointer-events-auto max-w-full" bodyClassName="no-scrollbar flex items-center gap-1 overflow-x-auto p-1.5">
        {/* sensor */}
        <button type="button" aria-pressed={optical} onClick={() => setSensor(optical ? 'sar' : 'optical')} title="Compare with an optical sensor"
          className={btn + (optical ? ' text-void' : ' text-slate hover:text-lens')}>
          {optical && <span className="absolute inset-0 rounded-full bg-kapton shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]" />}
          <Eye size={15} strokeWidth={1.8} className="relative z-[1]" /><span className="relative z-[1] hidden sm:inline">Optical</span>
        </button>
        <span className="mx-1 h-6 w-px flex-none bg-lens/15" />

        {/* channels */}
        <div role="group" aria-label="Radar channel" className="flex flex-none items-center">
          {CHANNELS.map((c) => {
            const on = !optical && channel === c.id;
            return (
              <button key={c.id} type="button" aria-pressed={on} onClick={() => setChannel(c.id)} title={c.role}
                className={btn + (on ? ' text-lens' : ' text-slate hover:text-lens')}>
                {on && <LensPill id="channel-lens" tint={TINT[c.id]} />}
                <span className="relative z-[1] whitespace-nowrap font-mono text-[12px]">{c.id === 'INSAR' ? 'InSAR' : c.label}</span>
              </button>
            );
          })}
        </div>
        <span className="mx-1 h-6 w-px flex-none bg-lens/15" />

        {/* sweep */}
        <button type="button" aria-pressed={sweep} onClick={toggleSweep} title="Step through every channel"
          className={btn + ' overflow-hidden ' + (sweep ? 'text-lens' : 'text-slate hover:text-lens')}>
          {sweep && <span className="absolute inset-0 rounded-full bg-lens/10 shadow-[inset_0_0_0_1px_rgba(242,238,230,0.35)]" />}
          {sweep && <motion.span key={channel} className="absolute inset-y-0 left-0 bg-lband/25" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: SWEEP_MS / 1000, ease: 'linear' }} />}
          <RefreshCw size={14} strokeWidth={1.8} className={'relative z-[1] ' + (sweep ? 'animate-spin [animation-duration:1.9s]' : '')} />
          <span className="relative z-[1]">Sweep</span>
        </button>

        {/* band */}
        <div role="group" aria-label="Radar band" className="relative flex flex-none rounded-full bg-black/30 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
          {(['L', 'S'] as const).map((b) => {
            const on = band === b;
            return (
              <button key={b} type="button" aria-pressed={on} onClick={() => setBand(b)} title={BANDS[b].name + ' ' + BANDS[b].ghz + ' GHz · ' + BANDS[b].lambda + ' cm'}
                className={'relative flex h-[34px] items-center gap-1.5 rounded-full px-3 font-mono text-[11.5px] transition-colors ' + (on ? 'text-lens' : 'text-slate hover:text-lens')}>
                {on && <LensPill id="band-lens" tint={b === 'L' ? 'lband' : 'sband'} />}
                <span className="relative z-[1] font-semibold">{b}</span>
                <span className="relative z-[1] hidden text-[9.5px] opacity-80 lg:inline">{BANDS[b].ghz} GHz</span>
              </button>
            );
          })}
        </div>

        {/* change mask, or clouds when the optical sensor is on */}
        {optical ? (
          <button type="button" aria-pressed={clouds} onClick={() => toggle('clouds')} title="Show or remove the cloud layer"
            className={btn + (clouds ? ' text-lens' : ' text-slate hover:text-lens')}>
            {clouds && <span className="absolute inset-0 rounded-full bg-lens/10 shadow-[inset_0_0_0_1px_rgba(242,238,230,0.35)]" />}
            <Cloud size={15} strokeWidth={1.8} className="relative z-[1]" /><span className="relative z-[1] hidden sm:inline">Clouds</span>
          </button>
        ) : (
          <button type="button" aria-pressed={change} disabled={channel === 'INSAR'} onClick={() => toggle('change')} title="Tint what became brighter or darker since date A"
            className={btn + ' disabled:opacity-35 ' + (change ? 'text-lens' : 'text-slate hover:text-lens')}>
            {change && <span className="absolute inset-0 rounded-full bg-lens/10 shadow-[inset_0_0_0_1px_rgba(242,238,230,0.35)]" />}
            <GitCompareArrows size={15} strokeWidth={1.8} className="relative z-[1]" /><span className="relative z-[1] hidden sm:inline">Change</span>
          </button>
        )}
        <span className="hidden flex-none items-center gap-1.5 pl-1 pr-2.5 xl:flex" title="Active radar: cloud-penetrating">
          <Radar size={14} strokeWidth={1.7} className={optical ? 'text-slate' : 'text-lband'} />
        </span>
      </LiquidGlassPanel>
    </div>
  );
}
