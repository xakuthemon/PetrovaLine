/*
 * TerraWaltz — demonstrative orbit telemetry.
 * A simple circular sun-synchronous ground track with NISAR's published orbit
 * parameters (747 km, 98.4°). It is NOT live mission telemetry: positions are
 * illustrative and will not match the real spacecraft.
 */
import type { SceneId } from '../engine/scenes';

const R_EARTH = 6371;                 // km
const ALT = 747;                      // km
const INC = (98.4 * Math.PI) / 180;
const PERIOD = 5970;                  // s (about 99.5 minutes)
const W_EARTH = (2 * Math.PI) / 86164; // rad / s
const EPOCH = Date.UTC(2025, 6, 30, 12, 10, 0);
const DEG = 180 / Math.PI;

export interface OrbitSample {
  lat: number;
  lon: number;
  altKm: number;
  /** ground-track speed, km/s */
  velKms: number;
  orbit: number;
  /** incidence angle at swath centre, degrees */
  incidence: number;
  /** argument of latitude 0..1 around the orbit */
  phase: number;
}

export const TARGETS: Record<SceneId, { lat: number; lon: number; name: string }> = {
  caspian: { lat: 43.6, lon: 51.2, name: 'Caspian Sea' },
  pantanal: { lat: -17.7, lon: -57.4, name: 'Pantanal' },
  fault: { lat: 37.4, lon: 37.0, name: 'Kahramanmaraş' },
  glacier: { lat: 69.2, lon: -49.8, name: 'Jakobshavn' },
};

function track(tSec: number): { lat: number; lon: number; u: number } {
  const u = (2 * Math.PI * tSec) / PERIOD;
  const lat = Math.asin(Math.sin(INC) * Math.sin(u));
  let lon = Math.atan2(Math.cos(INC) * Math.sin(u), Math.cos(u)) - W_EARTH * tSec + 0.9;
  lon = ((((lon + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  return { lat: lat * DEG, lon: lon * DEG, u };
}

export function orbitAt(ms: number): OrbitSample {
  const t = (ms - EPOCH) / 1000;
  const { lat, lon, u } = track(t);
  return {
    lat, lon,
    altKm: ALT + 1.6 * Math.sin(2 * u + 0.6) + 0.5 * Math.sin(u),
    velKms: 6.914 + 0.012 * Math.sin(2 * u),
    orbit: Math.floor(t / PERIOD) + 1,
    incidence: 40 + 6.5 * Math.sin(t / 47),
    phase: (((u / (2 * Math.PI)) % 1) + 1) % 1,
  };
}

function distKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const a1 = lat1 / DEG, a2 = lat2 / DEG, dl = (lon2 - lon1) / DEG;
  const h = Math.sin((a2 - a1) / 2) ** 2 + Math.cos(a1) * Math.cos(a2) * Math.sin(dl / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

export interface PassInfo {
  caseId: SceneId;
  /** seconds until the target enters the simulated swath; 0 when in view */
  etaSec: number;
  inView: boolean;
}

let cached: { at: number; until: number; pass: PassInfo } | null = null;
const REACH = 700; // km: demonstrative acquisition reach either side of the ground track

/** The next simulated acquisition over one of the four case targets. */
export function nextPass(ms: number): PassInfo {
  if (cached && ms >= cached.at && ms < cached.until) {
    const eta = Math.max(0, Math.round((cached.until - ms) / 1000));
    return { ...cached.pass, etaSec: cached.pass.inView ? 0 : eta };
  }
  const t0 = (ms - EPOCH) / 1000;
  const ids = Object.keys(TARGETS) as SceneId[];
  for (let dt = 0; dt < 4 * 86400; dt += 12) {
    const p = track(t0 + dt);
    for (const id of ids) {
      const g = TARGETS[id];
      if (Math.abs(p.lat - g.lat) < 8 && distKm(p.lat, p.lon, g.lat, g.lon) < REACH) {
        const inView = dt === 0;
        cached = { at: ms, until: ms + (inView ? 20_000 : dt * 1000), pass: { caseId: id, etaSec: dt, inView } };
        return cached.pass;
      }
    }
  }
  cached = { at: ms, until: ms + 600_000, pass: { caseId: 'caspian', etaSec: 0, inView: false } };
  return cached.pass;
}

export function fmtLat(v: number): string { return Math.abs(v).toFixed(2).padStart(5, '0') + '°' + (v < 0 ? 'S' : 'N'); }
export function fmtLon(v: number): string { return Math.abs(v).toFixed(2).padStart(6, '0') + '°' + (v < 0 ? 'W' : 'E'); }
export function fmtEta(sec: number): string {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return (h ? String(h).padStart(2, '0') + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
