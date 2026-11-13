/* A small Liquid Glass capsule carrying one live readout. */
import type { CSSProperties, ReactNode } from 'react';
import { LiquidGlassPanel } from '../glass/LiquidGlassPanel';

interface Props {
  label: string;
  value: ReactNode;
  unit?: string;
  dots?: ('lband' | 'sband' | 'kapton')[];
  className?: string;
  style?: CSSProperties;
  /** parallax depth: larger moves further with the pointer */
  depth?: number;
  float?: 'a' | 'b';
  delay?: number;
}

const DOT = { lband: 'bg-lband', sband: 'bg-sband', kapton: 'bg-kapton' } as const;

export function TelemetryLens({ label, value, unit, dots, className = '', style, depth = 1, float = 'a', delay = 0 }: Props) {
  return (
    <div className={className} style={{ ...style, transform: `translate3d(calc(var(--gx, 0) * ${-10 * depth}px), calc(var(--gy, 0) * ${-7 * depth}px), 0)` }}>
      <div style={{ animation: `float-${float} ${7 + depth * 1.5}s ease-in-out ${delay}s infinite` }}>
        <LiquidGlassPanel refract radius={24} bodyClassName="flex items-center gap-3 px-4 py-2.5">
          {dots && (
            <span className="flex flex-col gap-1">
              {dots.map((d) => <span key={d} className={'h-1.5 w-1.5 rounded-full ' + DOT[d]} />)}
            </span>
          )}
          <span className="flex flex-col leading-none">
            <span className="tele text-[8.5px] text-slate">{label}</span>
            <span className="etched mt-1.5 whitespace-nowrap font-mono text-[15px] font-medium text-lens">
              {value}{unit && <span className="ml-1 text-[10px] font-normal text-slate">{unit}</span>}
            </span>
          </span>
        </LiquidGlassPanel>
      </div>
    </div>
  );
}
