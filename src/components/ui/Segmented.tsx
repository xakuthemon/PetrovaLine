/* Segmented control: the active option sits on a cream pill that slides between options. */
import { motion } from 'motion/react';
import type { ReactNode } from 'react';

export const SPRING = { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 } as const;

export function Pill({ id, tone = 'cream' }: { id: string; tone?: 'cream' | 'crimson' }) {
  return <motion.span layoutId={id} transition={SPRING} aria-hidden="true" className={'absolute inset-0 rounded-full ' + (tone === 'cream' ? 'bg-cream' : 'bg-crimson')} />;
}

interface Option<T extends string> { id: T; label: ReactNode; title?: string }

export function Segmented<T extends string>({ id, label, options, value, onChange, disabled, size = 'md', className = '' }: {
  id: string; label: string; options: Option<T>[]; value: T | null; onChange: (v: T) => void; disabled?: boolean; size?: 'sm' | 'md'; className?: string;
}) {
  const h = size === 'sm' ? 'h-8 px-2.5 text-[12.5px]' : 'h-9 px-3 text-[13px]';
  return (
    <div role="group" aria-label={label} className={'relative flex flex-none items-center rounded-full bg-night/70 p-[3px] ' + className}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <button key={o.id} type="button" aria-pressed={on} title={o.title} disabled={disabled} onClick={() => onChange(o.id)}
            className={'relative flex items-center justify-center rounded-full font-medium transition-colors duration-200 disabled:opacity-40 ' + h + (on ? ' text-ink' : ' text-cream/70 hover:text-cream')}>
            {on && <Pill id={id} />}
            <span className="relative z-[1] whitespace-nowrap">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
