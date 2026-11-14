/*
 * Console header: back to the story, the mission mark, and a UTC clock.
 */
import { ArrowLeft } from 'lucide-react';
import { LiquidGlassPanel } from './glass/LiquidGlassPanel';
import { useMission } from '../state/mission';
import { useOrbitClock, utcClock } from '../hooks/useOrbitClock';

export function OrbitMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 34" className={className} aria-hidden="true">
      <circle cx="17" cy="17" r="6" fill="none" stroke="#F2EEE6" strokeWidth="1" opacity="0.7" />
      <ellipse cx="17" cy="17" rx="15" ry="6.2" transform="rotate(-24 17 17)" fill="none" stroke="#E4C68F" strokeWidth="1" />
      <circle cx="30.4" cy="11.4" r="1.9" fill="#F2DDB0" />
    </svg>
  );
}

export function MissionCapsule() {
  const setMode = useMission((s) => s.setMode);
  const { now } = useOrbitClock(1000);
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center pt-3" style={{ paddingLeft: 'var(--gut-l)', paddingRight: 'var(--gut-r)' }}>
      <LiquidGlassPanel depth="deep" radius={9999} className="pointer-events-auto w-full max-w-[1340px]"
        bodyClassName="flex h-[54px] items-center gap-3 pl-2 pr-5">
        <button type="button" onClick={() => setMode('story')} aria-label="Back to the story"
          className="flex h-10 items-center gap-2.5 rounded-full pl-2 pr-4 text-[13px] text-lens/80 transition-colors hover:bg-lens/10 hover:text-lens">
          <ArrowLeft size={16} strokeWidth={1.6} />
          <OrbitMark className="h-[26px] w-[26px]" />
          <span className="font-medium tracking-[-0.01em] text-lens">TerraWaltz</span>
        </button>
        <span className="tele hidden text-[9px] text-slate sm:inline">Radar console</span>
        <div className="ml-auto flex items-center gap-5">
          <span className="tele hidden text-[9px] text-kapton/80 md:inline">Simulated data</span>
          <span className="font-mono text-[12px] tabular-nums text-lens/80">{utcClock(now)}</span>
        </div>
      </LiquidGlassPanel>
    </header>
  );
}
