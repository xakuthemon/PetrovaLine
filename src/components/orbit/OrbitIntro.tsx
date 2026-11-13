/*
 * Orbit mode: the Apsis scene, the monumental title, two glass calls to action
 * and the telemetry lenses that drift around the spacecraft.
 */
import { useCallback, useRef } from 'react';
import { ArrowDownRight, Crosshair } from 'lucide-react';
import { ApsisOrbitScene } from './ApsisOrbitScene';
import { TelemetryLens } from './TelemetryLens';
import { MagneticButton } from '../glass/MagneticButton';
import { useParallax } from '../../hooks/usePointerVars';
import { useOrbitClock } from '../../hooks/useOrbitClock';
import { useMission } from '../../state/mission';
import { fmtEta, TARGETS } from '../../data/orbit';

export function OrbitIntro({ active }: { active: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useParallax(root);
  const diving = useMission((s) => s.diving);
  const enterConsole = useMission((s) => s.enterConsole);
  const finishDive = useMission((s) => s.finishDive);
  const setCase = useMission((s) => s.setCase);
  const { sample, pass } = useOrbitClock(400);
  const target = TARGETS[pass.caseId].name;

  const onDive = useCallback((k: number) => { root.current?.style.setProperty('--dive', k.toFixed(3)); }, []);

  return (
    <div ref={root} className="absolute inset-0 overflow-hidden" style={{ ['--dive' as string]: 0 }}>
      <ApsisOrbitScene active={active} diving={diving} onDiveProgress={onDive} onDiveEnd={finishDive} />

      {/* everything that fades as the camera dives */}
      <div className="pointer-events-none absolute inset-0" style={{ opacity: 'calc(1 - var(--dive) * 3)' }}>
        {/* telemetry lenses (desktop: drifting around the spacecraft) */}
        <div className="absolute inset-0 hidden lg:block">
          <TelemetryLens label="Altitude" value={sample.altKm.toFixed(1)} unit="km" className="absolute left-[44%] top-[15%]" depth={1.2} />
          <TelemetryLens label="L / S lock" value="1.25 · 3.2" unit="GHz" dots={['lband', 'sband']} className="absolute right-[19%] top-[11.5%]" depth={0.7} float="b" delay={-2} />
          <TelemetryLens label="Ground velocity" value={sample.velKms.toFixed(3)} unit="km/s" className="absolute right-[3.5%] top-[27%]" depth={1.6} delay={-4} />
          <TelemetryLens label="Incidence" value={sample.incidence.toFixed(1)} unit="°" className="absolute right-[5%] top-[56%]" depth={1.1} float="b" delay={-1} />
          <TelemetryLens label="Orbit" value={sample.orbit.toLocaleString('en-US').replace(/,/g, ' ')} className="absolute left-[40.5%] top-[49%]" depth={0.8} delay={-3} />
          <TelemetryLens label={pass.inView ? 'Acquiring' : 'Next acquisition'} value={target} unit={pass.inView ? undefined : 'T−' + fmtEta(pass.etaSec)} dots={['kapton']} className="absolute right-[24%] top-[76%]" depth={1.4} float="b" delay={-5} />
        </div>

        {/* title block */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-4 pb-[max(28px,5.5vh)] sm:gap-5" style={{ paddingLeft: 'var(--gut-l)', paddingRight: 'var(--gut-r)' }}>
          <div className="max-w-[1340px] sm:pl-2">
            <p className="tele text-[9.5px] text-slate sm:text-[10.5px]">NASA–ISRO NISAR <span className="mx-2 text-lband">L 24 cm</span><span className="text-sband">S 9.4 cm</span></p>
            <h1 className="etched mt-3 whitespace-nowrap font-light uppercase leading-[0.9] text-lens [font-size:clamp(32px,7.6vw,122px)] [letter-spacing:0.16em] sm:[letter-spacing:0.3em]">TerraWaltz</h1>
            <p className="mt-2 font-serif italic leading-none text-lens/90 [font-size:clamp(22px,2.6vw,40px)] sm:mt-3">Dancing with the SARs</p>
            <p className="mt-4 max-w-[52ch] text-[14px] leading-relaxed text-lens/75 sm:mt-5 sm:text-[15.5px]">
              Two radar wavelengths. One planet in motion. Read the subtle choreography of water, ice, forests, and fault lines.
            </p>
            <div className="pointer-events-auto mt-5 flex flex-wrap items-center gap-3 sm:mt-7">
              <MagneticButton primary tint="lband" onClick={() => enterConsole(true)}>
                Enter Radar Console <ArrowDownRight size={17} strokeWidth={1.8} />
              </MagneticButton>
              <MagneticButton tint="kapton" onClick={() => { setCase(pass.caseId); enterConsole(true); }} ariaLabel={'Follow current pass over ' + target}>
                <Crosshair size={16} strokeWidth={1.7} /> Follow Current Pass
                <span className="tele hidden text-[9px] text-slate sm:inline">{target}</span>
              </MagneticButton>
            </div>
          </div>
        </div>

        <p className="tele absolute right-[var(--gut-r)] top-[84px] hidden text-right text-[8.5px] leading-relaxed text-slate/80 md:block">
          Procedural model · not to scale<br />Demonstrative telemetry, not live
        </p>
      </div>

      {/* the veil that closes over the scene at the end of the dive */}
      <div className="pointer-events-none absolute inset-0" style={{ opacity: 'calc(var(--dive) * var(--dive) * var(--dive))', background: 'radial-gradient(circle at 62% 60%, rgba(0,240,255,0.55), rgba(4,6,10,0.96) 58%)' }} />
    </div>
  );
}
