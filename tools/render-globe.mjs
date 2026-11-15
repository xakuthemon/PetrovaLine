#!/usr/bin/env node
/*
 * Renders the story's opening globe (the planet, its gold orbits, the satellites and NISAR)
 * on its own, centred and large, from the offline build, with the 4K Earth maps loaded:
 *   npm run build:single && node tools/render-globe.mjs
 * Writes submission/petrova-line-globe-4k.png (3840×2160) and
 * submission/petrova-line-globe-square.png (4096×4096). Needs Playwright's Chromium.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const page = pathToFileURL(resolve(root, 'release/petrova-line.html')).href;
const shots = [
  { out: 'submission/petrova-line-globe-4k.png', w: 1920, h: 1080, globe: 0.6 },
  { out: 'submission/petrova-line-globe-square.png', w: 2048, h: 2048, globe: 0.46 },
];

const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const s of shots) {
  const p = await b.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2 });
  await p.goto(`${page}?capture&globe=${s.globe}`);
  await p.addStyleTag({ content: '.stage > :not(canvas) { visibility: hidden !important; }' });
  // the opening has played and the 4K maps have replaced the first set
  await p.waitForFunction(() => {
    const u = window.__plEarth;
    return !!u && u.uDay.value.image?.width >= 4096 && u.uNight.value.image?.width >= 4096;
  }, null, { timeout: 180000, polling: 500 });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: resolve(root, s.out), timeout: 600000 });   // software GL: a 4096-px frame takes a while
  console.log(s.out);
  await p.close();
}
await b.close();
