/*
 * Petrova Line mark, drawn in code from the logo artwork: a planet (large cream
 * disc), a satellite (small cream disc) and the crimson line between them, which
 * thickens as it reaches the satellite. Coordinates are those of the 2000 px artwork.
 */
import type { CSSProperties, Ref } from 'react';

type P = [number, number];
export const BIG = { x: 464, y: 1097, r: 262 };
export const SMALL = { x: 1731, y: 1150, r: 67 };
/** the line's centre: a tight turn off the planet's pole, then one long falling arc */
export const SEGMENTS: [P, P, P, P][] = [
  [[464, 842], [464, 722], [522, 660], [682, 655]],
  [[682, 655], [1000, 655], [1400, 880], [1702, 1128]],
];
export const VIEWBOX = '170 610 1660 780';
export const CREAM = '#F4ECE3', CRIMSON = '#D3243F', INK = '#171824';

function at(s: [P, P, P, P], t: number): P {
  const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [a * s[0][0] + b * s[1][0] + c * s[2][0] + d * s[3][0], a * s[0][1] + b * s[1][1] + c * s[2][1] + d * s[3][1]];
}
function tangent(s: [P, P, P, P], t: number): P {
  const u = 1 - t;
  const x = 3 * u * u * (s[1][0] - s[0][0]) + 6 * u * t * (s[2][0] - s[1][0]) + 3 * t * t * (s[3][0] - s[2][0]);
  const y = 3 * u * u * (s[1][1] - s[0][1]) + 6 * u * t * (s[2][1] - s[1][1]) + 3 * t * t * (s[3][1] - s[2][1]);
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

/** Outline of the tapered line. `weight` thickens it for small sizes (favicons). */
export function linePath(weight = 1): string {
  const pts: { p: P; n: P; s: number }[] = [];
  let len = 0, prev: P | null = null;
  SEGMENTS.forEach((seg, k) => {
    for (let i = k === 0 ? 0 : 1; i <= 60; i++) {
      const t = i / 60, p = at(seg, t), d = tangent(seg, t);
      if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      pts.push({ p, n: [-d[1], d[0]], s: len });
      prev = p;
    }
  });
  const left: string[] = [], right: string[] = [];
  pts.forEach(({ p, n, s }) => {
    const f = s / len, w = (24 + 38 * Math.pow(f, 1.3)) * weight * 0.5;
    left.push((p[0] + n[0] * w).toFixed(1) + ' ' + (p[1] + n[1] * w).toFixed(1));
    right.push((p[0] - n[0] * w).toFixed(1) + ' ' + (p[1] - n[1] * w).toFixed(1));
  });
  return 'M' + left.join(' L') + ' L' + right.reverse().join(' L') + ' Z';
}
/** the centre line alone, for draw-on animations */
export const centrePath = (): string =>
  'M' + SEGMENTS[0][0].join(' ') + SEGMENTS.map((s) => ' C' + s[1].join(' ') + ' ' + s[2].join(' ') + ' ' + s[3].join(' ')).join('');

const LINE = linePath(1);

interface MarkProps {
  className?: string;
  style?: CSSProperties;
  title?: string;
  /** refs for the intro animation */
  bigRef?: Ref<SVGCircleElement>;
  smallRef?: Ref<SVGCircleElement>;
  revealRef?: Ref<SVGPathElement>;
}

export function Mark({ className = '', style, title, bigRef, smallRef, revealRef }: MarkProps) {
  const id = 'pl-reveal-' + (revealRef ? 'a' : 's');
  return (
    <svg viewBox={VIEWBOX} className={className} style={style} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {revealRef && (
        <defs>
          <mask id={id} maskUnits="userSpaceOnUse">
            <path ref={revealRef} d={centrePath()} fill="none" stroke="#fff" strokeWidth="110" strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset="0" />
          </mask>
        </defs>
      )}
      <path d={LINE} fill={CRIMSON} mask={revealRef ? `url(#${id})` : undefined} />
      <circle ref={bigRef} cx={BIG.x} cy={BIG.y} r={BIG.r} fill={CREAM} style={{ transformOrigin: `${BIG.x}px ${BIG.y}px` }} />
      <circle ref={smallRef} cx={SMALL.x} cy={SMALL.y} r={SMALL.r} fill={CREAM} style={{ transformOrigin: `${SMALL.x}px ${SMALL.y}px` }} />
    </svg>
  );
}

export function Wordmark({ className = '' }: { className?: string }) {
  return <span className={'wordmark ' + className}>Petrova Line</span>;
}

/** The full poster lockup: mark, wordmark and the wavelength tag. */
export function Lockup({ className = '' }: { className?: string }) {
  return (
    <div className={'flex flex-col items-center ' + className}>
      <Mark className="w-full" title="Petrova Line" />
      <Wordmark className="mt-[9%] text-[1em]" />
      <span className="mt-[4.5%] font-mono text-[0.42em] tracking-[0.12em] text-cream/80">λ 25.984 µm</span>
    </div>
  );
}
