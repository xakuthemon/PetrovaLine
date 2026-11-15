#!/usr/bin/env node
/*
 * Builds the app icons from the logo geometry: public/icon.svg (favicon) and PNGs for
 * the web app manifest and iOS. Run after changing the mark: node tools/make-icons.mjs
 * (needs Playwright's Chromium to rasterise).
 */
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// same geometry as src/brand/Logo.tsx
const BIG = { x: 464, y: 1097, r: 262 }, SMALL = { x: 1731, y: 1150, r: 67 };
const SEG = [
  [[464, 842], [464, 722], [522, 660], [682, 655]],
  [[682, 655], [1000, 655], [1400, 880], [1702, 1128]],
];
const at = (s, t) => { const u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; return [0, 1].map((k) => a * s[0][k] + b * s[1][k] + c * s[2][k] + d * s[3][k]); };
const tan = (s, t) => { const u = 1 - t; const v = [0, 1].map((k) => 3 * u * u * (s[1][k] - s[0][k]) + 6 * u * t * (s[2][k] - s[1][k]) + 3 * t * t * (s[3][k] - s[2][k])); const l = Math.hypot(v[0], v[1]); return [v[0] / l, v[1] / l]; };
function line(weight) {
  const pts = []; let len = 0, prev = null;
  SEG.forEach((s, k) => { for (let i = k ? 1 : 0; i <= 60; i++) { const t = i / 60, p = at(s, t), d = tan(s, t); if (prev) len += Math.hypot(p[0] - prev[0], p[1] - prev[1]); pts.push({ p, n: [-d[1], d[0]], s: len }); prev = p; } });
  const L = [], R = [];
  pts.forEach(({ p, n, s }) => { const w = (24 + 38 * Math.pow(s / len, 1.3)) * weight * 0.5; L.push((p[0] + n[0] * w).toFixed(1) + ' ' + (p[1] + n[1] * w).toFixed(1)); R.push((p[0] - n[0] * w).toFixed(1) + ' ' + (p[1] - n[1] * w).toFixed(1)); });
  return 'M' + L.join(' L') + ' L' + R.reverse().join(' L') + ' Z';
}
/** square icon: the mark centred on the ink ground; pad = share of the side left around the mark */
function icon(pad, weight, rounded) {
  const cx = 1000, cy = 1000, mw = 1660, side = mw / (1 - 2 * pad), x0 = cx - side / 2, y0 = cy - side / 2;
  const dy = 1000 - 995; // centre the mark's box (610..1390) vertically
  const r = rounded ? side * 0.22 : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x0.toFixed(0)} ${(y0 - dy).toFixed(0)} ${side.toFixed(0)} ${side.toFixed(0)}">` +
    `<rect x="${x0.toFixed(0)}" y="${(y0 - dy).toFixed(0)}" width="${side.toFixed(0)}" height="${side.toFixed(0)}" rx="${r.toFixed(0)}" fill="#171824"/>` +
    `<path d="${line(weight)}" fill="#D3243F"/>` +
    `<circle cx="${BIG.x}" cy="${BIG.y}" r="${BIG.r}" fill="#F4ECE3"/><circle cx="${SMALL.x}" cy="${SMALL.y}" r="${SMALL.r}" fill="#F4ECE3"/></svg>`;
}

writeFileSync(resolve(root, 'public/icon.svg'), icon(0.08, 1.8, true));
const sizes = [['icons/icon-192.png', 192, icon(0.1, 1.5, false)], ['icons/icon-512.png', 512, icon(0.1, 1.2, false)], ['icons/maskable-512.png', 512, icon(0.2, 1.3, false)], ['icons/apple-touch-icon.png', 180, icon(0.12, 1.5, false)], ['icons/favicon-32.png', 32, icon(0.04, 2.4, false)]];

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const b = await chromium.launch();
for (const [file, px, svg] of sizes) {
  const p = await b.newPage({ viewport: { width: px, height: px } });
  await p.setContent(`<html><body style="margin:0;background:#171824"><img style="display:block;width:${px}px;height:${px}px" src="data:image/svg+xml,${encodeURIComponent(svg)}"></body></html>`);
  await p.waitForTimeout(100);
  await p.screenshot({ path: resolve(root, 'public', file) });
  await p.close();
  console.log(file, px);
}
await b.close();
