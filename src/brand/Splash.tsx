/*
 * Launch screen: the mark draws itself (planet, then the line, then the satellite),
 * the name settles in, and the screen lifts away. About two seconds; any key, click
 * or scroll skips it.
 */
import { useEffect, useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { Mark, Wordmark } from './Logo';

export function Splash({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const big = useRef<SVGCircleElement>(null);
  const small = useRef<SVGCircleElement>(null);
  const reveal = useRef<SVGPathElement>(null);
  const word = useRef<HTMLDivElement>(null);
  const tag = useRef<HTMLSpanElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);

  useLayoutEffect(() => {
    const t = gsap.timeline({ onComplete: onDone });
    t.fromTo(big.current, { scale: 0.55, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.7, ease: 'expo.out' }, 0.05)
      .fromTo(reveal.current, { attr: { 'stroke-dashoffset': 1 } }, { attr: { 'stroke-dashoffset': 0 }, duration: 0.85, ease: 'power3.inOut' }, 0.35)
      .fromTo(small.current, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'back.out(2.2)' }, 1.05)
      .fromTo(word.current, { opacity: 0, letterSpacing: '0.6em' }, { opacity: 1, letterSpacing: '0.34em', duration: 1.0, ease: 'expo.out' }, 0.9)
      .fromTo(tag.current, { opacity: 0 }, { opacity: 0.8, duration: 0.6 }, 1.25)
      .to(root.current, { opacity: 0, duration: 0.55, ease: 'power2.inOut' }, 2.1)
      .set(root.current, { pointerEvents: 'none' });
    tl.current = t;
    return () => { t.kill(); };
  }, [onDone]);

  useEffect(() => {
    const skip = () => { const t = tl.current; if (t && t.progress() < 0.9) t.seek(2.1); };
    window.addEventListener('keydown', skip);
    window.addEventListener('wheel', skip, { passive: true });
    window.addEventListener('pointerdown', skip);
    return () => { window.removeEventListener('keydown', skip); window.removeEventListener('wheel', skip); window.removeEventListener('pointerdown', skip); };
  }, []);

  return (
    <div ref={root} className="fixed inset-0 z-[100] grid place-items-center bg-ink" role="presentation">
      <div className="flex w-[min(78vw,520px)] flex-col items-center">
        <Mark className="w-full" bigRef={big} smallRef={small} revealRef={reveal} />
        <div ref={word} className="wordmark mt-[9%] text-[clamp(20px,4.6vw,34px)] text-cream"><Wordmark /></div>
        <span ref={tag} className="mt-4 font-mono text-[clamp(12px,1.6vw,15px)] tracking-[0.12em] text-cream/80">λ 25.984 µm</span>
      </div>
    </div>
  );
}
