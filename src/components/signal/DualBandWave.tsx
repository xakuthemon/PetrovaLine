/*
 * Dual-band wave visualisation: the 24 cm L-band wave (cyan) and the 9.4 cm S-band
 * wave (magenta), drawn at their true wavelength ratio, meeting one kind of surface.
 */
import { useEffect, useRef } from 'react';
import { reducedMotion } from '../../engine/util';

export type WaveVariant = 'water' | 'forest' | 'fault' | 'ice';

const L = '#00F0FF', S = '#FF2A85', GOLD = '#F5B041', INK = '#F4FBFF';
type Pt = [number, number];

/** A sine wave travelling along a straight segment, fading from a0 to a1. */
function wave(ctx: CanvasRenderingContext2D, a: Pt, b: Pt, lambda: number, amp: number, phase: number, color: string, a0: number, a1: number, width = 1.6): void {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
  if (len < 2) return;
  const ux = dx / len, uy = dy / len, nx = -uy, ny = ux, chunks = 8;
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let c = 0; c < chunks; c++) {
    const s0 = (len * c) / chunks, s1 = (len * (c + 1)) / chunks;
    ctx.globalAlpha = a0 + (a1 - a0) * ((c + 0.5) / chunks);
    ctx.beginPath();
    for (let s = s0; s <= s1 + 0.01; s += 2) {
      const o = amp * Math.sin(Math.PI * 2 * (s / lambda - phase)) * Math.min(1, s / 14, (len - s) / 14);
      const x = a[0] + ux * s + nx * o, y = a[1] + uy * s + ny * o;
      if (s === s0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = INK, align: CanvasTextAlign = 'left'): void {
  ctx.font = '500 10px "JetBrains Mono Variable", "JetBrains Mono", ui-monospace, monospace';
  ctx.textAlign = align; ctx.fillStyle = color; ctx.globalAlpha = 0.85;
  ctx.fillText(text.toUpperCase(), x, y);
  ctx.globalAlpha = 1;
}

function draw(ctx: CanvasRenderingContext2D, v: WaveVariant, w: number, h: number, t: number): void {
  ctx.clearRect(0, 0, w, h);
  const LL = Math.max(34, w * 0.085), SL = LL * (9.4 / 24), LA = LL * 0.19, SA = LA * 0.62;
  const pL = t * 0.42, pS = t * 0.42 * (24 / 9.4) * 0.55;
  const src: Pt = [w * 0.06, h * 0.05];
  const line = (a: Pt, b: Pt, color: string, alpha: number, lw = 1, dash?: number[]) => {
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash || []);
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  };

  if (v === 'water') {
    const gy = h * 0.7, shore = w * 0.56;
    ctx.fillStyle = 'rgba(0,240,255,0.07)'; ctx.fillRect(0, gy, shore, h - gy);
    line([0, gy], [shore, gy], INK, 0.7, 1.2);
    ctx.strokeStyle = GOLD; ctx.globalAlpha = 0.8; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(shore, gy);
    for (let x = shore; x <= w; x += 6) ctx.lineTo(x, gy - 3 - 5 * Math.abs(Math.sin(x * 0.21)) - 3 * Math.sin(x * 0.07));
    ctx.stroke(); ctx.globalAlpha = 1;
    const hit: Pt = [w * 0.3, gy], out: Pt = [w * 0.56, h * 0.04];
    wave(ctx, src, hit, LL, LA, pL, L, 0.95, 0.95);
    wave(ctx, [src[0] + 26, src[1]], [hit[0] + 26, gy], SL, SA, pS, S, 0.95, 0.95);
    wave(ctx, hit, out, LL, LA, pL, L, 0.9, 0.5);
    wave(ctx, [hit[0] + 26, gy], [out[0] + 26, out[1]], SL, SA, pS, S, 0.9, 0.5);
    const bed: Pt = [w * 0.78, gy - 6], from: Pt = [w * 0.5, h * 0.05];
    wave(ctx, from, bed, LL, LA, pL, L, 0.9, 0.9);
    wave(ctx, [bed[0] - 16, bed[1] - 10], [from[0] - 16, from[1] + 12], LL, LA * 0.7, -pL, GOLD, 0.85, 0.35);
    for (let k = 0; k < 5; k++) { const a = -Math.PI * (0.15 + 0.17 * k); line(bed, [bed[0] + Math.cos(a) * 30, bed[1] + Math.sin(a) * 30], INK, 0.3, 1); }
    label(ctx, 'calm water · mirrored away', w * 0.04, gy + 20, L);
    label(ctx, 'exposed bed · echo returns', w * 0.96, gy + 20, GOLD, 'right');
  } else if (v === 'forest') {
    const gy = h * 0.82;
    ctx.fillStyle = 'rgba(0,240,255,0.09)'; ctx.fillRect(0, gy, w, h - gy);
    line([0, gy], [w, gy], INK, 0.7, 1.2);
    const trunks = [0.34, 0.5, 0.66, 0.82];
    trunks.forEach((q) => line([w * q, gy], [w * q, h * 0.42], INK, 0.55, 2.4));
    ctx.fillStyle = 'rgba(16,185,129,0.16)'; ctx.strokeStyle = 'rgba(16,185,129,0.6)'; ctx.lineWidth = 1;
    [[0.3, 0.34, 0.11], [0.46, 0.3, 0.13], [0.62, 0.35, 0.12], [0.78, 0.31, 0.13], [0.9, 0.37, 0.1]].forEach(([x, y, r]) => {
      ctx.beginPath(); ctx.ellipse(w * x, h * y, w * r, h * 0.11, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    // S-band: stopped in the canopy
    const sHit: Pt = [w * 0.44, h * 0.3];
    wave(ctx, [src[0] + 30, src[1]], sHit, SL, SA, pS, S, 0.95, 0.95);
    wave(ctx, [sHit[0] - 10, sHit[1] - 12], [src[0] + 60, src[1] + 6], SL, SA * 0.7, -pS, S, 0.6, 0.15);
    ctx.fillStyle = S; for (let k = 0; k < 7; k++) { ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(t * 2 + k)); ctx.beginPath(); ctx.arc(sHit[0] + ((k * 37) % 60) - 20, sHit[1] + ((k * 23) % 30) - 8, 1.8, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // L-band: through the canopy, water, trunk, home
    const g: Pt = [w * 0.585, gy], tr: Pt = [w * 0.66, h * 0.66], inL: Pt = [w * 0.16, h * 0.04];
    wave(ctx, inL, g, LL, LA, pL, L, 0.95, 0.9);
    wave(ctx, g, tr, LL, LA * 0.5, pL, GOLD, 0.95, 0.95);
    wave(ctx, tr, [inL[0] + (tr[0] - g[0]) + 12, inL[1] + 14], LL, LA, -pL, GOLD, 0.95, 0.4);
    label(ctx, 'S 9.4 cm · scatters in the canopy', w * 0.04, h * 0.5, S);
    label(ctx, 'L 24 cm · water → trunk → home', w * 0.96, gy + 18, GOLD, 'right');
  } else if (v === 'fault') {
    const gy = h * 0.5, fx = w * 0.5, d = 0.5 - 0.5 * Math.cos(t * 0.5), shift = d * 16, cm = d * 34;
    ctx.fillStyle = 'rgba(244,251,255,0.05)';
    ctx.fillRect(0, gy, fx, h * 0.14); ctx.fillRect(fx, gy + shift, w - fx, h * 0.14);
    line([0, gy], [fx, gy], INK, 0.8, 1.3); line([fx, gy + shift], [w, gy + shift], INK, 0.8, 1.3);
    line([fx, gy - 14], [fx, gy + h * 0.14 + shift], GOLD, 0.9, 1.4, [4, 3]);
    wave(ctx, src, [w * 0.24, gy], LL, LA, pL, L, 0.9, 0.9);
    wave(ctx, [w * 0.24 + 22, gy], [src[0] + 22, src[1]], LL, LA, -pL, L, 0.6, 0.2);
    wave(ctx, [w * 0.44, h * 0.05], [w * 0.74, gy + shift], LL, LA, pL, L, 0.9, 0.9);
    wave(ctx, [w * 0.74 + 22, gy + shift], [w * 0.44 + 22, h * 0.05], LL, LA, -pL + cm / 11.9, GOLD, 0.8, 0.25);
    // fringe rulers
    const ruler = (y: number, per: number, color: string, name: string) => {
      const x0 = w * 0.06, x1 = w * 0.94, n = cm / per;
      for (let x = x0; x < x1; x += 2) {
        const ph = (((x - x0) / (x1 - x0)) * n) % 1;
        ctx.fillStyle = `hsl(${(180 + ph * 360) % 360} 90% 58%)`; ctx.globalAlpha = 0.85; ctx.fillRect(x, y, 2, 12);
      }
      ctx.globalAlpha = 1;
      label(ctx, name + ' · ' + n.toFixed(1) + ' fringes', x0, y - 6, color);
      label(ctx, 'one fringe = ' + per + ' cm', x1, y - 6, INK, 'right');
    };
    ruler(h * 0.76, 11.9, L, 'L-band');
    ruler(h * 0.9, 4.7, S, 'S-band');
    label(ctx, 'ground moved ' + cm.toFixed(0) + ' cm along the line of sight', w * 0.5, h * 0.045, GOLD, 'center');
  } else {
    const top = h * 0.46, bot = h * 0.76, melt = 0.5 - 0.5 * Math.cos(t * 0.45);
    ctx.fillStyle = `rgba(${Math.round(244 - 150 * melt)},${Math.round(251 - 60 * melt)},255,${0.16 + 0.1 * melt})`; ctx.fillRect(0, top, w, bot - top);
    ctx.fillStyle = 'rgba(0,240,255,0.06)'; ctx.fillRect(0, bot, w, h - bot);
    line([0, top], [w, top], INK, 0.8, 1.3); line([0, bot], [w, bot], INK, 0.4, 1);
    for (let k = 0; k < 9; k++) { const x = w * (0.08 + 0.1 * k), y = top + (bot - top) * (0.3 + 0.5 * ((k * 0.37) % 1)); line([x, y], [x + w * 0.05, y + 2], INK, 0.3 * (1 - melt), 1.5); }
    const hit: Pt = [w * 0.4, top], deep = 1 - melt;
    wave(ctx, src, hit, LL, LA, pL, L, 0.95, 0.95);
    wave(ctx, [src[0] + 28, src[1]], [hit[0] + 28, top], SL, SA, pS, S, 0.95, 0.95);
    wave(ctx, hit, [hit[0] + (bot - top) * 0.45 * deep, top + (bot - top) * 0.95 * deep], LL * 0.8, LA * 0.8, pL, L, 0.9 * deep, 0.2 * deep);
    wave(ctx, [hit[0] + 28, top], [hit[0] + 28 + (bot - top) * 0.2 * deep, top + (bot - top) * 0.45 * deep], SL * 0.8, SA * 0.8, pS, S, 0.9 * deep, 0.15 * deep);
    wave(ctx, [hit[0] - 14, top - 6], [src[0] - 2, src[1] + 22], LL, LA * (0.25 + 0.75 * deep), -pL, GOLD, 0.25 + 0.7 * deep, 0.1 + 0.3 * deep);
    label(ctx, melt > 0.5 ? 'melting snow · absorbed, dark' : 'dry firn · pulse enters, bright return', w * 0.96, top - 12, melt > 0.5 ? S : GOLD, 'right');
    label(ctx, 'snowpack', w * 0.04, top + 16); label(ctx, 'glacier ice', w * 0.04, bot + 16);
  }
}

export function DualBandWave({ variant }: { variant: WaveVariant }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    let w = 1, h = 1, raf = 0, visible = false, t0 = performance.now();
    const still = reducedMotion();
    const paint = (now: number) => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw(ctx, variant, w, h, still ? 3.4 : (now - t0) / 1000);
    };
    const loop = (now: number) => { raf = 0; if (!visible) return; paint(now); if (!still) raf = requestAnimationFrame(loop); };
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      paint(performance.now());
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }, { threshold: 0.05 });
    io.observe(canvas);
    resize();
    return () => { ro.disconnect(); io.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [variant]);
  return <canvas ref={ref} className="h-full w-full" role="img" aria-label={'Animated diagram: L-band and S-band waves meeting ' + variant} />;
}
