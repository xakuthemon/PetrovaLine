import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import App from './App';
import './index.css';

// Edge refraction through an SVG displacement filter only works in Chromium's backdrop-filter.
if (/Chrome\//.test(navigator.userAgent) && !/Edg\/1[0-7]\b/.test(navigator.userAgent)) {
  document.documentElement.classList.add('refract');
}

// Adaptive quality: if the first seconds run slowly, drop the displacement refraction, then the heavy blur.
window.setTimeout(() => {
  let n = 0, t0 = 0;
  const tick = (t: number) => {
    if (!t0) t0 = t;
    n++;
    if (t - t0 < 2400) { requestAnimationFrame(tick); return; }
    const fps = (n - 1) / ((t - t0) / 1000);
    if (fps < 30) document.documentElement.classList.remove('refract');
    if (fps < 16) document.documentElement.classList.add('lite');
  };
  requestAnimationFrame(tick);
}, 1800);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>,
);
