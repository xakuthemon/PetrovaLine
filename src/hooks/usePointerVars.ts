/*
 * One pointer listener for the whole app.
 *  - glass panels get --mx / --my (pointer in panel pixels), --near (0..1 proximity)
 *    and --ang (direction of the pointer from the panel centre), which move the
 *    specular sheen and turn the chromatic rim;
 *  - parallax layers get --gx / --gy (pointer across the viewport, -1..1).
 */
import { useEffect, type RefObject } from 'react';

const glass = new Set<HTMLElement>();
const parallax = new Set<HTMLElement>();
let bound = false, raf = 0, px = -9999, py = -9999;

function flush(): void {
  raf = 0;
  const gx = ((px / window.innerWidth) * 2 - 1).toFixed(3), gy = ((py / window.innerHeight) * 2 - 1).toFixed(3);
  parallax.forEach((el) => { el.style.setProperty('--gx', gx); el.style.setProperty('--gy', gy); });
  glass.forEach((el) => {
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    const x = px - r.left, y = py - r.top;
    const dx = Math.max(r.left - px, 0, px - r.right), dy = Math.max(r.top - py, 0, py - r.bottom);
    const near = 1 - Math.min(1, Math.hypot(dx, dy) / 300);
    el.style.setProperty('--mx', x.toFixed(0) + 'px');
    el.style.setProperty('--my', y.toFixed(0) + 'px');
    el.style.setProperty('--near', near.toFixed(2));
    el.style.setProperty('--ang', ((Math.atan2(y - r.height / 2, x - r.width / 2) * 180) / Math.PI + 90).toFixed(0) + 'deg');
  });
}
function bind(): void {
  if (bound || typeof window === 'undefined') return;
  bound = true;
  window.addEventListener('pointermove', (e) => {
    px = e.clientX; py = e.clientY;
    if (!raf) raf = requestAnimationFrame(flush);
  }, { passive: true });
}

/** Register an element as a Liquid Glass surface that reacts to the pointer. */
export function useSpecular(ref: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    bind();
    glass.add(el);
    return () => { glass.delete(el); };
  }, [ref]);
}

/** Register an element that reads --gx / --gy for parallax. */
