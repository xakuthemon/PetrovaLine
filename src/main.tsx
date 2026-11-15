/*
 * Petrova Line — entry point.
 * Code written with AI assistance (Claude Code, Anthropic) from the team's concept;
 * see SUBMISSION.md › Use of AI.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import './index.css';

// Installable app: cache the shell for offline use when served over http(s).
if (import.meta.env.PROD && import.meta.env.MODE === 'production' && 'serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => undefined); });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
