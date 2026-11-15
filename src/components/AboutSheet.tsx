/*
 * About: what this is, where the data comes from, and how AI was used.
 * Opened from the info button; the only longer text in the app.
 */
import { useMemo } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowUpRight, X } from 'lucide-react';
import { Panel } from './ui/Panel';
import { Backdrop, useDialog } from './console/ExportBriefModal';
import { Mark, Wordmark } from '../brand/Logo';
import { useMission } from '../state/mission';

export const SOURCES: { label: string; what: string; href: string }[] = [
  { label: 'NISAR mission facts', what: 'NASA / JPL', href: 'https://nisar.jpl.nasa.gov/nisarmission' },
  { label: 'What to expect from NISAR data', what: 'NASA Earthdata', href: 'https://www.earthdata.nasa.gov/news/now-nisar-launched-heres-what-you-can-expect-from-data' },
  { label: 'Blue Marble (globe)', what: 'NASA Visible Earth', href: 'https://visibleearth.nasa.gov/collection/1484/blue-marble' },
  { label: 'Black Marble (night lights)', what: 'NASA Earth Observatory', href: 'https://earthobservatory.nasa.gov/features/NightLights' },
];

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline decoration-cream/30 underline-offset-4 hover:decoration-cream">{children}<ArrowUpRight size={13} strokeWidth={1.8} /></a>;
}

export function AboutSheet() {
  const open = useMission((s) => s.aboutOpen), setOpen = useMission((s) => s.setAboutOpen);
  const close = useMemo(() => () => setOpen(false), [setOpen]);
  const card = useDialog(open, close);
  return (
    <AnimatePresence>
      {open && (
        <Backdrop key="about" onClose={close} width={560}>
          <Panel ref={card} depth="deep" radius={24} role="dialog" aria-modal="true" aria-labelledby="about-title" tabIndex={-1} className="outline-none" bodyClassName="p-5 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <Mark className="w-[132px]" />
                <h2 id="about-title" className="mt-4 text-[13px]"><Wordmark /></h2>
              </div>
              <button type="button" onClick={close} aria-label="Close" className="icon-btn"><X size={18} strokeWidth={1.7} /></button>
            </div>
            <p className="mt-4 text-[17px] leading-snug">How NASA–ISRO's NISAR radar reads water, forests, faults and ice.</p>

            <dl className="mt-6 space-y-4 text-[13.5px] leading-snug">
              <div>
                <dt className="label mb-1.5">Data</dt>
                <dd><ul className="space-y-1.5">{SOURCES.map((s) => <li key={s.href}><Link href={s.href}>{s.label}</Link> <span className="text-fog">· {s.what}</span></li>)}</ul></dd>
              </div>
              <div>
                <dt className="label mb-1">Scenes</dt>
                <dd className="text-cream/85">The radar scenes and figures are simulated in your browser from a physical model set to NISAR's two bands. They are not mission data.</dd>
              </div>
              <div>
                <dt className="label mb-1">AI</dt>
                <dd className="text-cream/85">The code was written with AI assistance (Claude Code, Anthropic).</dd>
              </div>
              <div>
                <dt className="label mb-1">Keys</dt>
                <dd className="num text-cream/85">Space play · ← → month · 1–4 scene</dd>
              </div>
            </dl>
            <p className="mt-6 text-[12.5px] text-fog">NASA Space Apps Challenge 2026</p>
          </Panel>
        </Backdrop>
      )}
    </AnimatePresence>
  );
}
