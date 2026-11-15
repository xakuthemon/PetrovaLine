/* Flat ink surface used by every floating control. */
import { forwardRef, type CSSProperties, type HTMLAttributes, type ReactNode } from 'react';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  depth?: 'clear' | 'mid' | 'deep';
  radius?: number | string;
  bodyClassName?: string;
  children?: ReactNode;
}

export const Panel = forwardRef<HTMLDivElement, PanelProps>(function Panel(
  { depth = 'mid', radius, className = '', bodyClassName = '', style, children, ...rest }, ref,
) {
  const st: CSSProperties = radius == null ? { ...style } : { ...style, ['--lg-r' as string]: typeof radius === 'number' ? radius + 'px' : radius };
  return (
    <div ref={ref} className={'lg ' + className} data-depth={depth} style={st} {...rest}>
      <div className={'lg-body ' + bodyClassName}>{children}</div>
    </div>
  );
});
