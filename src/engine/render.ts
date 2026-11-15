/*
 * Petrova Line — pixel renderers.
 * Turns a scene state into SAR amplitude (HH / HV / VV / RGB composite),
 * a wrapped InSAR interferogram, or an optical view with clouds, smoke and night.
 */
import { rng, fbmField, clamp } from './util';
import { BANDS, NOISE_FLOOR, fresnel, sigma as physSigma, type BandId } from './physics';
import { W, H, N, type Scene, type SceneState } from './scenes';

export type Pol = 'HH' | 'HV' | 'VV' | 'RGB';
export type Mechanism = 'surface' | 'volume' | 'double';
export interface SkyParams {
  cover: number; smoke: number; light: number; thr: number;
  ox1: number; oy1: number; ox2: number; oy2: number;
}

/* ---- static noise shared by every scene --------------------------------- */
// Multi-look speckle (5 looks), stored in dB so it adds to the expected sigma-zero.
const SPK = new Float32Array(N);
const PHN = new Float32Array(N);       // phase-noise field in [-1, 1]
(function () {
  const r = rng(20250730);
  for (let i = 0; i < N; i++) {
    let s = 0;
    for (let k = 0; k < 5; k++) s -= Math.log(r() + 1e-6);
    s /= 5;
    SPK[i] = 10 * Math.log10(s);
    PHN[i] = r() * 2 - 1;
  }
})();
let CL1: Float32Array, CL2: Float32Array, ATM1: Float32Array, ATM2: Float32Array;
let skyReady = false;
function ensureSky() {
  if (skyReady) return;
  skyReady = true;
  CL1 = fbmField(W, H, 901, 4, { oct: 5, tile: true });
  CL2 = fbmField(W, H, 902, 7, { oct: 4, tile: true });
  ATM1 = fbmField(W, H, 903, 2, { oct: 3 });
  ATM2 = fbmField(W, H, 904, 3, { oct: 3 });
}

// Cyclic colour map for wrapped phase in the brand colours:
// cream → crimson → ink → steel → cream, smooth all the way round so a fringe has no seam.
export const RAINBOW = new Uint8Array(256 * 3);
(function () {
  const stops: [number, number, number][] = [[244, 236, 227], [211, 36, 63], [36, 30, 52], [126, 155, 208], [244, 236, 227]];
  for (let k = 0; k < 256; k++) {
    const f = (k / 256) * 4, i = Math.floor(f), t = f - i, u = t * t * (3 - 2 * t);
    const a = stops[i], c = stops[i + 1];
    RAINBOW[k * 3] = a[0] + (c[0] - a[0]) * u; RAINBOW[k * 3 + 1] = a[1] + (c[1] - a[1]) * u; RAINBOW[k * 3 + 2] = a[2] + (c[2] - a[2]) * u;
  }
})();

export const POL: Record<'HH' | 'HV' | 'VV', { idx: number; lo: number; hi: number; tint: [number, number, number] }> = {
  HH: { idx: 0, lo: -27, hi: -1, tint: [0.93, 0.97, 1.0] },
  HV: { idx: 1, lo: -33, hi: -8, tint: [0.86, 1.0, 0.9] },
  VV: { idx: 2, lo: -27, hi: -1, tint: [0.84, 0.95, 1.0] },
};
const P3 = new Float32Array(3);

/* ---- table-driven copy of physics.sigma for the per-pixel loops ---------- *
 * Same formula as physics.sigma; the transcendental terms are tabulated.  */
const LN = 1024, EK = LN / 79, VK = LN / 1.6, NF = NOISE_FLOOR;
const LG = new Float32Array(LN + 1), LP = new Float32Array(LN + 1);
for (let k = 0; k <= LN; k++) {
  LG[k] = fresnel(1 + k / EK);
  LP[k] = Math.pow(k / LN, 1.6);
}
function vegTables(isS: boolean) {
  const kv = isS ? 3.0 : 1.15, ks = isS ? 4.5 : 2.2;
  const att = new Float32Array(LN + 1), vs = new Float32Array(LN + 1), atd = new Float32Array(LN + 1);
  for (let k = 0; k <= LN; k++) {
    const v = k / VK;
    att[k] = Math.exp(-kv * v); vs[k] = 1 - Math.exp(-ks * v); atd[k] = Math.exp(-kv * 0.8 * v);
  }
  return { att, vs, atd };
}
const VT = { L: vegTables(false), S: vegTables(true) };
let fR: Float32Array, fE: Float32Array, fV: Float32Array, fD: Float32Array, fAtt: Float32Array, fVs: Float32Array, fAtd: Float32Array;
let fS = false, cHH = 0.16, cHV = 0.05, cVV = 0.13;
function prep(S: SceneState, isS: boolean): void {
  const t = isS ? VT.S : VT.L;
  fR = S.R; fE = S.E; fV = S.V; fD = S.D; fAtt = t.att; fVs = t.vs; fAtd = t.atd; fS = isS;
  cHH = isS ? 0.13 : 0.16; cHV = isS ? 0.036 : 0.05; cVV = isS ? 0.12 : 0.13;
}
function sigma(i: number): void {
  let rm = fS ? fR[i] * 1.55 + 0.04 : fR[i];
  rm = rm < 0 ? 0 : rm > 1 ? 1 : rm;
  let ei = ((fE[i] - 1) * EK) | 0;
  ei = ei < 0 ? 0 : ei > LN ? LN : ei;
  let vi = (fV[i] * VK) | 0;
  vi = vi < 0 ? 0 : vi > LN ? LN : vi;
  const G = LG[ei];
  const surf = 0.606 * G * LP[(rm * LN) | 0] * fAtt[vi];
  const one = 1 - rm;
  const db = 0.85 * fD[i] * G * one * one * fAtd[vi];
  const vs = fVs[vi];
  P3[0] = 0.8 * surf + cHH * vs + db + NF;
  P3[1] = surf * 0.04 * (0.3 + rm) + cHV * vs + 0.03 * db + NF * 0.5;
  P3[2] = 1.25 * surf + cVV * vs + 0.3 * db + NF;
}

/** SAR amplitude image. Writes expected (speckle-free) dB into dbOut. */
export function sar(scene: Scene, S: SceneState, pol: Pol, band: BandId, img: Uint8ClampedArray, dbOut: Float32Array): void {
  const il = scene.illum;
  prep(S, band === 'S');
  if (pol === 'RGB') {
    for (let i = 0; i < N; i++) {
      sigma(i);
      const g = il ? il[i] : 1;
      const hh = 10 * Math.log10(P3[0] * g), hv = 10 * Math.log10(P3[1] * g), vv = 10 * Math.log10(P3[2] * g);
      const sp = SPK[i];
      dbOut[i] = hh;
      const j = i * 4;
      img[j] = (hh + sp + 24) * 11.6;                     // −24 … −2 dB
      img[j + 1] = (hv + SPK[(i + 7919) % N] + 30) * 12.1; // −30 … −9 dB
      img[j + 2] = (vv + SPK[(i + 15013) % N] + 24) * 11.6;
      img[j + 3] = 255;
    }
    return;
  }
  const pd = POL[pol as 'HH' | 'HV' | 'VV'], idx = pd.idx, lo = pd.lo, inv = 255 / (pd.hi - pd.lo);
  const tr = pd.tint[0], tg = pd.tint[1], tb = pd.tint[2], off = idx * 7919;
  for (let i = 0; i < N; i++) {
    sigma(i);
    const db = 10 * Math.log10(P3[idx] * (il ? il[i] : 1));
    dbOut[i] = db;
    let g = (db + SPK[(i + off) % N] - lo) * inv;
    g = g < 0 ? 0 : g > 255 ? 255 : g;
    const j = i * 4;
    img[j] = g * tr; img[j + 1] = g * tg; img[j + 2] = g * tb; img[j + 3] = 255;
  }
}

/** Pair coherence at one pixel (shared by the renderer and the probe). */
export function pairCoherence(scene: Scene, SA: SceneState, SB: SceneState, i: number, isS: boolean, dt: number): number {
  let coh;
  if (scene.insar === 'repeat12') {
    coh = SB.C[i] * (1 - SB.X[i]);
    if (isS) coh *= 0.8;
  } else {
    const ca = SA.C[i], cb = SB.C[i];
    coh = ca < cb ? ca : cb;
    if (dt > 0.02) coh = Math.pow(coh, 1 + dt * 0.35); else coh = coh + (1 - coh) * (1 - dt / 0.02);
    const dx = SB.X[i] - SA.X[i];
    coh *= 1 - (dx < 0 ? -dx : dx);
    if (isS) { const v = SA.V[i] > SB.V[i] ? SA.V[i] : SB.V[i]; coh *= 1 - 0.55 * (v > 1 ? 1 : v); }
  }
  return coh < 0 ? 0 : coh;
}

/** Line-of-sight displacement (cm) the interferogram encodes at one pixel. */
export function pairDisplacement(scene: Scene, SA: SceneState, SB: SceneState, i: number): number {
  return scene.insar === 'repeat12' ? SB.P[i] : SB.P[i] - SA.P[i];
}

/** Wrapped interferogram over the amplitude image of date B. */
export function insar(scene: Scene, SA: SceneState, SB: SceneState, band: BandId, img: Uint8ClampedArray, dbOut: Float32Array, tA: number, tB: number): void {
  ensureSky();
  const isS = band === 'S';
  const lambda = BANDS[band].lambda;
  const k = 2 / lambda;                                // cycles per cm of LOS motion (two-way path)
  const dt = Math.abs(tB - tA);
  const rep = scene.insar === 'repeat12';
  const atmOn = rep || dt > 0.02 ? 1 : 0;
  const a1 = Math.cos(7.3 * tB) * 1.1 * atmOn, a2 = Math.sin(5.1 * tB) * 0.9 * atmOn;
  const il = scene.illum;
  prep(SB, isS);
  for (let i = 0; i < N; i++) {
    sigma(i);
    const db = 10 * Math.log10(P3[0] * (il ? il[i] : 1));
    dbOut[i] = db;
    let amp = (db + SPK[i] + 27) / 26;
    amp = amp < 0 ? 0 : amp > 1 ? 1 : amp;
    const coh = pairCoherence(scene, SA, SB, i, isS, dt);
    const dP = (rep ? SB.P[i] : SB.P[i] - SA.P[i]) + (ATM1[i] - 0.5) * a1 + (ATM2[i] - 0.5) * a2;
    const oc = 1 - coh;
    let ph = dP * k + oc * oc * 0.65 * PHN[i];
    ph -= Math.floor(ph);
    const q = ((ph * 256) | 0) * 3;
    const sat = coh > 0.75 ? 1 : 0.2 + coh * 1.0667;
    const lum = 0.42 + 0.58 * amp, gray = 60 + 150 * amp;
    const j = i * 4;
    img[j] = gray + (RAINBOW[q] * lum - gray) * sat;
    img[j + 1] = gray + (RAINBOW[q + 1] * lum - gray) * sat;
    img[j + 2] = gray + (RAINBOW[q + 2] * lum - gray) * sat;
    img[j + 3] = 255;
  }
}

/* ---- optical ------------------------------------------------------------ */
function skyParams(scene: Scene, t: number): SkyParams {
  const sk = scene.sky(t);
  const cover = clamp(sk.cover, 0.05, 0.95);
  return {
    cover, smoke: sk.smoke || 0, light: sk.light == null ? 1 : sk.light,
    thr: 0.5 - (cover - 0.5) * 0.62,
    ox1: Math.floor(t * W * 0.33), oy1: Math.floor(t * H * 0.21),
    ox2: Math.floor(t * W * 0.57 + 311), oy2: Math.floor(t * H * 0.13 + 97),
  };
}
function cloudAt(p: SkyParams, x: number, y: number): number {
  const c = 0.62 * CL1[((y + p.oy1) % H) * W + ((x + p.ox1) % W)] + 0.38 * CL2[((y + p.oy2) % H) * W + ((x + p.ox2) % W)];
  let a = (c - p.thr) / 0.13;
  a = a < 0 ? 0 : a > 1 ? 1 : a;
  return a * a * (3 - 2 * a) * 0.97;
}
/** Cloud opacity (0..1) over one pixel on a given date — used by the probe. */
export function cloudAlpha(scene: Scene, x: number, y: number, t: number): number {
  ensureSky();
  return cloudAt(skyParams(scene, t), x, y);
}

export function optical(scene: Scene, S: SceneState, t: number, clouds: boolean, img: Uint8ClampedArray): SkyParams {
  ensureSky();
  const p = skyParams(scene, t), O = S.O;
  const light = p.light, smoke = p.smoke;
  const nr = 3 * (1 - light), ng = 5 * (1 - light), nb = 12 * (1 - light);
  const ax1 = p.ox1 % W, ax2 = p.ox2 % W;
  for (let y = 0; y < H; y++) {
    const r1 = ((y + p.oy1) % H) * W, r2 = ((y + p.oy2) % H) * W;
    let x1 = ax1, x2 = ax2;
    for (let x = 0; x < W; x++) {
      const i = y * W + x, j3 = i * 3, j = i * 4;
      let r = O[j3], g = O[j3 + 1], b = O[j3 + 2];
      // thin atmospheric haze so the optical view never looks sharper than it should
      r = r * 0.93 + 12; g = g * 0.93 + 14; b = b * 0.93 + 18;
      if (clouds) {
        const c2 = CL2[r2 + x2];
        if (smoke > 0.02) {
          const sm = smoke * (0.3 + 0.6 * CL2[r1 + x2]);
          r += (156 - r) * sm; g += (140 - g) * sm; b += (120 - b) * sm;
        }
        const c = 0.62 * CL1[r1 + x1] + 0.38 * c2;
        let a = (c - p.thr) / 0.13;
        if (a > 0) {
          a = a > 1 ? 1 : a;
          a = a * a * (3 - 2 * a) * 0.97;
          const w = 214 + 150 * (c - p.thr);
          const cw = w > 250 ? 250 : w;
          r += (cw - r) * a; g += (cw + 2 - g) * a; b += (cw + 5 - b) * a;
        }
      }
      img[j] = r * light + nr; img[j + 1] = g * light + ng; img[j + 2] = b * light + nb; img[j + 3] = 255;
      if (++x1 === W) x1 = 0;
      if (++x2 === W) x2 = 0;
    }
  }
  return p;
}

/** Tint date-B pixels where backscatter changed by more than ~3 dB since date A. */
export function changeOverlay(img: Uint8ClampedArray, dbA: Float32Array, dbB: Float32Array): void {
  for (let i = 0; i < N; i++) {
    const d = dbB[i] - dbA[i];
    const m = d < 0 ? -d : d;
    if (m < 2.5) continue;
    let a = (m - 2.5) / 5;
    a = (a > 1 ? 1 : a) * 0.78;
    const j = i * 4;
    if (d > 0) { img[j] += (126 - img[j]) * a; img[j + 1] += (175 - img[j + 1]) * a; img[j + 2] += (240 - img[j + 2]) * a; }
    else { img[j] += (226 - img[j]) * a; img[j + 1] += (36 - img[j + 1]) * a; img[j + 2] += (63 - img[j + 2]) * a; }
  }
}

/** Expected backscatter (dB) of one pixel in all three channels. */
export function expected(scene: Scene, S: SceneState, i: number, band: BandId): { HH: number; HV: number; VV: number } {
  physSigma(S.R[i], S.E[i], S.V[i], S.D[i], band === 'S', P3);
  const g = scene.illum ? scene.illum[i] : 1;
  return { HH: 10 * Math.log10(P3[0] * g), HV: 10 * Math.log10(P3[1] * g), VV: 10 * Math.log10(P3[2] * g) };
}

/**
 * Highlight the pixels whose HH return is dominated by one scattering mechanism,
 * and dim the rest. Returns the highlighted share of the scene (0..1).
 */
export function mechanismOverlay(img: Uint8ClampedArray, S: SceneState, band: BandId, mech: Mechanism): number {
  prep(S, band === 'S');
  let hits = 0;
  for (let i = 0; i < N; i++) {
    let rm = fS ? fR[i] * 1.55 + 0.04 : fR[i];
    rm = rm < 0 ? 0 : rm > 1 ? 1 : rm;
    let ei = ((fE[i] - 1) * EK) | 0;
    ei = ei < 0 ? 0 : ei > LN ? LN : ei;
    let vi = (fV[i] * VK) | 0;
    vi = vi < 0 ? 0 : vi > LN ? LN : vi;
    const G = LG[ei], one = 1 - rm;
    const surf = 0.8 * 0.606 * G * LP[(rm * LN) | 0] * fAtt[vi];
    const vol = cHH * fVs[vi];
    const dbl = 0.85 * fD[i] * G * one * one * fAtd[vi];
    // a mirror-smooth, weak surface return counts as "surface" (specular) too
    const dom: Mechanism = dbl >= surf && dbl >= vol && dbl > 0.004 ? 'double' : vol > surf && fV[i] > 0.12 ? 'volume' : 'surface';
    const j = i * 4;
    if (dom === mech) {
      hits++;
      const lum = (img[j] + img[j + 1] + img[j + 2]) / 3;
      const k = 0.35 + (lum / 255) * 0.65;
      img[j] += (211 * k + 44 - img[j]) * 0.66;
      img[j + 1] += (36 * k + 8 - img[j + 1]) * 0.66;
      img[j + 2] += (63 * k + 14 - img[j + 2]) * 0.66;
    } else {
      img[j] *= 0.34; img[j + 1] *= 0.36; img[j + 2] *= 0.4;
    }
  }
  return hits / N;
}

/** Dominant HH mechanism at one pixel, with the three component powers. */
export function mechanismAt(S: SceneState, i: number, band: BandId): { dominant: Mechanism; surface: number; volume: number; dbl: number } {
  const isS = band === 'S';
  const R = S.R[i], E = S.E[i], V = S.V[i], D = S.D[i];
  const Rm = isS ? Math.min(1, R * 1.55 + 0.04) : R;
  const G = fresnel(E), kv = isS ? 3.0 : 1.15, one = 1 - Rm;
  const surface = 0.8 * 0.606 * G * Math.pow(Rm, 1.6) * Math.exp(-kv * V);
  const volume = (isS ? 0.13 : 0.16) * (1 - Math.exp(-(isS ? 4.5 : 2.2) * V));
  const dbl = 0.85 * D * G * one * one * Math.exp(-kv * V * 0.8);
  const dominant: Mechanism = dbl >= surface && dbl >= volume && dbl > 0.004 ? 'double' : volume > surface && V > 0.12 ? 'volume' : 'surface';
  return { dominant, surface, volume, dbl };
}

export { W, H, N };
