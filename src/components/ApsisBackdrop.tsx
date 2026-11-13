/*
 * Apsidal geometry behind every mode: fine elliptical hairlines with periapsis and
 * apoapsis ticks, a degree ruler and a planetary limb, turning almost imperceptibly.
 */
import { useRef } from 'react';
import { useParallax } from '../hooks/usePointerVars';

export function ApsisBackdrop({ limb = true }: { limb?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useParallax(ref);
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5);
  return (
    <div ref={ref} aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice" className="h-full w-full"
        style={{ transform: 'translate3d(calc(var(--gx, 0) * -16px), calc(var(--gy, 0) * -10px), 0) scale(1.04)' }}>
        <defs>
          <radialGradient id="apsis-sweep" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="#F4FBFF" stopOpacity="0" />
            <stop offset="0.72" stopColor="#00F0FF" stopOpacity="0.05" />
            <stop offset="1" stopColor="#00F0FF" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="limb-g" x1="0" x2="1">
            <stop offset="0" stopColor="#00F0FF" stopOpacity="0" />
            <stop offset="0.35" stopColor="#9fe9ff" stopOpacity="0.85" />
            <stop offset="0.6" stopColor="#F4FBFF" stopOpacity="0.95" />
            <stop offset="0.82" stopColor="#F5B041" stopOpacity="0.55" />
            <stop offset="1" stopColor="#F5B041" stopOpacity="0" />
          </linearGradient>
          <filter id="limb-blur" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="9" /></filter>
        </defs>

        <g style={{ transformOrigin: '800px 500px', animation: 'apsis-spin 540s linear infinite' }}>
          <path d="M800 500 L800 20 A480 480 0 0 1 1215 260 Z" fill="url(#apsis-sweep)" />
          <g fill="none" stroke="#F4FBFF" strokeWidth="0.6">
            <ellipse cx="800" cy="500" rx="700" ry="262" transform="rotate(-17 800 500)" opacity="0.2" />
            <ellipse cx="800" cy="500" rx="560" ry="196" transform="rotate(-17 800 500)" opacity="0.13" />
            <ellipse cx="800" cy="500" rx="860" ry="350" transform="rotate(-17 800 500)" opacity="0.09" />
            <circle cx="800" cy="500" r="480" opacity="0.1" />
          </g>
          {ticks.map((d) => (
            <line key={d} x1="800" y1={d % 15 === 0 ? 12 : 17} x2="800" y2="20" stroke={d % 45 === 0 ? '#F5B041' : '#F4FBFF'}
              strokeWidth={d % 45 === 0 ? 1 : 0.6} opacity={d % 15 === 0 ? 0.55 : 0.22} transform={`rotate(${d} 800 500)`} />
          ))}
          {/* periapsis and apoapsis on the main ellipse */}
          <g transform="rotate(-17 800 500)" fontFamily="'JetBrains Mono Variable', monospace" fontSize="9" letterSpacing="2" fill="#F4FBFF">
            <line x1="100" y1="488" x2="100" y2="512" stroke="#F5B041" strokeWidth="1" opacity="0.8" />
            <line x1="1500" y1="488" x2="1500" y2="512" stroke="#00F0FF" strokeWidth="1" opacity="0.8" />
            <text x="112" y="484" opacity="0.5">APOAPSIS</text>
            <text x="1416" y="530" opacity="0.5">PERIAPSIS</text>
            <line x1="100" y1="500" x2="1500" y2="500" stroke="#F4FBFF" strokeWidth="0.5" strokeDasharray="2 9" opacity="0.2" />
          </g>
        </g>

        {limb && (
          <g>
            <circle cx="800" cy="2470" r="1560" fill="#05080d" />
            <circle cx="800" cy="2470" r="1560" fill="none" stroke="url(#limb-g)" strokeWidth="7" filter="url(#limb-blur)" opacity="0.8" />
            <circle cx="800" cy="2470" r="1560" fill="none" stroke="url(#limb-g)" strokeWidth="1.2" />
          </g>
        )}
      </svg>
    </div>
  );
}
