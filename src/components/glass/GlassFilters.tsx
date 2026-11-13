/* SVG filter used by `.lg[data-refract]`: a soft turbulence field displaces the backdrop like liquid. */
export function GlassFilters() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute', pointerEvents: 'none' }}>
      <defs>
        <filter id="lg-refract" x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.011 0.019" numOctaves={2} seed={11} result="noise" />
          <feGaussianBlur in="noise" stdDeviation="1.6" result="soft" />
          <feDisplacementMap in="SourceGraphic" in2="soft" scale={30} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
