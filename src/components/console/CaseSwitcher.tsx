/*
 * Top dock: four mission lenses. The active lens widens to show its region,
 * acquisition badge and a live headline metric.
 */
import { motion } from 'motion/react';
import { LiquidGlassPanel } from '../glass/LiquidGlassPanel';
import { LensPill, SOFT_SPRING } from '../glass/LensPill';
import { CaseThumb } from './CaseThumb';
import { CASES, valuesAt } from '../../data/cases';
import type { Series } from '../../engine/scenes';
import { tOf, useMission } from '../../state/mission';

export function CaseSwitcher({ series }: { series: Series | null }) {
  const caseId = useMission((s) => s.caseId), setCase = useMission((s) => s.setCase), m = useMission((s) => s.m);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-[78px] z-30 flex justify-center" style={{ paddingLeft: 'var(--gut-l)', paddingRight: 'var(--gut-r)' }}>
      <LiquidGlassPanel depth="deep" radius={30} className="pointer-events-auto max-w-full" bodyClassName="no-scrollbar flex gap-1 overflow-x-auto p-1.5">
        {CASES.map((c) => {
          const on = c.id === caseId;
          const head = on && series ? c.headline(valuesAt(series, m)) : null;
          return (
            <motion.button key={c.id} layout transition={SOFT_SPRING} type="button" onClick={() => { if (!on) setCase(c.id); }}
              aria-pressed={on} aria-label={c.index + ' ' + c.name + ', ' + c.focusLine}
              className={'relative flex flex-none items-center gap-3 rounded-[24px] p-1.5 text-left transition-colors duration-200 ' + (on ? 'pr-4 text-lens' : 'pr-3 text-slate hover:text-lens')}>
              {on && <LensPill id="case-lens" tint="lband" radius={24} />}
              <motion.span layout="position" className="relative z-[1] block flex-none">
                <CaseThumb id={c.id} t={tOf(c.defaults.m)} className={'rounded-[18px] ' + (on ? 'h-[58px] w-[86px]' : 'h-[44px] w-[62px]')} />
              </motion.span>
              <motion.span layout="position" className="relative z-[1] flex min-w-0 flex-col leading-none">
                <span className="tele flex items-center gap-2 text-[8.5px]">
                  <span className={on ? 'text-lband' : ''}>{c.index}</span>
                  {on && <span className="rounded-full bg-black/35 px-1.5 py-[3px] text-[7.5px] text-kapton">{c.badge}</span>}
                </span>
                <span className={'mt-1.5 whitespace-nowrap font-medium tracking-wide ' + (on ? 'text-[14px]' : 'hidden text-[12px] md:block')}>{c.name}</span>
                {on && <span className="mt-1.5 hidden whitespace-nowrap text-[11px] text-lens/70 sm:block">{c.focusLine}</span>}
              </motion.span>
              {head && (
                <motion.span layout="position" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="relative z-[1] ml-2 hidden flex-col border-l border-lens/15 pl-4 leading-none lg:flex">
                  <span className="tele text-[8px] text-slate">{head.label}</span>
                  <span className="etched mt-2 whitespace-nowrap font-mono text-[17px] font-medium text-lens">{head.value}</span>
                </motion.span>
              )}
            </motion.button>
          );
        })}
      </LiquidGlassPanel>
    </div>
  );
}
