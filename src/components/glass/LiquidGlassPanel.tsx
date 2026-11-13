/*
 * Liquid Glass surface. Layers (see index.css `.lg`):
 *   backdrop blur + saturation (+ displacement refraction in Chromium),
 *   specular rim shadows, a pointer-tracked sheen, and a chromatic edge ring.
 */
import { forwardRef, useImperativeHandle, useRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';
import { useSpecular } from '../../hooks/usePointerVars';

export interface LiquidGlassProps extends HTMLAttributes<HTMLDivElement> {
  /** clear: over dark space · mid · deep: carries text over bright radar imagery */
  depth?: 'clear' | 'mid' | 'deep';
  /** bend the backdrop through the displacement filter (small surfaces only) */
  refract?: boolean;
  radius?: number | string;
  bodyClassName?: string;
  children?: ReactNode;
}

export const LiquidGlassPanel = forwardRef<HTMLDivElement, LiquidGlassProps>(function LiquidGlassPanel(
  { depth = 'clear', refract = false, radius, className = '', bodyClassName = '', style, children, ...rest }, ref,
) {
  const el = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => el.current as HTMLDivElement);
  useSpecular(el);
  const st: CSSProperties = radius == null ? { ...style } : { ...style, ['--lg-r' as string]: typeof radius === 'number' ? radius + 'px' : radius };
  return (
    <div ref={el} className={'lg ' + className} data-depth={depth} data-refract={refract ? 'true' : undefined} style={st} {...rest}>
      <div className={'lg-body ' + bodyClassName}>{children}</div>
    </div>
  );
});
