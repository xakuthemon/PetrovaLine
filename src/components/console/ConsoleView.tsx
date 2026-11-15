/*
 * Console: the radar map with a top bar, the scene's headline number, the pixel
 * panel and the bottom control bar. Bar heights feed --bar-t / --bar-b so overlays
 * never sit under them on any screen.
 */
import { SARComparisonViewport } from './SARComparisonViewport';
import { ConsoleTopBar } from './ConsoleTopBar';
import { HeadlineFigure } from './HeadlineFigure';
import { PixelPanel } from './PixelPanel';
import { ControlBar } from './ControlBar';
import { ExportBriefModal } from './ExportBriefModal';
import { AboutSheet } from '../AboutSheet';
import { useCaseSeries, useConsoleKeys, usePlayback, useSweep } from '../../hooks/useConsole';
import { useMission } from '../../state/mission';

export default function ConsoleView() {
  const caseId = useMission((s) => s.caseId);
  const series = useCaseSeries(caseId);
  usePlayback();
  useSweep();
  useConsoleKeys();
  return (
    <div className="console absolute inset-0" style={{ ['--bar-t' as string]: '70px', ['--bar-b' as string]: '120px' }}>
      <SARComparisonViewport ready={!!series} />
      <ConsoleTopBar />
      <HeadlineFigure series={series} />
      <PixelPanel />
      <ControlBar series={series} />
      <ExportBriefModal series={series} />
      <AboutSheet />
    </div>
  );
}
