import { useEffect, useState } from 'react';
import { nextPass, orbitAt, type OrbitSample, type PassInfo } from '../data/orbit';

export interface OrbitClock { now: number; sample: OrbitSample; pass: PassInfo }

const read = (): OrbitClock => {
  const now = Date.now();
  return { now, sample: orbitAt(now), pass: nextPass(now) };
};

/** Demonstrative orbit telemetry, refreshed a few times a second. */
export function useOrbitClock(intervalMs = 500): OrbitClock {
  const [clock, setClock] = useState<OrbitClock>(read);
  useEffect(() => {
    const id = window.setInterval(() => setClock(read()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return clock;
}

export function utcClock(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()) + ':' + p(d.getUTCSeconds());
}
