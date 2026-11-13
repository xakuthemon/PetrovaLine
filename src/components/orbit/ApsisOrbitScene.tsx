/*
 * React wrapper around the Three.js Apsis scene: lifecycle, pointer parallax and the camera dive.
 */
import { useEffect, useRef, useState } from 'react';
import { createApsisScene, type ApsisHandle } from '../../three/apsisScene';

interface Props {
  /** render loop runs only while the Orbit mode is on screen */
  active: boolean;
  /** start the dive down the swath */
  diving: boolean;
  onDiveProgress(k: number): void;
  onDiveEnd(): void;
}

export function ApsisOrbitScene({ active, diving, onDiveProgress, onDiveEnd }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handle = useRef<ApsisHandle | null>(null);
  const [failed, setFailed] = useState(false);
  const cb = useRef({ onDiveProgress, onDiveEnd });
  cb.current = { onDiveProgress, onDiveEnd };

  useEffect(() => {
    const canvas = canvasRef.current!;
    const h = createApsisScene(canvas);
    if (!h) { setFailed(true); return; }
    handle.current = h;
    h.resize();
    const ro = new ResizeObserver(() => h.resize());
    ro.observe(canvas);
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      h.setPointer((e.clientX / window.innerWidth) * 2 - 1, -((e.clientY / window.innerHeight) * 2 - 1));
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      ro.disconnect();
      h.dispose();
      handle.current = null;
    };
  }, []);

  useEffect(() => {
    const h = handle.current;
    if (!h) return;
    if (active) { h.resetDive(); cb.current.onDiveProgress(0); h.resize(); h.start(); }
    else h.stop();
  }, [active]);

  useEffect(() => {
    if (!diving) return;
    const h = handle.current;
    if (!h) { cb.current.onDiveEnd(); return; }
    let live = true;
    h.dive((k) => { if (live) cb.current.onDiveProgress(k); }).then(() => { if (live) cb.current.onDiveEnd(); });
    return () => { live = false; };
  }, [diving]);

  return (
    <>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="The NISAR spacecraft in orbit above Earth, with L-band and S-band radar waves travelling to the surface" role="img" />
      {failed && (
        <div className="absolute inset-0 grid place-items-center">
          <p className="tele max-w-xs text-center text-[10px] leading-relaxed text-slate">3D view unavailable in this browser. The console and the signal story work without it.</p>
        </div>
      )}
    </>
  );
}
