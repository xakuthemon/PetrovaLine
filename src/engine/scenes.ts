/*
 * Petrova Line — procedural scene engine.
 *
 * Each scene turns a date (decimal year) into a per-pixel surface state:
 *   R roughness · E dielectric constant · V volume scatterers · D vertical structure
 *   C interferometric coherence · P line-of-sight displacement (cm) · X disturbance
 *   K surface class · O optical colour
 * The renderer (render.ts) converts that state into SAR, InSAR or optical
 * imagery with the shared backscatter model in physics.ts.
 *
 * Everything here is SIMULATED for demonstration. Geography is schematic and the
 * numbers are scenario values, not NISAR measurements.
 */
import { sat, lerp, smooth, hash2, fbmField, segDist, rng, fmt, fmtSigned, M_MAX, monthToYear } from './util';
import { sigma } from './physics';

export const W = 720, H = 450, N = W * H;
const TAU = Math.PI * 2;

export type SceneId = 'caspian' | 'pantanal' | 'fault' | 'glacier';

export interface SceneState {
  R: Float32Array; E: Float32Array; V: Float32Array; D: Float32Array;
  C: Float32Array; P: Float32Array; X: Float32Array;
  K: Uint8Array; O: Uint8ClampedArray; t: number;
}
export interface Roi { x0: number; y0: number; x1: number; y1: number }
export interface Bounds { north: number; south: number; west: number; east: number }
export interface Metrics { b1: number; b2: number; a1: number; a2?: number; d1: number }
export interface Sky { cover: number; smoke: number; light: number }
export interface Kpi { k: string; v: string }
export interface Series { b1: number[]; b2: number[]; a1: number[]; a2: (number | null)[]; d1: number[] }

export interface Scene {
  id: SceneId;
  W: number; H: number;
  widthKm: number;
  bounds: Bounds;
  /** cumulative: phase of date B minus date A · repeat12: one 12-day pair ending at date B */
  insar: 'cumulative' | 'repeat12';
  init(): void;
  compute(t: number, S: SceneState, optical: boolean, st: number): void;
  metrics(S: SceneState, t: number, st: number): Metrics;
  /** named places in scene coordinates (u, v), 0..1 */
  anchors: Record<string, [number, number]>;
  /** per-pixel brightness factor (terrain slope, facies), or null */
  readonly illum: Float32Array | null;
  readonly roi: Roi;
  /** elevation relative to the January 2020 sea level (m), when the scene has it */
  readonly height?: Float32Array;
  sky(t: number): Sky;
  kpi(t: number): Kpi[];
  TEQ?: number;
  series?: Series;
}

export const CLASSES: string[] = [
  'Open water',                       // 0
  'Desert plateau',                   // 1
  'Exposed seabed · salt flat',       // 2
  'Reed bed standing in water',       // 3
  'Forest canopy',                    // 4
  'Flooded forest',                   // 5
  'Savanna grassland',                // 6
  'Urban blocks',                     // 7
  'Dry snow · firn',                  // 8
  'Wet snow · surface melt',          // 9
  'Bedrock · tundra',                 // 10
  'Ice mélange · icebergs',           // 11
  'Cropland',                         // 12
  'Lagoon water',                     // 13
  'Stranded reed bed (dry ground)',   // 14
  'Port · industrial structures',     // 15
  'Flooded grassland · marsh',        // 16
  'Pasture (cleared forest)',         // 17
  'Fresh clearing · burn scar',       // 18
  'Mountain shrubland',               // 19
  'Bare glacier ice',                 // 20
  'Melt pond',                        // 21
  'Sea ice',                          // 22
  'Collapsed · damaged buildings',    // 23
  'Crevassed fast-flowing ice',       // 24
  'Road · paved surface',             // 25
  'Clay pan (takyr)',                 // 26
];

export function makeState(): SceneState {
  return {
    R: new Float32Array(N), E: new Float32Array(N), V: new Float32Array(N), D: new Float32Array(N),
    C: new Float32Array(N), P: new Float32Array(N), X: new Float32Array(N),
    K: new Uint8Array(N), O: new Uint8ClampedArray(N * 3), t: NaN,
  };
}

function boundsFor(lat: number, lon: number, widthKm: number): Bounds {
  const heightKm = (widthKm * H) / W;
  const dLat = heightKm / 111.32;
  const dLon = widthKm / (111.32 * Math.cos((lat * Math.PI) / 180));
  return { north: lat + dLat / 2, south: lat - dLat / 2, west: lon - dLon / 2, east: lon + dLon / 2 };
}

const P3 = new Float32Array(3);
/** Mean expected HH / HV (dB, L-band) over a pixel rectangle, optionally masked. */
function roiDb(S: SceneState, illum: Float32Array | null, roi: Roi, st: number, mask: ((i: number) => boolean) | null) {
  let hh = 0, hv = 0, n = 0;
  const y0 = Math.ceil(roi.y0 / st) * st, x0 = Math.ceil(roi.x0 / st) * st;
  for (let y = y0; y < roi.y1; y += st) {
    for (let x = x0; x < roi.x1; x += st) {
      const i = y * W + x;
      if (mask && !mask(i)) continue;
      sigma(S.R[i], S.E[i], S.V[i], S.D[i], false, P3);
      const g = illum ? illum[i] : 1;
      hh += P3[0] * g; hv += P3[1] * g; n++;
    }
  }
  if (!n) return { hh: -30, hv: -33 };
  return { hh: 10 * Math.log10(hh / n), hv: 10 * Math.log10(hv / n) };
}

/** Snap a pixel coordinate onto the coarse grid used for metric sampling. */
const snap = (v: number) => Math.round(v / 6) * 6;

function countPx(st: number, pred: (i: number) => boolean): number {
  let n = 0;
  for (let y = 0; y < H; y += st) for (let x = 0; x < W; x += st) if (pred(y * W + x)) n++;
  return n * st * st;
}

/* ====================================================================== *
 * I. CASPIAN SEA — Aktau shoreline & Karakol wetland
 * ====================================================================== */
function caspian(): Scene {
  const WK = 24, pxKm = WK / W, pxArea = pxKm * pxKm;
  let h: Float32Array, tex: Float32Array, n1: Float32Array, n2: Float32Array, K0: Uint8Array, ST: Float32Array,
    LK: Float32Array, REED: Float32Array, SUB: Float32Array, PAN: Float32Array, illum: Float32Array;
  const anchors: Record<string, [number, number]> = {};
  let roi: Roi = { x0: 0, y0: 0, x1: 1, y1: 1 };
  let portI = 0;

  const uc = (v: number) => 0.30 + 0.30 * v + 0.035 * Math.sin(v * 7.0) + 0.018 * Math.sin(v * 17 + 1);
  function seaLevel(t: number): number {                       // metres relative to January 2020
    const y = t - 2020, fr = t - Math.floor(t);
    return -0.16 * y - 0.008 * y * y + 0.10 * Math.cos(TAU * (fr - 0.5)) + 0.10;
  }
  function lakeThr(t: number): number {
    const y = sat((t - 2020) / 6.67), fr = t - Math.floor(t);
    return 0.42 + 0.13 * Math.pow(y, 1.1) + 0.02 * Math.cos(TAU * (fr - 0.65));
  }

  function init() {
    n1 = fbmField(W, H, 11, 3, { oct: 5 });
    n2 = fbmField(W, H, 12, 9, { oct: 4 });
    const nl = fbmField(W, H, 16, 5, { oct: 3 });
    const np = fbmField(W, H, 17, 7, { oct: 3 });
    PAN = new Float32Array(N);
    tex = fbmField(W, H, 13, 46, { oct: 2 });
    const nr = fbmField(W, H, 14, 6, { oct: 4, ridged: true });
    const nb = fbmField(W, H, 15, 16, { oct: 3 });
    h = new Float32Array(N); K0 = new Uint8Array(N); ST = new Float32Array(N);
    LK = new Float32Array(N).fill(-1); REED = new Float32Array(N); SUB = new Float32Array(N);
    illum = new Float32Array(N).fill(1);

    // pass 1 — signed distance to the 2020 coastline (km, + = land) and coast position per row
    const dC = new Float32Array(N);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        dC[i] = (x / W - uc(v)) * WK + (n1[i] - 0.5) * 1.0 + (n2[i] - 0.5) * 0.45;
      }
    }
    const cxr = new Float32Array(H), cxs = new Float32Array(H);
    for (let y = 0; y < H; y++) {
      let c = 0;
      for (let x = W - 1; x >= 0; x--) if (dC[y * W + x] < 0) { c = x + 1; break; }
      cxr[y] = c;
    }
    for (let y = 0; y < H; y++) {
      let s = 0, n = 0;
      for (let k = -7; k <= 7; k++) { const yy = y + k; if (yy >= 0 && yy < H) { s += cxr[yy]; n++; } }
      cxs[y] = s / n;
    }

    const yp = Math.round(0.40 * H), px0 = cxs[yp];
    const segs = [
      [px0 + 2, yp - 16, px0 - 24, yp - 8],
      [px0 - 24, yp - 8, px0 - 27, yp + 16],
      [px0 + 2, yp + 24, px0 - 14, yp + 22],
    ];
    const ym = Math.round(0.515 * H), mcx = cxs[ym] + 30;
    const yl = Math.round(0.765 * H), lcx = cxs[yl] + 62, lcy = yl, lrx = 44, lry = 94;
    const canal = [mcx + 6, ym + 9, lcx - 6, lcy - lry * 0.78];
    const ycity = Math.round(0.2 * H), ccx = cxs[ycity] + 60;
    const roads = [
      [ccx, ycity, W, 0.06 * H], [ccx + 20, ycity + 20, W, 0.52 * H],
      [cxs[Math.round(0.34 * H)] + 34, 0.34 * H, mcx + 16, ym - 10],
      [mcx + 16, ym + 10, lcx + 74, lcy - 20], [lcx + 74, lcy - 20, lcx + 96, H],
    ];
    const th = 0.30, cs = Math.cos(th), sn = Math.sin(th);

    for (let y = 0; y < H; y++) {
      const v = y / H, sv = smooth(0.30, 0.85, v);
      for (let x = 0; x < W; x++) {
        const i = y * W + x, d = dC[i];
        let hh: number;
        if (d < 0) {
          // shallow shelf: gentle in the south, with sand bars that emerge as the sea drops
          const depth = -d * lerp(4.5, 0.85, sv) - 0.9 * (nb[i] - 0.45) * Math.exp(d / 2.5) * (0.5 + sv);
          hh = -depth;
        } else {
          hh = 0.02 + d * lerp(14, 2.2, sv) + (nr[i] - 0.5) * 2.4 * sat(d / 1.5);
          illum[i] = lerp(1, 0.62 + 0.8 * nr[i], sat(d / 1.2));
          PAN[i] = smooth(0.8, 0.85, np[i]) * sat((d - 1.5) / 1.5);
        }
        const dx = (x - cxs[y]) * pxKm; // cross-shore distance from the smoothed coast

        // Aktau — coastal microdistricts
        const cityV = smooth(0.05, 0.09, v) * (1 - smooth(0.32, 0.37, v));
        const cityX = smooth(0.2, 0.45, dx) * (1 - smooth(2.9, 4.1, dx + (n2[i] - 0.5) * 1.8));
        if (cityV * cityX > 0.5 && d > 0.12) {
          const xr = x * cs + y * sn, yr = -x * sn + y * cs;
          const bx = Math.floor(xr / 9), by = Math.floor(yr / 9);
          const hb = hash2(bx, by, 71);
          K0[i] = 7;
          ST[i] = (xr - bx * 9 > 1.7 && yr - by * 9 > 1.7 && hb > 0.14)
            ? 0.7 + 2.1 * hb * hb + 0.5 * hash2(x >> 1, y >> 1, 5) : 0.1;
          hh = Math.max(hh, 2);
        }
        // port: breakwaters and yard
        let ds = 1e9;
        for (let k = 0; k < segs.length; k++) {
          const s = segs[k];
          const q = segDist(x, y, s[0], s[1], s[2], s[3]);
          if (q < ds) ds = q;
        }
        if (ds < 1.3) { K0[i] = 15; ST[i] = 2.6; hh = Math.max(hh, 1.5); }
        else if (x > px0 + 3 && x < px0 + 27 && y > yp - 14 && y < yp + 24) {
          K0[i] = 15; ST[i] = 0.5 + 2.3 * hash2((x / 3) | 0, (y / 3) | 0, 9); hh = Math.max(hh, 1.2);
        }
        // power & desalination complex
        if (Math.abs(x - mcx) < 15 && Math.abs(y - ym) < 10) {
          K0[i] = 15; ST[i] = 0.7 + 2.5 * hash2((x / 3) | 0, (y / 3) | 0, 19); hh = Math.max(hh, 1.5);
        }
        // Karakol lagoon basin (elongated along the coast)
        const ex = x - lcx, ey = y - lcy;
        const al = ex * 0.432 + ey * 0.902, cr = ex * 0.902 - ey * 0.432;
        const ld = 1 - Math.sqrt((cr / lrx) * (cr / lrx) + (al / lry) * (al / lry)) + 0.85 * (nl[i] - 0.5) + 0.22 * (n2[i] - 0.5) + 0.06 * (tex[i] - 0.5);
        if (ld > 0 && K0[i] === 0) {
          LK[i] = ld;
          hh = Math.max(hh, 0.6);
          REED[i] = smooth(0.25, 0.34, ld) * (1 - smooth(0.5, 0.62, ld)) * smooth(0.3, 0.55, nb[i] * 0.7 + n2[i] * 0.3);
        }
        if (K0[i] === 0 && LK[i] < 0 && segDist(x, y, canal[0], canal[1], canal[2], canal[3]) < 0.9) {
          K0[i] = 31; hh = Math.max(hh, 0.5);
        }
        if (K0[i] === 0 && LK[i] < 0 && d > 0.1) {
          for (let k = 0; k < roads.length; k++) {
            const s = roads[k];
            if (segDist(x, y, s[0], s[1], s[2], s[3]) < 0.75) { K0[i] = 32; hh = Math.max(hh, 0.6); break; }
          }
        }
        h[i] = hh;
        // slow settlement of port fill and shoreline works (cm / yr)
        const rp = Math.hypot(x - (px0 + 12), y - (yp + 4)) * pxKm;
        const rm = Math.hypot(x - mcx, y - ym) * pxKm;
        SUB[i] = -1.4 * Math.exp(-(rp * rp) / (2 * 0.8 * 0.8)) - 0.5 * Math.exp(-(rm * rm) / (2 * 0.6 * 0.6));
      }
    }
    portI = snap(yp + 4) * W + snap(px0 + 12);
    roi = { x0: Math.round(lcx - 14), y0: Math.round(lcy - 62), x1: Math.round(lcx + 52), y1: Math.round(lcy + 44) };
    const yf = Math.round(0.63 * H);
    anchors.city = [(cxs[Math.round(0.2 * H)] + 48) / W, 0.2];
    anchors.port = [(px0 - 4) / W, (yp + 4) / H];
    anchors.plant = [mcx / W, ym / H];
    anchors.karakol = [lcx / W, lcy / H];
    anchors.flats = [(cxs[yf] - 12) / W, yf / H];
    // sample point: a dense reed stand that is in water in 2020 and stranded later
    let reedI = -1, reedS = -1e9;
    for (let y = roi.y0; y < roi.y1; y++) for (let x = roi.x0; x < roi.x1; x++) {
      const i = y * W + x;
      if (REED[i] < 0.5) continue;
      const sc = REED[i] - Math.abs(LK[i] - 0.47) * 4;
      if (sc > reedS) { reedS = sc; reedI = i; }
    }
    anchors.reeds = reedI >= 0 ? [(reedI % W) / W, Math.floor(reedI / W) / H] : [(roi.x0 + roi.x1) / 2 / W, (roi.y0 + 12) / H];
  }

  function compute(t: number, S: SceneState, optical: boolean, st: number): void {
    const L = seaLevel(t), thr = lakeThr(t), yrs = t - 2020;
    const fr = t - Math.floor(t);
    const wetS = 0.5 + 0.5 * Math.cos(TAU * (fr - 0.12));
    const wind = 0.5 + 0.5 * Math.sin(t * 31.7);
    const R = S.R, E = S.E, V = S.V, D = S.D, C = S.C, P = S.P, X = S.X, K = S.K, O = S.O;
    for (let y = 0; y < H; y += st) {
      for (let x = 0; x < W; x += st) {
        const i = y * W + x, k0 = K0[i], tx = tex[i];
        let r = 0, e = 0, vg = 0, d = 0, c = 0, p = SUB[i] * yrs, k = 0, cr = 0, cg = 0, cb = 0;
        if (k0 === 7) {
          const s = ST[i];
          r = 0.2; e = 9; d = s; c = s > 0.2 ? 0.95 : 0.8; k = 7;
          if (optical) { const g = s > 0.2 ? 128 + 26 * s : 92; cr = g + 6; cg = g + 2; cb = g - 4; }
        } else if (k0 === 15) {
          r = 0.25; e = 10; d = ST[i]; c = 0.9; k = 15;
          if (optical) { const g = 120 + 22 * ST[i]; cr = g; cg = g + 2; cb = g + 8; }
        } else if (k0 === 31) {
          r = 0.04; e = 80; c = 0.03; k = 13;
          if (optical) { cr = 46; cg = 92; cb = 112; }
        } else if (k0 === 32) {
          r = 0.1; e = 5; c = 0.9; k = 25;
          if (optical) { cr = 98; cg = 94; cb = 90; }
        } else if (LK[i] > 0) {
          const ld = LK[i], rd = REED[i], wet = ld - thr;
          if (wet > 0) {
            if (rd > 0.25) {
              k = 3; r = 0.05; e = 80; vg = 0.36 * rd; d = 1.05 * rd; c = 0.35;
              if (optical) { cr = lerp(44, 84, rd); cg = lerp(88, 118, rd); cb = lerp(104, 58, rd); }
            } else {
              k = 13; r = 0.04 + 0.03 * tx; e = 80; c = 0.03;
              if (optical) { const q = sat(wet / 0.3); cr = lerp(70, 34, q); cg = lerp(126, 82, q); cb = lerp(128, 112, q); }
            }
          } else {
            const dry = -wet, m = Math.exp(-dry / 0.07);
            if (rd > 0.25) {
              const die = sat((dry - 0.03) / 0.14);
              k = 14; vg = 0.36 * rd * (1 - 0.7 * die); d = 0.42 * rd * (1 - 0.5 * die);
              e = 7 + 34 * m; r = 0.22 + 0.1 * tx; c = 0.45;
              if (optical) { cr = lerp(88, 164, die); cg = lerp(118, 146, die); cb = lerp(60, 92, die); }
            } else {
              k = 2; e = 4.5 + 40 * m + 6 * wetS; r = 0.1 + 0.1 * tx + 0.1 * m; c = 0.8 - 0.4 * m;
              p -= 5 * (1 - m);
              if (optical) { const q = 1 - m; cr = lerp(112, 222, q); cg = lerp(104, 214, q); cb = lerp(92, 196, q); }
            }
          }
        } else {
          const hh = h[i], dz = hh - L;
          if (dz < -0.04) {
            k = 0; r = 0.035 + 0.075 * wind * n1[i] * n2[i] + 0.02 * tx; e = 80; c = 0.03;
            if (optical) { const q = sat(-dz / 6); cr = lerp(78, 16, q); cg = lerp(156, 54, q); cb = lerp(150, 88, q); }
          } else if (hh < 0.25) {
            const dd = dz < 0 ? 0 : dz;
            const m = sat(Math.exp(-dd / 0.3) * 0.85 + 0.22 * wetS * Math.exp(-dd / 1.2));
            k = 2; e = 4 + 44 * m; r = 0.09 + 0.1 * tx + 0.13 * m; c = 0.85 - 0.5 * m;
            if (hh < 0.05) p -= 7 * (1 - Math.exp(-dd / 0.5));
            if (optical) { const q = 1 - m; cr = lerp(108, 226, q) - 14 * tx; cg = lerp(102, 218, q) - 14 * tx; cb = lerp(92, 200, q) - 14 * tx; }
          } else {
            const pan = PAN[i];
            k = pan > 0.5 ? 26 : 1; r = lerp(0.26 + 0.3 * n2[i], 0.08, pan); e = 3.2 + 2.2 * wetS * (0.4 + 0.6 * tx) + 9 * pan * wetS;
            vg = (0.02 + 0.05 * n2[i]) * (1 - pan); c = 0.93;
            if (optical) { const g = 0.7 + 0.3 * illum[i]; cr = lerp(190 * g, 214, pan); cg = lerp(164 * g, 204, pan); cb = lerp(124 * g, 184, pan); }
          }
        }
        R[i] = r; E[i] = e; V[i] = vg; D[i] = d; C[i] = c; P[i] = p; X[i] = 0; K[i] = k;
        if (optical) { const j = i * 3; O[j] = cr; O[j + 1] = cg; O[j + 2] = cb; }
      }
    }
    S.t = t;
  }

  function metrics(S: SceneState, t: number, st: number): Metrics {
    const db = roiDb(S, illum, roi, st, (i) => REED[i] > 0.25);
    const exposed = countPx(st, (i) => S.K[i] === 2 && h[i] < -0.02 && LK[i] < 0) * pxArea;
    const wetland = countPx(st, (i) => S.K[i] === 13 || S.K[i] === 3) * pxArea;
    return { b1: db.hh, b2: db.hv, a1: exposed, a2: wetland, d1: S.P[portI] };
  }

  return {
    id: 'caspian', W, H, widthKm: WK, bounds: boundsFor(43.585, 51.235, WK), insar: 'cumulative',
    init, compute, metrics, anchors,
    get illum() { return illum; }, get roi() { return roi; },
    /** Elevation relative to the January 2020 sea level (m), one value per pixel. */
    get height() { return h; },
    sky(t: number): Sky {
      const fr = t - Math.floor(t), winter = 0.5 + 0.5 * Math.cos(TAU * (fr - 0.04));
      return { cover: 0.42 + 0.26 * winter + 0.1 * Math.sin(t * 9.1), smoke: 0.12 * (1 - winter), light: 1 };
    },
    kpi(t: number): Kpi[] {
      return [
        { k: 'Sea level vs Jan 2020', v: fmtSigned(seaLevel(t), 2) + ' m' },
        { k: 'Shoreline retreat, south bay', v: '≈ ' + fmt(Math.max(0, -seaLevel(t)) / 0.85, 1) + ' km' },
      ];
    },
  };
}

/* ====================================================================== *
 * II. PANTANAL — flood pulse under the canopy, clearing on the upland
 * ====================================================================== */
function pantanal(): Scene {
  const WK = 48, pxKm = WK / W, pxArea = pxKm * pxKm;
  let e: Float32Array, F: Float32Array, TC: Float32Array, PW: Uint8Array, DR: Float32Array, UP: Float32Array,
    tex: Float32Array, n2: Float32Array;
  const anchors: Record<string, [number, number]> = {};
  let roi: Roi = { x0: 0, y0: 0, x1: 1, y1: 1 };
  let roiI = 0;
  const AMP: Record<number, number> = { 2019: 0.8, 2020: 0.52, 2021: 0.46, 2022: 0.82, 2023: 1.0, 2024: 0.42, 2025: 0.78, 2026: 0.9, 2027: 0.85 };
  const xr = (v: number) => 0.36 + 0.07 * Math.sin(v * 9 + 0.5) + 0.04 * Math.sin(v * 21 + 2) + 0.018 * Math.sin(v * 47);
  const xr2 = (v: number) => xr(v) - 0.17 + 0.05 * Math.sin(v * 13 + 4);
  const roadV = (u: number) => 0.56 + 0.05 * Math.sin(u * 8);

  function stage(t: number): number {                              // river stage, metres above low water
    const y = Math.floor(t), fr = t - y;
    const a = lerp(AMP[y] || 0.8, AMP[y + 1] || 0.8, smooth(0.72, 0.95, fr));
    const s = 0.5 + 0.5 * Math.cos(TAU * (fr - 0.36));
    return 0.35 + 3.4 * a * Math.pow(s, 1.5);
  }
  const R0 = stage(2020), R1 = stage(2020 - 0.07);

  function init() {
    const n1 = fbmField(W, H, 21, 2.5, { oct: 5 });
    n2 = fbmField(W, H, 22, 8, { oct: 4 });
    tex = fbmField(W, H, 23, 44, { oct: 2 });
    const nb = fbmField(W, H, 24, 5, { oct: 4 });
    const nc = fbmField(W, H, 25, 14, { oct: 3 });
    e = new Float32Array(N); F = new Float32Array(N); TC = new Float32Array(N).fill(9999);
    PW = new Uint8Array(N); DR = new Float32Array(N); UP = new Float32Array(N);
    for (let y = 0; y < H; y++) {
      const v = y / H, rx = xr(v), rx2 = xr2(v);
      const row = Math.floor(y / 9), shift = (row % 2) * 6;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, u = x / W;
        const dr = Math.abs(u - rx), dr2 = Math.abs(u - rx2);
        const up = smooth(0.64, 0.74, u + 0.26 * (n1[i] - 0.5) + 0.07 * (n2[i] - 0.5) + 0.05 * Math.sin(v * 5));
        let el = 0.3 + 2.9 * n1[i] + 1.0 * n2[i] + 0.35 * nc[i] + up * (5 + 9 * n1[i]);
        const lev = (dr - 0.022) / 0.012;
        el += 0.45 * Math.exp(-lev * lev);
        const lake = smooth(0.77, 0.81, nc[i]) * (1 - up) * (1 - smooth(0.5, 0.7, n1[i]));
        if (dr < 0.0075) { PW[i] = 1; el = -2; }
        else if (dr2 < 0.004 || lake > 0.5) { PW[i] = 2; el = -2; }
        const lf = (dr - 0.02) / 0.022;
        const levF = Math.exp(-lf * lf) * 0.95;
        const patch = smooth(0.5, 0.55, 0.26 * nb[i] + 0.4 * n2[i] + 0.34 * nc[i]) * 0.9;
        const ffp = Math.max(levF, patch);
        const fup = nb[i] < 0.2 ? 0.3 : 0.95;
        F[i] = lerp(ffp, fup, up);
        e[i] = el; DR[i] = dr; UP[i] = up;

        // upland clearing: rectangular plots advancing from the road network
        if (up > 0.5 && v > 0.24) {
          const xs = x + shift;
          const cx = Math.floor(xs / 13), cy = row;
          const hs = hash2(cx, cy, 31);
          const ccx = cx * 13 + 6.5 - shift, cu = ccx / W, cv = (cy * 9 + 4.5) / H;
          const dv = Math.abs(cv - roadV(cu)) * H;
          const du = Math.abs((((ccx % 66) + 66) % 66) - 33);
          const dro = Math.min(dv, 33 - du + dv * 0.3);     // main road, then feeder roads every 66 px
          let tc = 2016.4 + dro * 0.19 + hs * 3.6 + (0.98 - cu) * 21;
          if (hs > 0.9) tc = 9999;                          // legal reserve fragments
          if ((xs % 13 < 1 || y % 9 < 1) && hash2(cx, cy, 33) > 0.6) tc = 9999; // boundary strips
          TC[i] = tc;
          if (Math.abs(v - roadV(u)) * H < 0.9) { TC[i] = 2000; F[i] = 0.1; }
        }
      }
    }
    const ru = xr(0.5);
    roi = { x0: Math.round((ru + 0.012) * W), y0: Math.round(0.42 * H), x1: Math.round((ru + 0.06) * W), y1: Math.round(0.6 * H) };
    roiI = snap(0.5 * H) * W + snap((ru + 0.03) * W);
    anchors.river = [xr(0.26), 0.26];
    anchors.forest = [ru + 0.036, 0.5];
    anchors.plain = [xr(0.74) - 0.1, 0.74];
    anchors.frontier = [0.86, 0.6];
    anchors.reserve = [0.86, 0.11];
  }

  function compute(t: number, S: SceneState, optical: boolean, st: number): void {
    const s0 = stage(t), s1 = stage(t - 0.07);
    const fr = t - Math.floor(t);
    const wetS = 0.5 + 0.5 * Math.cos(TAU * (fr - 0.1));
    const green = 0.5 + 0.5 * Math.cos(TAU * (fr - 0.2));
    const R = S.R, E = S.E, V = S.V, D = S.D, C = S.C, P = S.P, X = S.X, K = S.K, O = S.O;
    for (let y = 0; y < H; y += st) {
      const v = y / H, sl = lerp(s0, s1, v), sr = lerp(R0, R1, v);
      for (let x = 0; x < W; x += st) {
        const i = y * W + x, tx = tex[i];
        let r = 0, ee = 0, vg = 0, d = 0, c = 0, p = 0, xx = 0, k = 0, cr = 0, cg = 0, cb = 0;
        if (PW[i]) {
          k = 0; r = 0.035 + 0.03 * tx; ee = 80; c = 0.03;
          if (optical) { if (PW[i] === 1) { cr = 116; cg = 102; cb = 74; } else { cr = 54; cg = 70; cb = 62; } }
        } else {
          const loc = 1 - 0.3 * sat(DR[i] / 0.5);
          const wl = sl * loc, dep = wl - e[i];
          const fl = sat(dep / 0.3 + 0.5);
          const f = F[i], tc = TC[i];
          if (tc < t) {
            const age = t - tc;
            xx = 1;
            if (age < 0.4) {
              k = 18; r = 0.72; ee = 7 + 6 * wetS; vg = 0.14; d = 0.55; c = 0.2;
              if (optical) { if (age < 0.15) { cr = 122; cg = 98; cb = 72; } else { cr = 60; cg = 48; cb = 42; } }
            } else {
              k = 17; vg = 0.06 + 0.05 * green; r = 0.28 + 0.15 * tx; ee = 6 + 9 * wetS; c = 0.7;
              if (optical) { cr = lerp(180, 132, green) - 10 * tx; cg = lerp(162, 152, green) - 8 * tx; cb = lerp(106, 86, green); }
            }
          } else if (f > 0.5) {
            vg = 0.9 * f; r = lerp(0.5, 0.04, fl); ee = lerp(12 + 6 * wetS, 80, fl); d = lerp(0.55, 1.25, fl);
            c = lerp(0.28, 0.5, fl);
            if (fl > 0.5) { k = 5; p = (wl - sr * loc) * 80; } else k = 4;
            if (optical) { const g = 0.78 + 0.44 * tx; cr = 32 * g; cg = 72 * g; cb = 42 * g; }
          } else if (fl > 0.5) {
            const deep = sat(dep / 1.3 - 0.2 * tx);
            k = 16; vg = 0.1 * (1 - deep); d = 0.34 * (1 - deep) * (0.6 + 0.8 * n2[i]); r = 0.05; ee = 80; c = 0.12;
            p = (wl - sr * loc) * 80 * (1 - deep);
            if (optical) { cr = lerp(74, 62, deep); cg = lerp(100, 76, deep); cb = lerp(62, 66, deep); }
          } else {
            k = 6; vg = 0.13 + 0.09 * green + 0.2 * f; r = 0.32 + 0.2 * tx;
            ee = 5 + 11 * wetS + 16 * sat(dep + 0.7); c = 0.6;
            if (optical) { cr = lerp(180, 122, green) - 12 * tx; cg = lerp(166, 148, green) - 8 * tx; cb = lerp(110, 80, green); }
          }
        }
        R[i] = r; E[i] = ee; V[i] = vg; D[i] = d; C[i] = c; P[i] = p; X[i] = xx; K[i] = k;
        if (optical) { const j = i * 3; O[j] = cr; O[j + 1] = cg; O[j + 2] = cb; }
      }
    }
    S.t = t;
  }

  function metrics(S: SceneState, t: number, st: number): Metrics {
    const db = roiDb(S, null, roi, st, (i) => F[i] > 0.5 && !PW[i]);
    const flooded = countPx(st, (i) => S.K[i] === 5 || S.K[i] === 16) * pxArea;
    const cleared = countPx(st, (i) => TC[i] >= 2020 && TC[i] < t) * pxArea;
    const v = Math.floor(roiI / W) / H;
    const loc = 1 - 0.3 * sat(DR[roiI] / 0.5);
    const dh = (lerp(stage(t), stage(t - 0.07), v) - lerp(R0, R1, v)) * loc * 100;
    return { b1: db.hh, b2: db.hv, a1: flooded, a2: cleared, d1: dh };
  }

  return {
    id: 'pantanal', W, H, widthKm: WK, bounds: boundsFor(-17.72, -57.42, WK), insar: 'cumulative',
    init, compute, metrics, anchors, illum: null,
    get roi() { return roi; },
    sky(t: number): Sky {
      const y = Math.floor(t), fr = t - y;
      const wet = 0.5 + 0.5 * Math.cos(TAU * (fr - 0.08));
      const fire = Math.exp(-Math.pow((fr - 0.7) / 0.09, 2));
      const dry = 1.35 - (AMP[y] || 0.8);
      return { cover: 0.34 + 0.5 * wet + 0.08 * Math.sin(t * 7.7), smoke: sat(fire * dry), light: 1 };
    },
    kpi(t: number): Kpi[] {
      return [
        { k: 'River stage', v: fmt(stage(t), 1) + ' m' },
        { k: 'Flood-pulse strength', v: Math.round((AMP[Math.floor(t)] || 0.8) * 100) + ' % of 2023' },
      ];
    },
  };
}

/* ====================================================================== *
 * III. EAST ANATOLIAN FAULT — co-seismic rupture and a subsiding basin
 * ====================================================================== */
function fault(): Scene {
  const WK = 60, pxKm = WK / W, pxArea = pxKm * pxKm;
  const TEQ = 2023 + 37 / 365;                     // 6 February 2023
  let z: Float32Array, tex: Float32Array, illum: Float32Array, PL: Float32Array, ST: Float32Array, K0: Uint8Array,
    DMG: Float32Array, CH: Float32Array, VEG: Float32Array, Bint: Float32Array, Bco: Float32Array, Bpost: Float32Array,
    Bb1: Float32Array, Bb2: Float32Array, XQ: Float32Array;
  const anchors: Record<string, [number, number]> = {};
  let roi: Roi = { x0: 0, y0: 0, x1: 1, y1: 1 };
  let bowlI = 0;

  function init() {
    const n1 = fbmField(W, H, 41, 3, { oct: 4 });
    const n2 = fbmField(W, H, 42, 10, { oct: 3 });
    tex = fbmField(W, H, 43, 46, { oct: 2 });
    const zr = fbmField(W, H, 44, 5, { oct: 5, ridged: true });
    const nd = fbmField(W, H, 45, 26, { oct: 2 });
    z = new Float32Array(N); illum = new Float32Array(N).fill(1); PL = new Float32Array(N);
    ST = new Float32Array(N); K0 = new Uint8Array(N); DMG = new Float32Array(N); CH = new Float32Array(N);
    VEG = new Float32Array(N); Bint = new Float32Array(N); Bco = new Float32Array(N); Bpost = new Float32Array(N);
    Bb1 = new Float32Array(N); Bb2 = new Float32Array(N); XQ = new Float32Array(N);

    const ax = 0.05 * W, ay = 0.94 * H, bx = 0.95 * W, by = 0.1 * H;
    const len = Math.hypot(bx - ax, by - ay), dxn = (bx - ax) / len, dyn = (by - ay) / len;
    const onFault = (a: number, off: number): [number, number] => {                  // a: 0..1 along strike, off: km to the NW (+)
      const s = a * len, bend = 6 * Math.sin(Math.PI * a * 1.5);
      return [ax + dxn * s + dyn * (off / pxKm + bend), ay + dyn * s - dxn * (off / pxKm + bend)];
    };
    const city: [number, number] = [0.27 * W, 0.3 * H];
    const towns = [
      { c: city, r: 4.6, dmg: 0.5, thr: 0.6 },
      { c: onFault(0.52, -3.2), r: 2.3, dmg: 0.95, thr: 0.38 },
      { c: onFault(0.2, 2.0), r: 1.5, dmg: 0.95, thr: 0.34 },
      { c: onFault(0.8, 2.6), r: 1.6, dmg: 0.8, thr: 0.45 },
    ];
    const lakeC = onFault(0.86, -0.9);
    const bowl: [number, number] = [city[0] + 20, city[1] + 16];
    const basin2 = onFault(0.55, -6.5);
    const gc = Math.cos(0.5), gs = Math.sin(0.5);

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const rx = x - ax, ry = y - ay;
        const a = (rx * dxn + ry * dyn) / len;
        const dp = (rx * dyn - ry * dxn) - 6 * Math.sin(Math.PI * a * 1.5); // px, + = NW side
        const dk = Math.abs(dp) * pxKm, sgn = dp >= 0 ? 1 : -1;

        // plains: the city basin, a fault-parallel basin and the fault valley itself
        const wob = 0.85 * (n1[i] - 0.5) + 0.4 * (n2[i] - 0.5);
        const e1 = Math.hypot((x - city[0] - 8) / (11.5 / pxKm), (y - city[1] - 14) / (8 / pxKm)) + wob;
        const fx2 = x - basin2[0], fy2 = y - basin2[1];
        const e2 = Math.hypot((fx2 * dxn + fy2 * dyn) / (13 / pxKm), (fx2 * dyn - fy2 * dxn) / (5 / pxKm)) + wob;
        const vw = 0.9 + 2.2 * n1[i];
        const valley = Math.exp(-(dk / vw) * (dk / vw));
        const pl = Math.max(smooth(1.1, 0.8, e1), smooth(1.1, 0.8, e2), valley * 0.85);
        PL[i] = pl;
        z[i] = (Math.pow(zr[i], 1.15) * (0.45 + 0.75 * n1[i]) + 0.05 * n2[i]) * (1 - 0.93 * pl);

        // towns
        for (let k = 0; k < towns.length; k++) {
          const tn = towns[k];
          const rr = Math.hypot(x - tn.c[0], y - tn.c[1]) * pxKm;
          const edge = tn.r * (0.5 + 0.65 * n2[i] + 0.35 * nd[i]);
          if (rr < edge) {
            const hb = hash2(x >> 2, y >> 2, 51 + k), hf = hash2(x, y, 53);
            K0[i] = 7;
            ST[i] = hb < 0.1 ? 0.2 : 1.3 + 2.6 * hb * hb + 0.7 * hf;
            DMG[i] = sat((nd[i] - tn.thr) / 0.1) * tn.dmg;
            PL[i] = 1;
          }
        }
        // fault-zone lake
        const lx = x - lakeC[0], ly = y - lakeC[1];
        if (Math.hypot((lx * dxn + ly * dyn) / 17, (lx * dyn - ly * dxn) / 6) + 0.25 * (n2[i] - 0.5) < 1) K0[i] = 30;

        // field mosaic
        const gx = x * gc + y * gs, gy = -x * gs + y * gc;
        CH[i] = hash2(Math.floor(gx / 7), Math.floor(gy / 5), 61);
        VEG[i] = (0.15 + 0.5 * n2[i]) * (1 - smooth(0.5, 0.85, z[i]));

        // line-of-sight displacement basis (cm)
        const slip = 0.72 + 0.28 * Math.cos((a - 0.45) * 3.2);
        const v = y / H;
        Bco[i] = -sgn * 150 * (2 / Math.PI) * Math.atan(9 / (dk + 0.05)) * slip - 30 * Math.pow(1 - v, 1.5);
        Bint[i] = -sgn * 0.42 * (2 / Math.PI) * Math.atan(dk / 12);
        Bpost[i] = -sgn * 16 * (2 / Math.PI) * Math.atan(4 / (dk + 0.05)) * slip;
        const r1 = Math.hypot(x - bowl[0], y - bowl[1]) * pxKm;
        Bb1[i] = Math.exp(-(r1 * r1) / (2 * 3.0 * 3.0));
        const q1 = (fx2 * dxn + fy2 * dyn) * pxKm, q2 = (fx2 * dyn - fy2 * dxn) * pxKm;
        Bb2[i] = Math.exp(-(q1 * q1) / (2 * 7 * 7) - (q2 * q2) / (2 * 3.2 * 3.2));
        XQ[i] = Math.max(Math.exp(-(dk / 1.1) * (dk / 1.1)) * 0.95, DMG[i] * 0.9);
      }
    }
    // radar looks from the west: slopes rising eastward face the antenna
    for (let y = 0; y < H; y++) {
      for (let x = 1; x < W - 1; x++) {
        const i = y * W + x;
        illum[i] = Math.max(0.3, Math.min(2.6, 1 + 42 * (z[i + 1] - z[i - 1])));
      }
    }
    bowlI = snap(bowl[1]) * W + snap(bowl[0]);
    const t2 = towns[1].c;
    roi = { x0: Math.round(t2[0] - 24), y0: Math.round(t2[1] - 20), x1: Math.round(t2[0] + 24), y1: Math.round(t2[1] + 20) };
    anchors.city = [bowl[0] / W, bowl[1] / H];
    const rp = onFault(0.4, 0);
    anchors.rupture = [rp[0] / W, rp[1] / H];
    anchors.town = [t2[0] / W, t2[1] / H];
    anchors.lake = [lakeC[0] / W, lakeC[1] / H];
    anchors.basin = [basin2[0] / W, basin2[1] / H];
  }

  function compute(t: number, S: SceneState, optical: boolean, st: number): void {
    const yrs = t - 2020, fr = t - Math.floor(t);
    const co = t >= TEQ ? 1 : 0;
    const post = co ? Math.log(1 + (t - TEQ) / 0.2) / Math.log(1 + 3.57 / 0.2) : 0;
    const rec = co ? smooth(2024.0, 2026.6, t) * 0.55 : 0;
    const season = Math.sin(TAU * (fr - 0.3)) - Math.sin(TAU * -0.3);   // zero in January 2020
    const bowl1 = -5.2 * yrs + 0.9 * season, bowl2 = -2.6 * yrs + 1.4 * season;
    const wetS = 0.5 + 0.5 * Math.cos(TAU * (fr - 0.06));
    const gW = Math.exp(-Math.pow((fr - 0.34) / 0.11, 2));        // winter cereals
    const gS = Math.exp(-Math.pow((fr - 0.63) / 0.1, 2));         // irrigated summer crops
    const stubble = smooth(0.46, 0.52, fr) * (1 - smooth(0.74, 0.82, fr));
    const snowline = 0.42 + 0.75 * (1 - wetS);
    const R = S.R, E = S.E, V = S.V, D = S.D, C = S.C, P = S.P, X = S.X, K = S.K, O = S.O;
    for (let y = 0; y < H; y += st) {
      for (let x = 0; x < W; x += st) {
        const i = y * W + x, k0 = K0[i], tx = tex[i];
        let r = 0, e = 0, vg = 0, d = 0, c = 0, k = 0, cr = 0, cg = 0, cb = 0;
        if (k0 === 30) {
          k = 0; r = 0.04 + 0.03 * tx; e = 80; c = 0.03;
          if (optical) { cr = 38; cg = 84; cb = 122; }
        } else if (k0 === 7) {
          const eff = co * DMG[i] * (1 - rec), s = ST[i];
          d = s * (1 - 0.78 * eff); r = 0.2 + 0.4 * eff; e = 12; c = 0.93 - 0.3 * eff;
          k = eff > 0.4 ? 23 : 7;
          if (optical) {
            const g = s > 0.2 ? 132 + 22 * s : 96;
            cr = lerp(g + 4, 198, eff); cg = lerp(g, 186, eff); cb = lerp(g - 4, 168, eff);
          }
        } else if (PL[i] > 0.5) {
          const ch = CH[i];
          const g = ch < 0.45 ? gW : ch < 0.8 ? gS : 0.08;
          k = 12; vg = 0.05 + 0.42 * g; r = 0.3 + 0.35 * ((ch * 7.3) % 1);
          e = 7 + 10 * wetS + (ch >= 0.45 && ch < 0.8 ? 12 * g : 0); c = 0.85 - 0.3 * g;
          if (optical) {
            const gold = ch < 0.45 ? stubble : 0;
            const sr = 150 - 30 * ((ch * 3.7) % 1), sg = 124 - 22 * ((ch * 3.7) % 1), sb = 96 - 18 * ((ch * 3.7) % 1);
            cr = lerp(lerp(sr, 198, gold), 84, g); cg = lerp(lerp(sg, 174, gold), 140, g); cb = lerp(lerp(sb, 106, gold), 64, g);
          }
        } else {
          const vv = VEG[i];
          vg = vv * (0.9 + 0.15 * (1 - wetS)); r = 0.42 + 0.3 * tx; e = 5.5 + 5 * wetS; d = 0.1 * vv;
          c = 0.82 - 0.5 * vv; k = vv > 0.3 ? 19 : 10;
          if (optical) {
            const q = sat(vv * 1.5), sh = 0.55 + 0.45 * Math.min(1.6, illum[i]);
            const sn = smooth(snowline, snowline + 0.12, z[i] + 0.1 * tx);
            cr = lerp(lerp(146, 78, q) * sh, 238, sn); cg = lerp(lerp(130, 100, q) * sh, 242, sn); cb = lerp(lerp(112, 66, q) * sh, 246, sn);
          }
        }
        R[i] = r; E[i] = e; V[i] = vg; D[i] = d; C[i] = c; K[i] = k;
        P[i] = Bint[i] * yrs + co * Bco[i] + post * Bpost[i] + Bb1[i] * bowl1 + Bb2[i] * bowl2;
        X[i] = co * XQ[i];
        if (optical) { const j = i * 3; O[j] = cr; O[j + 1] = cg; O[j + 2] = cb; }
      }
    }
    S.t = t;
  }

  function metrics(S: SceneState, t: number, st: number): Metrics {
    const db = roiDb(S, illum, roi, st, (i) => K0[i] === 7);
    const damaged = countPx(st, (i) => S.K[i] === 23) * pxArea;
    return { b1: db.hh, b2: db.hv, a1: damaged, d1: S.P[bowlI] };
  }

  return {
    id: 'fault', W, H, widthKm: WK, bounds: boundsFor(37.42, 37.02, WK), insar: 'cumulative',
    init, compute, metrics, anchors, TEQ,
    get illum() { return illum; }, get roi() { return roi; },
    sky(t: number): Sky {
      const fr = t - Math.floor(t), winter = 0.5 + 0.5 * Math.cos(TAU * (fr - 0.06));
      return { cover: 0.28 + 0.52 * winter + 0.08 * Math.sin(t * 8.3), smoke: 0, light: 1 };
    },
    kpi(t: number): Kpi[] {
      const co = t >= TEQ;
      return [
        { k: 'Rupture offset (LOS)', v: co ? '≈ 3.0 m across fault' : 'locked · loading' },
        { k: 'Basin subsidence rate', v: '5.2 cm / yr' },
      ];
    },
  };
}

/* ====================================================================== *
 * IV. JAKOBSHAVN ISBRÆ — calving front, melt season and the polar night
 * ====================================================================== */
function glacier(): Scene {
  const WK = 60, pxKm = WK / W, pxArea = pxKm * pxKm;
  let tex: Float32Array, n2: Float32Array, nc: Float32Array, flow: Float32Array, ZONE: Uint8Array, Q: Float32Array,
    TR: Float32Array, HWN: Float32Array, LAKE: Float32Array, POND: Float32Array, BERG: Float32Array, SPT: Float32Array,
    SPB: Float32Array, illum: Float32Array;
  const anchors: Record<string, [number, number]> = {};
  let roi: Roi = { x0: 0, y0: 0, x1: 1, y1: 1 };
  const MELT: Record<number, number> = { 2020: 0.9, 2021: 1.05, 2022: 0.85, 2023: 1.1, 2024: 0.9, 2025: 1.0, 2026: 1.05 };
  const vf = (u: number) => 0.52 + 0.045 * Math.sin(u * 4.2 + 0.8);
  const hw = (u: number) => 0.062 + 0.014 * Math.sin(u * 9);
  function front(t: number): number {                              // calving-front position (u) on the centreline
    const y = t - 2020, fr = t - Math.floor(t);
    return 0.5 + 0.008 * y - 0.013 * Math.cos(TAU * (fr - 0.25));
  }
  const meltSeason = (t: number) => {
    const fr = t - Math.floor(t);
    return Math.exp(-Math.pow((fr - 0.54) / 0.085, 2)) * (MELT[Math.floor(t)] || 1);
  };
  const vmax = (t: number) => {
    const fr = t - Math.floor(t);
    return 23 + 1.0 * (t - 2020) + 7 * Math.exp(-Math.pow((fr - 0.58) / 0.12, 2));
  };
  function daylight(t: number): number {                           // 0 during the polar night at 69° N
    const fr = t - Math.floor(t);
    return smooth(0.93, 0.68, Math.cos(TAU * (fr - 0.97)));
  }
  function lowering(t: number): number {                           // ice-surface lowering near the front (m)
    const y = Math.floor(t), fr = t - y;
    let s = 0;
    for (let k = 2020; k < y; k++) s += MELT[k] || 1;
    s += (MELT[y] || 1) * smooth(0.42, 0.68, fr);
    return -(4.2 * s + 1.5 * (t - 2020));
  }

  function init() {
    const n1 = fbmField(W, H, 61, 3, { oct: 4 });
    n2 = fbmField(W, H, 62, 9, { oct: 4 });
    tex = fbmField(W, H, 63, 50, { oct: 2 });
    nc = fbmField(W, H, 64, 22, { oct: 3 });
    flow = fbmField(W, H, 65, 3, { oct: 4, aspect: 26 * (H / W) });
    const nr = fbmField(W, H, 66, 7, { oct: 4, ridged: true });
    ZONE = new Uint8Array(N); Q = new Float32Array(N); TR = new Float32Array(N); HWN = new Float32Array(N);
    LAKE = new Float32Array(N); POND = new Float32Array(N); BERG = new Float32Array(N);
    SPT = new Float32Array(N); SPB = new Float32Array(N); illum = new Float32Array(N).fill(1);
    for (let y = 0; y < H; y++) {
      const v = y / H;
      for (let x = 0; x < W; x++) {
        const i = y * W + x, u = x / W;
        const c = vf(u) + 0.035 * (n1[i] - 0.5), w = hw(u) * (0.72 + 0.62 * n2[i]);
        const off = (v - c) / w;                       // ±1 at the fjord walls
        const inFjord = Math.abs(off) < 1;
        const margin = u - (0.46 + 0.17 * (n1[i] - 0.5) + 0.07 * (n2[i] - 0.5) + 0.07 * sat(Math.abs(v - c) * 2.2));
        const bay = u < 0.03 + 0.2 * n1[i] * (0.55 + 0.9 * n2[i]);   // ragged coast with skerries
        HWN[i] = off;
        Q[i] = sat(margin / 0.5 + 0.1 * (n1[i] - 0.5) + 0.05 * (n2[i] - 0.5));
        // zone: 1 bay, 2 fjord trough, 3 rock, 4 ice sheet
        ZONE[i] = inFjord && u < 0.66 ? 2 : bay ? 1 : margin < 0 ? 3 : 4;
        TR[i] = Math.exp(-2.0 * off * off) * smooth(0.98, 0.56, u);
        LAKE[i] = smooth(0.82, 0.86, nc[i]) * (n1[i] > 0.35 ? 1 : 0);
        POND[i] = nc[i] * 0.6 + n2[i] * 0.4;
        BERG[i] = hash2(x >> 1, y >> 1, 77);
        // flow speed basis: fast trunk through the trough, slow sheet flow converging on it
        SPT[i] = Math.exp(-1.6 * off * off) * Math.exp(-Math.max(0, u - 0.5) / 0.2);
        SPB[i] = 0.04 + 0.5 * Math.exp(-Math.abs(v - c) / 0.25) * Math.exp(-Math.max(0, u - 0.5) / 0.45);
        // rock: relief shading · ice: percolation-facies gain (buried ice lenses scatter strongly)
        illum[i] = ZONE[i] === 3 ? 0.55 + 0.9 * nr[i] : ZONE[i] === 4 || ZONE[i] === 2 ? 1 + 1.4 * smooth(0.2, 0.45, Q[i]) : 1;
      }
    }
    roi = { x0: Math.round(0.7 * W), y0: Math.round(0.14 * H), x1: Math.round(0.8 * W), y1: Math.round(0.3 * H) };
    anchors.front = [0.515, vf(0.515)];
    anchors.melange = [0.3, vf(0.3)];
    anchors.town = [0.125, vf(0.125) - hw(0.125) - 0.05];
    anchors.melt = [0.75, 0.22];
    anchors.trunk = [0.64, vf(0.64)];
    anchors.sheet = [0.86, 0.8];
  }

  function compute(t: number, S: SceneState, optical: boolean, st: number): void {
    const fr = t - Math.floor(t);
    const ucf = front(t), ms = meltSeason(t), vm = vmax(t);
    const qm = 0.72 * Math.pow(ms, 0.7);
    const summer = Math.exp(-Math.pow((fr - 0.56) / 0.14, 2));
    const seaIce = smooth(0.92, 0.99, fr) + (1 - smooth(0.36, 0.46, fr));   // Dec → May
    const mel = 1 - 0.5 * summer;                                           // mélange rigidity
    const melEnd = lerp(0.3, 0.1, sat(seaIce));
    const wind = 0.5 + 0.5 * Math.sin(t * 29.3);
    const R = S.R, E = S.E, V = S.V, D = S.D, C = S.C, P = S.P, X = S.X, K = S.K, O = S.O;
    for (let y = 0; y < H; y += st) {
      for (let x = 0; x < W; x += st) {
        const i = y * W + x, u = x / W, tx = tex[i];
        let zone = ZONE[i];
        let r = 0, e = 0, vg = 0, d = 0, c = 0, p = 0, xx = 0, k = 0, cr = 0, cg = 0, cb = 0;
        if (zone === 2) {
          const off = HWN[i];
          if (u >= ucf + 0.02 * (1 - off * off)) zone = 5;      // glacier trunk behind the front
        }
        if (zone === 1 || zone === 2) {
          // a seam of open water and fresh bergs marks the calving front in every season
          const seam = zone === 2 && ucf + 0.02 * (1 - HWN[i] * HWN[i]) - u < 0.011;
          const packed = zone === 2 && !seam && u > melEnd && nc[i] > 1 - mel;
          const berg = BERG[i] > (seam ? 0.8 : zone === 2 ? 0.93 : 0.985);
          if (packed || berg) {
            k = 11; r = 0.6 + 0.4 * tx; e = 3.5; vg = 0.2 + 0.75 * nc[i]; d = berg && !packed ? 2.2 : 0.3 + 0.7 * nc[i]; c = 0.1; xx = 1;
            if (optical) { const g = 196 + 50 * tx; cr = g; cg = g + 4; cb = g + 8; }
          } else if (seaIce > 0.5 && !seam) {
            k = 22; r = 0.3 + 0.3 * tx; e = 4; vg = 0.15; c = 0.3;
            if (optical) { const g = 190 + 30 * n2[i]; cr = g; cg = g + 8; cb = g + 16; }
          } else {
            k = 0; r = 0.05 + 0.04 * wind * tx + 0.02 * tx; e = 80; c = 0.03;
            if (optical) { cr = 14; cg = 32; cb = 56; }
          }
        } else if (zone === 3) {
          if (LAKE[i] > 0.5) {
            if (summer > 0.35) { k = 0; r = 0.04; e = 80; c = 0.03; if (optical) { cr = 26; cg = 54; cb = 78; } }
            else { k = 22; r = 0.2; e = 3.2; vg = 0.2; c = 0.6; if (optical) { cr = 214; cg = 224; cb = 234; } }
          } else {
            k = 10; r = 0.5 + 0.3 * tx; e = 5 + 3 * summer; vg = 0.08 + 0.1 * summer * n2[i]; c = 0.9 - 0.12 * summer;
            if (optical) {
              const sn = 1 - smooth(0.2, 0.6, summer + 0.25 * (n2[i] - 0.5)), g = 0.55 + 0.5 * illum[i];
              cr = lerp(98 * g, 230, sn); cg = lerp(90 * g, 234, sn); cb = lerp(76 * g, 240, sn);
            }
          }
        } else {
          // ice: bare-ice ablation zone and percolation zone, with the crevassed trunk blended on top
          const q = Q[i], trk = zone === 5 ? Math.max(TR[i], 0.2) : TR[i];
          const wet = sat((qm - q) / 0.08 + 0.4 * (n2[i] - 0.5)) * (ms > 0.04 ? 1 : 0);
          const bare = 1 - smooth(0.16, 0.3, q);
          if (trk < 0.2 && wet > 0.3 && POND[i] > 0.74 && q > 0.1 && q < 0.5 && ms > 0.35) {
            k = 21; r = 0.03; e = 80; c = 0.03;
            if (optical) { cr = 44; cg = 128; cb = 198; }
          } else {
            const dryV = lerp(0.95, 0.3, bare), dryR = lerp(0.3, 0.5 + 0.3 * tx, bare);
            vg = dryV * (1 - 0.95 * wet); r = lerp(dryR, 0.12, wet); e = lerp(bare > 0.5 ? 3.2 : 1.9, 5.5, wet);
            c = lerp(0.85, 0.1, wet);
            k = wet > 0.5 ? 9 : bare > 0.5 ? 20 : 8;
            if (optical) {
              const sm = wet * bare;
              cr = lerp(240, 172, sm) - 22 * wet * (1 - bare) - 8 * tx; cg = lerp(243, 196, sm) - 14 * wet * (1 - bare) - 6 * tx;
              cb = lerp(247, 214, sm) - 6 * wet * (1 - bare);
            }
            if (trk > 0.2) {
              const a = smooth(0.2, 0.55, trk), f = flow[i];
              r = lerp(r, 0.55 + 0.45 * f, a); vg = lerp(vg, (0.35 + 0.5 * f) * (1 - 0.6 * wet), a);
              e = lerp(e, 3.2, a); d = 0.4 * f * a; c = lerp(c, 0.2, a);
              if (a > 0.5) k = 24;
              if (optical) { const g = 190 + 56 * f - 20 * wet; cr = lerp(cr, g - 8, a); cg = lerp(cg, g, a); cb = lerp(cb, g + 6, a); }
            }
          }
          const sp = vm * SPT[i] * (u >= ucf ? 1 : 0.9) + SPB[i] * (1 + 0.3 * summer);
          p = sp * 12 * 100 * 0.25;                       // 12-day line-of-sight motion (cm)
          xx = smooth(0.6, 1.6, sp);
        }
        R[i] = r; E[i] = e; V[i] = vg; D[i] = d; C[i] = c; P[i] = p; X[i] = xx; K[i] = k;
        if (optical) { const j = i * 3; O[j] = cr; O[j + 1] = cg; O[j + 2] = cb; }
      }
    }
    S.t = t;
  }

  function glacierArea(S: SceneState, st: number): number {
    const x0 = Math.round(0.4 * W), x1 = Math.round(0.72 * W);
    let n = 0;
    for (let y = 0; y < H; y += st) for (let x = x0; x < x1; x += st) {
      const i = y * W + x;
      if (ZONE[i] === 2 && S.K[i] === 24) n++;
    }
    return n * st * st * pxArea;
  }
  let area0: number | null = null;

  function metrics(S: SceneState, t: number, st: number): Metrics {
    const db = roiDb(S, illum, roi, st, null);
    if (area0 == null) {
      const S0 = makeState();
      compute(2020, S0, false, st);
      area0 = glacierArea(S0, st);
    }
    return { b1: db.hh, b2: db.hv, a1: glacierArea(S, st) - area0, d1: lowering(t) };
  }

  return {
    id: 'glacier', W, H, widthKm: WK, bounds: boundsFor(69.17, -49.75, WK), insar: 'repeat12',
    init, compute, metrics, anchors,
    get illum() { return illum; }, get roi() { return roi; },
    sky(t: number): Sky {
      return { cover: 0.56 + 0.14 * Math.sin(t * 6.9) + 0.06 * Math.sin(t * 17.3), smoke: 0, light: daylight(t) };
    },
    kpi(t: number): Kpi[] {
      return [
        { k: 'Peak flow speed', v: fmt(vmax(t), 0) + ' m / day' },
        { k: 'Daylight', v: daylight(t) < 0.05 ? 'polar night' : daylight(t) < 0.95 ? 'twilight' : 'sunlit' },
      ];
    },
  };
}

/* ---------------------------------------------------------------------- */
const factories: Record<SceneId, () => Scene> = { caspian, pantanal, fault, glacier };
const cache: Partial<Record<SceneId, Scene>> = {};

/** Build (once) and return a scene. The first call for a scene takes a few hundred milliseconds. */
export function getScene(id: SceneId): Scene {
  let s = cache[id];
  if (!s) {
    s = factories[id]();
    s.init();
    cache[id] = s;
  }
  return s;
}
export const isSceneReady = (id: SceneId): boolean => !!cache[id];

/** Monthly metric series for the timeline, sampled on a coarse grid of the scene itself. */
export function buildSeries(scene: Scene): Series {
  if (scene.series) return scene.series;
  const S = makeState(), st = 3, n = M_MAX + 1;
  const out: Series = { b1: [], b2: [], a1: [], a2: [], d1: [] };
  const jit = rng(scene.id.length * 977 + 5);
  for (let m = 0; m < n; m++) {
    const t = monthToYear(m);
    scene.compute(t, S, false, st);
    const r = scene.metrics(S, t, st);
    out.b1.push(r.b1 + (jit() - 0.5) * 0.5);
    out.b2.push(r.b2 + (jit() - 0.5) * 0.5);
    out.a1.push(r.a1);
    out.a2.push(r.a2 == null ? null : r.a2);
    out.d1.push(r.d1 + (m ? (jit() - 0.5) * 0.4 : 0));
  }
  scene.series = out;
  return out;
}
