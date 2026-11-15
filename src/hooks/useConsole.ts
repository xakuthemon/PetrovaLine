/*
 * Console-level behaviour: scene loading, timeline playback, channel sweep, keyboard.
 */
import { useEffect, useState } from 'react';
import { buildSeries, getScene, isSceneReady, type SceneId, type Series } from '../engine/scenes';
import { M_MAX } from '../engine/util';
import { CASES } from '../data/cases';
import { useMission } from '../state/mission';
import type { Channel } from '../engine/mapEngine';

const seriesCache = new Map<SceneId, Series>();

/** Monthly metric series of a case. Null while the scene is being generated for the first time. */
export function useCaseSeries(id: SceneId): Series | null {
  const [, bump] = useState(0);
  useEffect(() => {
    if (seriesCache.has(id)) return;
    let live = true;
    const run = () => {
      seriesCache.set(id, buildSeries(getScene(id)));
      if (live) bump((n) => n + 1);
    };
    // let the "locking on" state paint before the heavy first-time generation
    const t = window.setTimeout(run, isSceneReady(id) ? 0 : 60);
    return () => { live = false; window.clearTimeout(t); };
  }, [id]);
  return seriesCache.get(id) ?? null;
}

/** Advance date B while playing. Seven months per second at 1×. */
export function usePlayback(): void {
  const playing = useMission((s) => s.playing);
  useEffect(() => {
    if (!playing) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => {
      const st = useMission.getState();
      const dt = Math.min(0.12, Math.max(0, (now - last) / 1000));
      last = now;
      const m = st.m + dt * 7 * st.speed;
      if (m >= M_MAX) { st.setM(M_MAX); st.setPlaying(false); return; }
      st.setM(m);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);
}

export const SWEEP_ORDER: Channel[] = ['HH', 'HV', 'VV', 'INSAR', 'RGB'];
export const SWEEP_MS = 1900;

/** Sweep: step through every channel like an instrument calibration. */
export function useSweep(): void {
  const sweep = useMission((s) => s.sweep);
  useEffect(() => {
    if (!sweep) return;
    const id = window.setInterval(() => {
      const st = useMission.getState();
      const i = SWEEP_ORDER.indexOf(st.channel);
      useMission.setState({ channel: SWEEP_ORDER[(i + 1) % SWEEP_ORDER.length], sensor: 'sar' });
    }, SWEEP_MS);
    return () => window.clearInterval(id);
  }, [sweep]);
}

/** Space: play · arrows: step one month · 1–4: switch case. */
export function useConsoleKeys(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useMission.getState();
      if (st.exportOpen || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null, tag = t?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.getAttribute?.('role') === 'slider') return;
      if (e.key === ' ' && tag !== 'BUTTON') { st.setPlaying(!st.playing); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        st.setPlaying(false);
        st.setM(Math.round(st.m) + (e.key === 'ArrowRight' ? 1 : -1));
        e.preventDefault();
      } else if (/^[1-4]$/.test(e.key)) st.setCase(CASES[Number(e.key) - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
