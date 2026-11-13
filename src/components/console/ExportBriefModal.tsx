/*
 * Export Mission Brief: choose format and sections, preview, then download, copy
 * or print a dossier. Sandboxed hosts that block downloads get copy only.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, Download, Printer, X } from 'lucide-react';
import { LiquidGlassPanel } from '../glass/LiquidGlassPanel';
import { LensPill, SOFT_SPRING } from '../glass/LensPill';
import { MagneticButton } from '../glass/MagneticButton';
import { MIME, SECTIONS, briefFilename, buildBrief, type BriefFormat, type BriefSection } from '../../engine/brief';
import type { Series } from '../../engine/scenes';
import { monthLabel } from '../../engine/util';
import { caseById, valuesAt } from '../../data/cases';
import { useMission } from '../../state/mission';

const FORMATS: { id: BriefFormat; label: string }[] = [{ id: 'md', label: 'Markdown' }, { id: 'json', label: 'JSON' }, { id: 'txt', label: 'Plain text' }];
const ALL = Object.fromEntries(SECTIONS.map((s) => [s.id, true])) as Record<BriefSection, boolean>;
const EMBED = typeof __EMBED__ !== 'undefined' && __EMBED__;

export function ExportBriefModal({ series }: { series: Series | null }) {
  const open = useMission((s) => s.exportOpen), setOpen = useMission((s) => s.setExportOpen);
  const caseId = useMission((s) => s.caseId), a = useMission((s) => s.a), m = useMission((s) => s.m);
  const channel = useMission((s) => s.channel), band = useMission((s) => s.band);
  const [format, setFormat] = useState<BriefFormat>('md');
  const [sections, setSections] = useState(ALL);
  const [analyst, setAnalyst] = useState('');
  const [status, setStatus] = useState('');
  const card = useRef<HTMLDivElement>(null);
  const pre = useRef<HTMLTextAreaElement>(null);
  const def = caseById(caseId);

  const input = useMemo(() => (series ? { def, values: valuesAt(series, m), a, m, channel, band, sections, analyst } : null), [series, def, a, m, channel, band, sections, analyst]);
  const text = useMemo(() => (input ? buildBrief(input, format) : ''), [input, format]);
  const dossier = useMemo(() => (input ? buildBrief(input, 'txt') : ''), [input]);
  const filename = input ? briefFilename(input, format) : '';

  useEffect(() => {
    if (!open) return;
    setStatus('');
    const prev = document.activeElement as HTMLElement | null;
    card.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (e.key !== 'Tab' || !card.current) return;
      const f = Array.from(card.current.querySelectorAll<HTMLElement>('button, input, textarea, [href]')).filter((el) => !el.hasAttribute('disabled'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, setOpen]);

  const flash = (s: string) => { setStatus(s); window.setTimeout(() => setStatus(''), 2400); };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: MIME[format] + ';charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      flash('Downloaded ' + filename);
    } catch { flash('Download blocked here. Use Copy.'); }
  };
  const copy = () => {
    const fallback = () => { pre.current?.focus(); pre.current?.select(); flash('Select all, then copy'); };
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => flash('Copied to clipboard'), fallback);
      else fallback();
    } catch { fallback(); }
  };

  const host = typeof document !== 'undefined' ? document.getElementById('dossier') : null;

  return (
    <>
      {host && createPortal(
        <>
          <h1>TerraWaltz · Mission dossier</h1>
          <div className="sub">{def.place} · {monthLabel(a)} to {monthLabel(Math.floor(m + 1e-6))} · simulated demonstration data</div>
          <pre>{dossier}</pre>
        </>, host)}

      <AnimatePresence>
        {open && (
          <motion.div key="export" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            style={{ background: 'rgba(4,6,10,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
            onPointerDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 18 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }} transition={SOFT_SPRING} className="w-full max-w-[940px]">
              <LiquidGlassPanel ref={card} depth="deep" radius={30} role="dialog" aria-modal="true" aria-labelledby="export-title" tabIndex={-1} className="outline-none"
                bodyClassName="grid gap-5 p-5 sm:p-7 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
                <div className="flex min-w-0 flex-col gap-5">
                  <div className="flex items-start gap-3">
                    <div>
                      <p className="tele text-[9px] text-kapton">Case {def.index} · {def.brief.levelLabel}</p>
                      <h2 id="export-title" className="mt-2 text-[26px] font-semibold leading-[1.05] tracking-tight text-lens">Export mission brief</h2>
                      <p className="mt-2 text-[13px] leading-snug text-lens/70">{def.name}, {monthLabel(a)} to {monthLabel(Math.floor(m + 1e-6))}. {channel === 'INSAR' ? 'InSAR' : channel} at {band}-band.</p>
                    </div>
                    <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="ml-auto grid h-9 w-9 flex-none place-items-center rounded-full text-slate transition-colors hover:bg-lens/10 hover:text-lens"><X size={17} strokeWidth={1.7} /></button>
                  </div>

                  <div>
                    <div className="tele mb-2 text-[8.5px] text-slate">Format</div>
                    <div role="radiogroup" aria-label="Format" className="relative inline-flex rounded-full bg-black/30 p-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.6)]">
                      {FORMATS.map((f) => (
                        <button key={f.id} type="button" role="radio" aria-checked={format === f.id} onClick={() => setFormat(f.id)}
                          className={'relative h-9 rounded-full px-4 text-[12.5px] font-medium transition-colors ' + (format === f.id ? 'text-lens' : 'text-slate hover:text-lens')}>
                          {format === f.id && <LensPill id="format-lens" tint="kapton" />}
                          <span className="relative z-[1]">{f.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="tele mb-2 text-[8.5px] text-slate">Sections</div>
                    <div className="grid grid-cols-1 gap-1.5 xs:grid-cols-2">
                      {SECTIONS.map((s) => {
                        const on = sections[s.id];
                        return (
                          <button key={s.id} type="button" role="checkbox" aria-checked={on} onClick={() => setSections((p) => ({ ...p, [s.id]: !p[s.id] }))}
                            className={'flex items-center gap-2.5 rounded-2xl px-3 py-2 text-left text-[12.5px] transition-colors ' + (on ? 'bg-lens/10 text-lens shadow-[inset_0_0_0_1px_rgba(244,251,255,0.28)]' : 'bg-black/25 text-slate shadow-[inset_0_0_0_1px_rgba(244,251,255,0.08)] hover:text-lens')}>
                            <span className={'grid h-4 w-4 flex-none place-items-center rounded-full ' + (on ? 'bg-lband text-void' : 'bg-lens/10')}>{on && <Check size={11} strokeWidth={3} />}</span>
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="brief-analyst" className="tele mb-2 block text-[8.5px] text-slate">Prepared by (optional)</label>
                    <input id="brief-analyst" value={analyst} onChange={(e) => setAnalyst(e.target.value)} placeholder="Name or team" maxLength={80}
                      className="h-10 w-full rounded-full bg-black/30 px-4 text-[13px] text-lens placeholder:text-slate/70 shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(244,251,255,0.1)] outline-none focus:shadow-[inset_0_1px_2px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(0,240,255,0.7)]" />
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2.5">
                    {!EMBED && <MagneticButton primary tint="kapton" onClick={download}><Download size={16} strokeWidth={1.7} /> Download</MagneticButton>}
                    <MagneticButton primary={EMBED} tint="lband" onClick={copy}><Copy size={15} strokeWidth={1.7} /> Copy</MagneticButton>
                    {!EMBED && <MagneticButton onClick={() => window.print()}><Printer size={15} strokeWidth={1.7} /> Print dossier</MagneticButton>}
                  </div>
                  <p role="status" className="min-h-[16px] font-mono text-[10.5px] text-lband">{status}</p>
                </div>

                <div className="flex min-w-0 flex-col">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="tele text-[8.5px] text-slate">Preview</span>
                    <span className="truncate font-mono text-[10px] text-slate">{filename}</span>
                  </div>
                  <textarea ref={pre} readOnly value={text} aria-label="Brief preview" spellCheck={false}
                    className="scroll-thin h-[300px] w-full flex-1 resize-none rounded-[20px] bg-black/40 p-4 font-mono text-[11px] leading-relaxed text-lens/90 shadow-[inset_0_1px_3px_rgba(0,0,0,0.7),inset_0_0_0_1px_rgba(244,251,255,0.08)] outline-none md:h-auto md:min-h-[420px]" />
                  <p className="mt-2 text-[11px] leading-snug text-kapton/90">Figures come from a simulated demonstration scenario, not from NISAR measurements.</p>
                </div>
              </LiquidGlassPanel>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
