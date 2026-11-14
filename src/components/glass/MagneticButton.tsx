/*
 * Liquid Glass call-to-action: pulls toward the pointer and ripples from the press point.
 */
import { useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValue, useSpring } from 'motion/react';
import { useSpecular } from '../../hooks/usePointerVars';
import { TINTS, type Tint } from './LensPill';

interface Props {
  children: ReactNode;
  onClick?: () => void;
  tint?: Tint;
  primary?: boolean;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}

export function MagneticButton({ children, onClick, tint = 'lens', primary = false, className = '', disabled, ariaLabel }: Props) {
  const ref = useRef<HTMLButtonElement>(null);
  useSpecular(ref);
  const mx = useMotionValue(0), my = useMotionValue(0);
  const x = useSpring(mx, { stiffness: 260, damping: 18, mass: 0.6 });
  const y = useSpring(my, { stiffness: 260, damping: 18, mass: 0.6 });
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);

  return (
    <motion.button
      ref={ref}
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      className={'lg group inline-flex h-12 select-none items-center overflow-hidden px-6 text-[13.5px] font-medium tracking-wide text-lens disabled:opacity-40 ' + className}
      data-depth={primary ? 'mid' : 'clear'}
      data-refract="true"
      style={{ x, y, ['--lg-r' as string]: '9999px', ['--tint' as string]: TINTS[tint] }}
      whileTap={{ scale: 0.965 }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        mx.set((e.clientX - (r.left + r.width / 2)) * 0.22);
        my.set((e.clientY - (r.top + r.height / 2)) * 0.3);
      }}
      onPointerLeave={() => { mx.set(0); my.set(0); }}
      onPointerDown={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const id = Date.now();
        setRipples((a) => [...a.slice(-2), { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
        window.setTimeout(() => setRipples((a) => a.filter((q) => q.id !== id)), 700);
      }}
      onClick={onClick}
    >
      {primary && <span className="absolute inset-0 z-0 rounded-full" style={{ background: 'radial-gradient(120% 160% at 20% 0%, rgba(var(--tint),0.34), rgba(var(--tint),0.06) 60%)' }} />}
      {ripples.map((r) => (
        <span key={r.id} className="pointer-events-none absolute z-[1] h-[260px] w-[260px] rounded-full"
          style={{ left: r.x, top: r.y, background: 'radial-gradient(circle, rgba(242,238,230,0.5), rgba(242,238,230,0) 62%)', animation: 'ripple 700ms ease-out forwards' }} />
      ))}
      <span className="lg-body flex items-center gap-2.5">{children}</span>
    </motion.button>
  );
}
