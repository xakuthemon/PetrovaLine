#!/usr/bin/env node
/*
 * Renders the 7-slide Space Apps demo deck (submission/deck/index.html) to
 * submission/petrova-line-demo.pdf, plus a PNG of each slide in submission/deck/preview/.
 * Needs Playwright's Chromium:  node tools/make-deck.mjs
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto(pathToFileURL(resolve(root, 'submission/deck/index.html')).href);
await p.evaluate(() => document.fonts.ready);
await p.waitForTimeout(400);
await p.pdf({ path: resolve(root, 'submission/petrova-line-demo.pdf'), width: '1920px', height: '1080px', printBackground: true, pageRanges: '1-7' });
const out = resolve(root, 'submission/deck/preview');
mkdirSync(out, { recursive: true });
const n = await p.locator('section.slide').count();
for (let i = 0; i < n; i++) await p.locator('section.slide').nth(i).screenshot({ path: resolve(out, `slide-${i + 1}.jpg`), quality: 82 });
console.log(n + ' slides · submission/petrova-line-demo.pdf');
await b.close();
