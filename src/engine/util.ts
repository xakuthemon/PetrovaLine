/* TerraWaltz — shared math, seeded noise and formatters. */

export const clamp = (x: number, a: number, b: number): number => (x < a ? a : x > b ? b : x);
export const sat = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smooth = (a: number, b: number, x: number): number => {
  let t = (x - a) / (b - a);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return t * t * (3 - 2 * t);
};

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer lattice hash -> [0, 1). */
export function hash2(x: number, y: number, s: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface FbmOptions {
  oct?: number;
  gain?: number;
  ridged?: boolean;
  tile?: boolean;
  aspect?: number;
}

/**
 * Fractal value-noise field, stretched to the full 0..1 range.
 * @param fx base frequency in cycles across the width
 */
export function fbmField(W: number, H: number, seed: number, fx: number, o: FbmOptions = {}): Float32Array {
  const oct = o.oct || 4;
  const gain = o.gain || 0.5;
  const tile = !!o.tile;
  const out = new Float32Array(W * H);
  const r = rng(seed);
  let fy = fx * (o.aspect || H / W);
  if (tile) {
    fx = Math.max(1, Math.round(fx));
    fy = Math.max(1, Math.round(fy));
  }
  let amp = 1;
  const xi0 = new Int32Array(W), xi1 = new Int32Array(W), xt = new Float32Array(W);
  for (let k = 0; k < oct; k++) {
    const gx = tile ? fx : Math.ceil(fx) + 2;
    const gy = tile ? fy : Math.ceil(fy) + 2;
    const lat = new Float32Array(gx * gy);
    for (let i = 0; i < lat.length; i++) lat[i] = r();
    for (let x = 0; x < W; x++) {
      const p = (x / W) * fx;
      const i = Math.floor(p);
      const t = p - i;
      xi0[x] = tile ? i % gx : i;
      xi1[x] = tile ? (i + 1) % gx : i + 1;
      xt[x] = t * t * (3 - 2 * t);
    }
    for (let y = 0; y < H; y++) {
      const p = (y / H) * fy;
      const j = Math.floor(p);
      let t = p - j;
      t = t * t * (3 - 2 * t);
      const r0 = (tile ? j % gy : j) * gx;
      const r1 = (tile ? (j + 1) % gy : j + 1) * gx;
      const row = y * W;
      for (let x = 0; x < W; x++) {
        const s = xt[x];
        const a = lat[r0 + xi0[x]] + (lat[r0 + xi1[x]] - lat[r0 + xi0[x]]) * s;
        const b = lat[r1 + xi0[x]] + (lat[r1 + xi1[x]] - lat[r1 + xi0[x]]) * s;
        let v = a + (b - a) * t;
        if (o.ridged) v = 1 - Math.abs(2 * v - 1);
        out[row + x] += v * amp;
      }
    }
    amp *= gain;
    fx *= 2;
    fy *= 2;
  }
  let mn = Infinity, mx = -Infinity;
  for (let i = 0; i < out.length; i++) {
    const v = out[i];
    if (v < mn) mn = v;
    if (v > mx) mx = v;
  }
  const inv = 1 / (mx - mn || 1);
  for (let i = 0; i < out.length; i++) out[i] = (out[i] - mn) * inv;
  return out;
}

/** Distance from point p to segment a-b (all in the same units). */
export function segDist(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay;
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1);
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + dx * t - px, qy = ay + dy * t - py;
  return Math.sqrt(qx * qx + qy * qy);
}

export const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Timeline origin: January 2020. */
export const T0 = 2020;
/** Last month index on the timeline: September 2026. */
export const M_MAX = 80;

export const monthToYear = (m: number): number => T0 + m / 12;
export function monthLabel(m: number): string {
  const k = Math.round(m);
  return MONTHS[((k % 12) + 12) % 12] + ' ' + (T0 + Math.floor(k / 12));
}

export function fmt(v: number | null | undefined, digits = 1): string {
  if (v == null || !isFinite(v)) return '–';
  const s = Math.abs(v).toFixed(digits);
  return (v < 0 && Number(s) !== 0 ? '−' : '') + s;
}
export function fmtSigned(v: number | null | undefined, digits = 1): string {
  if (v == null || !isFinite(v)) return '–';
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return s;
  return (v < 0 ? '−' : '+') + s;
}

export const reducedMotion = (): boolean =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
