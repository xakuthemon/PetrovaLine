/* The one number that matters for the scene, at date B. */
import type { Series } from '../../engine/scenes';
import { caseById, valuesAt } from '../../data/cases';
import { useMission } from '../../state/mission';

export function HeadlineFigure({ series }: { series: Series | null }) {
  const caseId = useMission((s) => s.caseId), m = useMission((s) => s.m), sensor = useMission((s) => s.sensor);
  const def = caseById(caseId);
  if (!series) return null;
  const head = def.headline(valuesAt(series, m));
  const mm = /^([−-]?[\d.,]+)\s*(.*)$/.exec(head.value);
  return (
    <div className={'pointer-events-none absolute z-20 transition-opacity duration-300 ' + (sensor === 'optical' ? 'opacity-40' : '')} style={{ left: 'var(--gut-l)', top: 'calc(var(--bar-t) + 14px)' }}>
      <div className="display num flex items-baseline gap-2 text-[clamp(34px,4.4vw,64px)] short:text-[28px]">
        {mm ? <>{mm[1]}<span className="text-[0.42em] font-medium tracking-normal text-cream/80">{mm[2]}</span></> : head.value}
      </div>
      <div className="mt-1 text-[13.5px] text-cream/80 short:hidden">{head.label}</div>
      <div className="mt-2 flex items-center gap-2 text-[12.5px] text-fog max-sm:hidden short:hidden">
        <span>{def.region}</span>
        <span className="rounded-full px-2 py-0.5 text-[11px] text-cream/70 shadow-[inset_0_0_0_1px_rgba(244,236,227,0.25)]">Simulated</span>
      </div>
    </div>
  );
}
