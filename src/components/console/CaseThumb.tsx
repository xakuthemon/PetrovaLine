/*
 * Mini SAR thumbnail of a mission case. Scenes are generated one at a time in
 * idle moments so the first paint is never blocked by all four.
 */
import { useEffect, useRef, useState } from 'react';
import { renderThumb } from '../../engine/mapEngine';
import type { SceneId } from '../../engine/scenes';

const queue: (() => void)[] = [];
let busy = false;
function pump(): void {
  if (busy) return;
  const job = queue.shift();
  if (!job) return;
  busy = true;
  window.setTimeout(() => { try { job(); } finally { busy = false; pump(); } }, 140);
}

const done = new Map<string, string>();   // rendered thumbnails as data URLs, kept across remounts

export function CaseThumb({ id, t, className = '' }: { id: SceneId; t: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = id + '@' + t;
  const [ready, setReady] = useState(done.has(key));

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const paint = (url: string) => {
      const img = new Image();
      img.onload = () => { canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height); setReady(true); };
      img.src = url;
    };
    const cachedUrl = done.get(key);
    if (cachedUrl) { paint(cachedUrl); return; }
    let live = true;
    const job = () => {
      if (!live) return;
      renderThumb(id, t, canvas);
      try { done.set(key, canvas.toDataURL('image/png')); } catch { /* canvas export unavailable */ }
      setReady(true);
    };
    queue.push(job);
    pump();
    return () => { live = false; const i = queue.indexOf(job); if (i >= 0) queue.splice(i, 1); };
  }, [id, t, key]);

  return (
    <span className={'relative block overflow-hidden bg-umbra ' + className}>
      <canvas ref={ref} width={160} height={104} className={'h-full w-full transition-opacity duration-500 ' + (ready ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
      <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(242,238,230,0.28)]" />
    </span>
  );
}
