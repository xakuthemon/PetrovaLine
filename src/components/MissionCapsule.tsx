/*
 * The persistent Liquid Glass mission capsule: mission mark, the morphing mode
 * switcher, demonstrative orbit telemetry, pass status and UTC clock.
 */
import { Orbit, Radar, AudioWaveform, type LucideIcon } from 'lucide-react';
import { LiquidGlassPanel } from './glass/LiquidGlassPanel';
import { LensPill } from './glass/LensPill';
import { useMission, type Mode } from '../state/mission';
import { useOrbitClock, utcClock } from '../hooks/useOrbitClock';
import { fmtEta, fmtLat, fmtLon, TARGETS } from '../data/orbit';

const TABS: { id: Mode; label: string; icon: LucideIcon }[] = [
  { id: 'orbit', label: 'Orbit', icon: Orbit },
  { id: 'console', label: 'Console', icon: Radar },
  { id: 'signal', label: 'Signal', icon: AudioWaveform },
];

function Readout({ k, v, className = '' }: { k: string; v: string; className?: string }) {
  return (
    <div className={'flex flex-col leading-none ' + className}>
      <span className="tele text-[8.5px] text-slate">{k}</span>
      <span className="etched mt-[5px] font-mono text-[12px] text-lens">{v}</span>
    </div>
  );
}

/** Two travelling sines at the 24 : 9.4 wavelength ratio. */
function HarmonicWave() {
  const path = (period: number, amp: number) => {
    let d = 'M0 9';
    for (let x = 0; x <= 120; x += 1) d += ' L' + x + ' ' + (9 - Math.sin((x / period) * Math.PI * 2) * amp).toFixed(2);
    return d;
  };
  return (
    <svg width="46" height="18" viewBox="0 0 46 18" aria-hidden="true" className="overflow-hidden">
      <g style={{ animation: 'wave-l 1.9s linear infinite' }}><path d={path(24, 5.2)} fill="none" stroke="#00F0FF" strokeWidth="1.3" /></g>
      <g style={{ animation: 'wave-s 0.9s linear infinite' }}><path d={path(9.4, 3)} fill="none" stroke="#FF2A85" strokeWidth="1.1" opacity="0.9" /></g>
    </svg>
  );
}

export function MissionCapsule() {
  const mode = useMission((s) => s.mode);
  const setMode = useMission((s) => s.setMode);
  const { now, sample, pass } = useOrbitClock(500);
  const target = TARGETS[pass.caseId].name;

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-3" style={{ paddingLeft: 'var(--gut-l)', paddingRight: 'var(--gut-r)' }}>
      <LiquidGlassPanel depth="deep" refract radius={9999} className="pointer-events-auto w-full max-w-[1340px]"
        bodyClassName="flex h-[54px] items-center gap-2 pl-4 pr-2 sm:gap-4 sm:pl-5 sm:pr-3">
        {/* mission mark with apsis indicator */}
        <div className="flex min-w-0 items-center gap-2.5">
          <svg viewBox="0 0 34 34" className="h-[30px] w-[30px] flex-none" aria-hidden="true">
            <circle cx="17" cy="19" r="6.5" fill="none" stroke="#F4FBFF" strokeWidth="1" opacity="0.55" />
            <ellipse cx="17" cy="17" rx="15" ry="6.2" transform="rotate(-24 17 17)" fill="none" stroke="#F5B041" strokeWidth="1" />
            <circle r="2" fill="#00F0FF">
              <animateMotion dur="9s" repeatCount="indefinite" rotate="auto" path="M3.3 23.1 A15 6.2 -24 1 1 30.7 10.9 A15 6.2 -24 1 1 3.3 23.1" />
            </circle>
          </svg>
          <div className="hidden min-w-0 flex-col leading-none xs:flex">
            <span className="text-[12.5px] font-semibold tracking-[0.3em] text-lens">NISAR</span>
            <span className="tele mt-[5px] truncate text-[8.5px] text-slate">TerraWaltz · demonstrative data</span>
          </div>
        </div>

        {/* mode switcher */}
        <nav aria-label="Mission mode" className="relative mx-auto flex flex-none rounded-full bg-black/30 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)] lg:mx-0">
          {TABS.map((t) => {
            const on = mode === t.id;
            return (
              <button key={t.id} type="button" onClick={() => setMode(t.id)} aria-current={on ? 'page' : undefined}
                className={'relative flex h-10 items-center gap-2 rounded-full px-3 text-[12.5px] font-medium transition-colors duration-200 sm:px-4 ' + (on ? 'text-lens' : 'text-slate hover:text-lens')}>
                {on && <LensPill id="mode-lens" tint={t.id === 'signal' ? 'sband' : t.id === 'orbit' ? 'kapton' : 'lband'} />}
                <t.icon size={15} strokeWidth={1.7} className="relative z-[1]" />
                <span className="relative z-[1]">{t.label}</span>
              </button>
            );
          })}
        </nav>

        {/* telemetry */}
        <div className="ml-auto hidden items-center gap-5 lg:flex">
          <Readout k="Lat" v={fmtLat(sample.lat)} />
          <Readout k="Lon" v={fmtLon(sample.lon)} />
          <Readout k="Alt" v={sample.altKm.toFixed(1) + ' km'} className="hidden xl:flex" />
          <div className="flex items-center gap-2.5 rounded-full bg-black/30 py-1.5 pl-2.5 pr-3 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
            <span className="relative flex h-2 w-2">
              <span className={'absolute inline-flex h-full w-full rounded-full ' + (pass.inView ? 'bg-lband' : 'bg-kapton')} />
              {pass.inView && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-lband opacity-70" />}
            </span>
            <div className="flex flex-col leading-none">
              <span className="tele text-[8.5px] text-slate">{pass.inView ? 'Acquiring' : 'Next pass'}</span>
              <span className="etched mt-[5px] whitespace-nowrap font-mono text-[11px] text-lens">{target}{pass.inView ? '' : ' · T−' + fmtEta(pass.etaSec)}</span>
            </div>
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3 lg:ml-0">
          <Readout k="UTC" v={utcClock(now)} className="hidden sm:flex" />
          <span className="hidden sm:block"><HarmonicWave /></span>
        </div>
      </LiquidGlassPanel>
    </header>
  );
}
