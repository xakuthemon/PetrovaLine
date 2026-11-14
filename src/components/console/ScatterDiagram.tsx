/* Animated vector diagram of one scattering mechanism. */
import type { Mechanism } from '../../engine/render';

const IN = '#9CCBEB', OUT = '#E4C68F', INK = '#F2EEE6';

export function ScatterDiagram({ kind, active }: { kind: Mechanism; active: boolean }) {
  const run = { strokeDasharray: '5 5', animation: active ? 'dash-run 1.3s linear infinite' : 'none' } as const;
  const dim = active ? 1 : 0.55;
  return (
    <svg viewBox="0 0 120 76" className="h-full w-full" aria-hidden="true" style={{ opacity: dim }}>
      {/* ground */}
      <path d={kind === 'surface' ? 'M4 60 H116' : 'M4 62 H116'} stroke={INK} strokeOpacity="0.55" strokeWidth="1.2" />
      {kind === 'surface' && (
        <>
          <path d="M4 60 H116 V72 H4 Z" fill={IN} fillOpacity="0.07" />
          <path d="M14 8 L58 60" stroke={IN} strokeWidth="1.6" fill="none" style={run} />
          <path d="M58 60 L104 6" stroke={INK} strokeOpacity="0.85" strokeWidth="1.6" fill="none" style={run} />
          <path d="M101 4 l5 1 l-2.6 5" stroke={INK} strokeOpacity="0.85" strokeWidth="1.4" fill="none" />
          <path d="M58 60 L44 44" stroke={OUT} strokeOpacity="0.5" strokeWidth="1" fill="none" strokeDasharray="2 3" />
          <text x="76" y="44" fontSize="6.5" fill={INK} fillOpacity="0.6" fontFamily="'JetBrains Mono Variable', monospace">mirrored away</text>
        </>
      )}
      {kind === 'volume' && (
        <>
          <g fill="#10B981" fillOpacity="0.18" stroke="#10B981" strokeOpacity="0.55" strokeWidth="0.8">
            <ellipse cx="48" cy="28" rx="20" ry="13" /><ellipse cx="74" cy="32" rx="22" ry="14" /><ellipse cx="60" cy="20" rx="16" ry="10" />
          </g>
          <path d="M52 40 V62 M74 44 V62" stroke={INK} strokeOpacity="0.4" strokeWidth="1.4" />
          <path d="M12 6 L46 22" stroke={IN} strokeWidth="1.6" fill="none" style={run} />
          <path d="M46 22 L62 30 L50 36 L70 40 L60 26 L78 30" stroke={IN} strokeOpacity="0.8" strokeWidth="1.1" fill="none" style={run} />
          <path d="M54 20 L20 4" stroke={OUT} strokeWidth="1.6" fill="none" style={run} transform="translate(4 8)" />
          <g fill={OUT}><circle cx="62" cy="30" r="1.4" /><circle cx="50" cy="36" r="1.4" /><circle cx="70" cy="40" r="1.4" /><circle cx="60" cy="26" r="1.4" /></g>
        </>
      )}
      {kind === 'double' && (
        <>
          <path d="M4 62 H116 V72 H4 Z" fill={IN} fillOpacity="0.08" />
          <path d="M88 62 V10" stroke={INK} strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" />
          <path d="M14 6 L62 62" stroke={IN} strokeWidth="1.6" fill="none" style={run} />
          <path d="M62 62 L88 32" stroke={OUT} strokeWidth="1.6" fill="none" style={run} />
          <path d="M88 32 L60 0" stroke={OUT} strokeWidth="1.6" fill="none" style={run} transform="translate(-22 4)" />
          <path d="M82 62 h6 v-6" stroke={INK} strokeOpacity="0.6" strokeWidth="0.8" fill="none" />
        </>
      )}
    </svg>
  );
}
