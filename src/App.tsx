/*
 * TerraWaltz — one spatial page, three choreographed modes.
 */
import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { GlassFilters } from './components/glass/GlassFilters';
import { ApsisBackdrop } from './components/ApsisBackdrop';
import { MissionCapsule } from './components/MissionCapsule';
import { OrbitIntro } from './components/orbit/OrbitIntro';
import { useMission } from './state/mission';

const ConsoleView = lazy(() => import('./components/console/ConsoleView'));
const SignalStory = lazy(() => import('./components/signal/SignalStory'));

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.45, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] } };

export default function App() {
  const mode = useMission((s) => s.mode);
  return (
    <div className="relative h-full w-full overflow-hidden bg-void">
      <GlassFilters />
      <ApsisBackdrop limb={mode !== 'orbit'} />

      {/* the orbit scene stays mounted so its WebGL context and textures are built once */}
      <motion.div className="absolute inset-0" animate={{ opacity: mode === 'orbit' ? 1 : 0 }} transition={{ duration: 0.45 }}
        style={{ pointerEvents: mode === 'orbit' ? 'auto' : 'none', visibility: mode === 'orbit' ? 'visible' : 'hidden' }} aria-hidden={mode !== 'orbit'}>
        <OrbitIntro active={mode === 'orbit'} />
      </motion.div>

      <AnimatePresence mode="wait">
        {mode === 'console' && (
          <motion.main key="console" className="absolute inset-0" {...fade}>
            <Suspense fallback={null}><ConsoleView /></Suspense>
          </motion.main>
        )}
        {mode === 'signal' && (
          <motion.main key="signal" className="absolute inset-0" {...fade}>
            <Suspense fallback={null}><SignalStory /></Suspense>
          </motion.main>
        )}
      </AnimatePresence>

      <MissionCapsule />
      <div id="dossier-host"><div id="dossier" /></div>
    </div>
  );
}
