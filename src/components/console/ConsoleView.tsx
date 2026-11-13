/*
 * Console mode: a full-viewport radar canvas with Liquid Glass instruments floating over it.
 */
import { SARComparisonViewport } from './SARComparisonViewport';
import { CaseSwitcher } from './CaseSwitcher';
import { LiquidChannelDock } from './LiquidChannelDock';
import { PhysicsDecoder } from './PhysicsDecoder';
import { MissionTimeline } from './MissionTimeline';
import { ExportBriefModal } from './ExportBriefModal';
import { useCaseSeries, useConsoleKeys, usePlayback, useSweep } from '../../hooks/useConsole';
import { useMission } from '../../state/mission';

export default function ConsoleView() {
  const caseId = useMission((s) => s.caseId);
  const series = useCaseSeries(caseId);
  usePlayback();
  useSweep();
  useConsoleKeys();
  return (
    <div className="absolute inset-0">
      <SARComparisonViewport ready={!!series} />
      <CaseSwitcher series={series} />
      <PhysicsDecoder />
      <LiquidChannelDock />
      <MissionTimeline series={series} />
      <ExportBriefModal series={series} />
    </div>
  );
}
