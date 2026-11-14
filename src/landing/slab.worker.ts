/*
 * Off-main-thread renderer for the landing's terrain slabs: builds a simulated
 * scene, renders the "before" and "after" radar images and a relief map.
 */
import { getScene, makeState, buildSeries, W, H, N, type SceneId } from '../engine/scenes';
import * as R from '../engine/render';
import { caseById, valuesAt } from '../data/cases';
import { monthToYear } from '../engine/util';
import { SLIDES, type Place } from './film';

export interface SlabRequest { id: SceneId }
export interface SlabResult {
  id: SceneId;
  w: number; h: number;
  a: Uint8ClampedArray;
  b: Uint8ClampedArray;
  /** relief, 0..255, at (w / 4) × (h / 4) */
  relief: Uint8Array;
  figure: string;
}

const PAIRS = Object.fromEntries(SLIDES.filter((s) => s.place).map((s) => [s.place!.scene, s.place!])) as Record<SceneId, Place>;

function build(id: SceneId): SlabResult {
  const scene = getScene(id);
  const pair = PAIRS[id];
  const tA = monthToYear(pair.a), tB = monthToYear(pair.b);
  const SA = makeState(), SB = makeState();
  scene.compute(tA, SA, false, 1);
  scene.compute(tB, SB, false, 1);
  const a = new Uint8ClampedArray(N * 4), b = new Uint8ClampedArray(N * 4);
  const dbA = new Float32Array(N), dbB = new Float32Array(N);
  R.sar(scene, SA, 'HH', 'L', a, dbA);
  R.sar(scene, SB, 'HH', 'L', b, dbB);
  if (pair.insar) R.insar(scene, SA, SB, 'L', b, new Float32Array(N), tA, tB);

  // relief: backscatter of the "after" scene, averaged into 4 × 4 cells and smoothed
  const rw = W / 4, rh = Math.floor(H / 4), cell = new Float32Array(rw * rh);
  for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
    let s = 0;
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) s += dbB[(y * 4 + j) * W + x * 4 + i];
    cell[y * rw + x] = s / 16;
  }
  const blur = (src: Float32Array): Float32Array => {
    const out = new Float32Array(src.length), r = 3;
    for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) {
      let s = 0, n = 0;
      for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
        const xx = x + i, yy = y + j;
        if (xx < 0 || yy < 0 || xx >= rw || yy >= rh) continue;
        s += src[yy * rw + xx]; n++;
      }
      out[y * rw + x] = s / n;
    }
    return out;
  };
  const sm = blur(blur(cell));
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < sm.length; i++) { lo = Math.min(lo, sm[i]); hi = Math.max(hi, sm[i]); }
  const relief = new Uint8Array(rw * rh * 4);
  for (let i = 0; i < sm.length; i++) {
    const v = Math.round(((sm[i] - lo) / (hi - lo || 1)) * 255);
    relief[i * 4] = relief[i * 4 + 1] = relief[i * 4 + 2] = v; relief[i * 4 + 3] = 255;
  }

  const def = caseById(id);
  const figure = def.headline(valuesAt(buildSeries(scene), pair.b)).value;
  return { id, w: W, h: H, a, b, relief, figure };
}

self.onmessage = (ev: MessageEvent<SlabRequest>) => {
  const r = build(ev.data.id);
  (self as unknown as Worker).postMessage(r, [r.a.buffer, r.b.buffer, r.relief.buffer]);
};
