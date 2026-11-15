/*
 * Console top bar: the mark (back to the story), the four scenes, and actions.
 */
import { Download, Info, MonitorDown } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Pill } from '../ui/Segmented';
import { Mark, Wordmark } from '../../brand/Logo';
import { CASES } from '../../data/cases';
import type { SceneId } from '../../engine/scenes';
import { useMission } from '../../state/mission';
import { useInstall } from '../../hooks/useInstall';
import { useBarVar } from './ControlBar';

export const SHORT: Record<SceneId, string> = { caspian: 'Water', pantanal: 'Forest', fault: 'Fault', glacier: 'Ice' };

export function ConsoleTopBar() {
  const caseId = useMission((s) => s.caseId);
  const { setCase, setMode, setExportOpen, setAboutOpen } = useMission.getState();
  const { canInstall, install } = useInstall();
  const bar = useBarVar('--bar-t');
  return (
    <header ref={bar} className="pointer-events-none absolute inset-x-0 top-0 z-40" style={{ paddingLeft: 'var(--gut-l)', paddingRight: 'var(--gut-r)', paddingTop: 'calc(var(--safe-t) + 10px)' }}>
      <Panel depth="deep" radius={9999} className="pointer-events-auto mx-auto w-full max-w-[1400px]" bodyClassName="flex h-12 items-center gap-1 px-1.5 short:h-11">
        <button type="button" onClick={() => setMode('story')} aria-label="Petrova Line: back to the story" title="Back to the story"
          className="flex h-10 flex-none items-center gap-2.5 rounded-full pl-2 pr-3 transition-colors hover:bg-cream/10">
          <Mark className="h-[18px] w-auto" />
          <Wordmark className="hidden text-[10.5px] text-cream lg:inline" />
        </button>

        <nav aria-label="Scenes" className="no-scrollbar mx-auto flex min-w-0 items-center gap-0.5 overflow-x-auto">
          {CASES.map((c) => {
            const on = c.id === caseId;
            return (
              <button key={c.id} type="button" aria-pressed={on} title={c.name} onClick={() => { if (!on) setCase(c.id); }}
                className={'relative flex h-9 flex-none items-center rounded-full px-3 text-[13px] font-medium transition-colors duration-200 sm:px-4 sm:text-[13.5px] ' + (on ? 'text-ink' : 'text-cream/70 hover:text-cream')}>
                {on && <Pill id="scene-pill" />}
                <span className="relative z-[1]">{SHORT[c.id]}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex flex-none items-center">
          {canInstall && <button type="button" className="icon-btn" onClick={install} aria-label="Install the app" title="Install the app"><MonitorDown size={17} strokeWidth={1.7} /></button>}
          <button type="button" className="icon-btn" onClick={() => setExportOpen(true)} aria-label="Export mission brief" title="Export brief"><Download size={17} strokeWidth={1.7} /></button>
          <button type="button" className="icon-btn" onClick={() => setAboutOpen(true)} aria-label="About and data sources" title="About"><Info size={17} strokeWidth={1.7} /></button>
        </div>
      </Panel>
    </header>
  );
}
