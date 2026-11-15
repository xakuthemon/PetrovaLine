/*
 * Export: pick a format, see the brief, then download, copy or print it.
 * Sandboxed hosts that block downloads and printing get Copy only.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { Copy, Download, Printer, X } from 'lucide-react';
import { Panel } from '../ui/Panel';
import { Segmented } from '../ui/Segmented';
import { MIME, SECTIONS, briefFilename, buildBrief, type BriefFormat, type BriefSection } from '../../engine/brief';
import type { Series } from '../../engine/scenes';
import { monthLabel } from '../../engine/util';
import { caseById, valuesAt } from '../../data/cases';
import { useMission } from '../../state/mission';

const ALL = Object.fromEntries(SECTIONS.map((s) => [s.id, true])) as Record<BriefSection, boolean>;
const EMBED = typeof __EMBED__ !== 'undefined' && __EMBED__;

/** focus stays inside the dialog; Escape closes it */
export function useDialog(open: boolean, close: () => void) {
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    card.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab' || !card.current) return;
      const f = Array.from(card.current.querySelectorAll<HTMLElement>('button, input, textarea, [href]')).filter((el) => !el.hasAttribute('disabled'));
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus?.(); };
  }, [open, close]);
  return card;
}

export function Backdrop({ onClose, children, width = 860 }: { onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      style={{ background: 'rgba(15,16,25,0.6)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ opacity: 0, y: 14, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8 }} transition={{ type: 'spring', stiffness: 320, damping: 30 }} className="w-full" style={{ maxWidth: width }}>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function ExportBriefModal({ series }: { series: Series | null }) {
  const open = useMission((s) => s.exportOpen), setOpen = useMission((s) => s.setExportOpen);
  const caseId = useMission((s) => s.caseId), a = useMission((s) => s.a), m = useMission((s) => s.m);
  const channel = useMission((s) => s.channel), band = useMission((s) => s.band);
  const [format, setFormat] = useState<BriefFormat>('md');
  const [status, setStatus] = useState('');
  const pre = useRef<HTMLTextAreaElement>(null);
  const def = caseById(caseId);
  const close = useMemo(() => () => setOpen(false), [setOpen]);
  const card = useDialog(open, close);

  const input = useMemo(() => (series ? { def, values: valuesAt(series, m), a, m, channel, band, sections: ALL, analyst: '' } : null), [series, def, a, m, channel, band]);
  const text = useMemo(() => (input ? buildBrief(input, format) : ''), [input, format]);
  const dossier = useMemo(() => (input ? buildBrief(input, 'txt') : ''), [input]);
  const filename = input ? briefFilename(input, format) : '';

  const flash = (s: string) => { setStatus(s); window.setTimeout(() => setStatus(''), 2400); };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([text], { type: MIME[format] + ';charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url; link.download = filename;
      document.body.appendChild(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      flash('Downloaded');
    } catch { flash('Download blocked here. Use Copy.'); }
  };
  const copy = () => {
    const fallback = () => { pre.current?.focus(); pre.current?.select(); flash('Selected. Press Ctrl+C to copy.'); };
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => flash('Copied'), fallback);
      else fallback();
    } catch { fallback(); }
  };
  const host = typeof document !== 'undefined' ? document.getElementById('dossier') : null;

  return (
    <>
      {host && createPortal(
        <>
          <h1>Petrova Line · Mission brief</h1>
          <div className="sub">{def.place} · {monthLabel(a)} to {monthLabel(Math.floor(m + 1e-6))} · simulated scenario</div>
          <pre>{dossier}</pre>
        </>, host)}

      <AnimatePresence>
        {open && (
          <Backdrop key="export" onClose={close}>
            <Panel ref={card} depth="deep" radius={24} role="dialog" aria-modal="true" aria-labelledby="export-title" tabIndex={-1} className="outline-none" bodyClassName="flex flex-col gap-4 p-4 sm:p-6">
              <div className="flex items-center gap-3">
                <h2 id="export-title" className="text-[20px] font-semibold tracking-[-0.01em]">Export brief</h2>
                <span className="truncate text-[13px] text-fog">{def.name}</span>
                <button type="button" onClick={close} aria-label="Close" className="icon-btn ml-auto flex-none"><X size={18} strokeWidth={1.7} /></button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Segmented id="format-pill" label="Format" value={format} onChange={setFormat}
                  options={[{ id: 'md', label: 'Markdown' }, { id: 'json', label: 'JSON' }, { id: 'txt', label: 'Text' }]} />
                <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                  {!EMBED && <button type="button" className="btn btn-cream" onClick={download}><Download size={16} strokeWidth={1.8} /> Download</button>}
                  <button type="button" className={'btn ' + (EMBED ? 'btn-cream' : 'btn-ghost')} onClick={copy}><Copy size={15} strokeWidth={1.8} /> Copy</button>
                  {!EMBED && <button type="button" className="btn btn-ghost" onClick={() => window.print()}><Printer size={15} strokeWidth={1.8} /> Print</button>}
                </div>
              </div>
              <textarea ref={pre} readOnly value={text} aria-label="Brief preview" spellCheck={false}
                className="scroll-thin h-[min(52vh,440px)] w-full resize-none rounded-2xl bg-night/70 p-4 font-mono text-[11.5px] leading-relaxed text-cream/90 outline-none focus:shadow-[inset_0_0_0_1px_rgba(244,236,227,0.3)]" />
              <p role="status" className="min-h-[18px] text-[12.5px] text-cream/80">{status || <span className="text-fog">{filename}</span>}</p>
            </Panel>
          </Backdrop>
        )}
      </AnimatePresence>
    </>
  );
}
