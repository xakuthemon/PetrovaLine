/*
 * The liquid lens that sits behind the active option and slides, stretches and
 * settles between options with a viscous spring.
 */
import { motion } from 'motion/react';
import type { CSSProperties } from 'react';

export const SPRING = { type: 'spring', stiffness: 420, damping: 30, mass: 0.9 } as const;
export const SOFT_SPRING = { type: 'spring', stiffness: 260, damping: 28, mass: 1 } as const;

export const TINTS = {
  lens: '242, 238, 230',
  lband: '156, 203, 235',
  sband: '231, 165, 126',
  kapton: '228, 198, 143',
} as const;
export type Tint = keyof typeof TINTS;

export function LensPill({ id, tint = 'lens', radius }: { id: string; tint?: Tint; radius?: number }) {
  const style = { ['--tint' as string]: TINTS[tint], ...(radius != null ? { borderRadius: radius } : {}) } as CSSProperties;
  return <motion.span layoutId={id} className="lens-pill" style={style} transition={SPRING} aria-hidden="true" />;
}
