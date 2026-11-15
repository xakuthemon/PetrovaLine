/*
 * Petrova Line — a scroll presentation (story) and the radar console.
 */
import { lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Landing from './landing/Landing';
import { useMission } from './state/mission';

const ConsoleView = lazy(() => import('./components/console/ConsoleView'));

const fade = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] } };

export default function App() {
  const mode = useMission((s) => s.mode);
  return (
    <div className="relative h-full w-full overflow-hidden bg-ink">
      <AnimatePresence mode="wait">
        {mode === 'story' && (
          <motion.main key="story" className="absolute inset-0" {...fade}>
            <Landing />
          </motion.main>
        )}
        {mode === 'console' && (
          <motion.main key="console" className="absolute inset-0" {...fade}>
            <Suspense fallback={null}><ConsoleView /></Suspense>
          </motion.main>
        )}
      </AnimatePresence>
      <div id="dossier-host"><div id="dossier" /></div>
    </div>
  );
}
