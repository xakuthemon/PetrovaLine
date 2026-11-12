#!/usr/bin/env node
/*
 * Bundles TerraWaltz into one self-contained HTML file (CSS, JS and fonts inlined).
 *
 *   node tools/build-single.mjs                 -> dist/terrawaltz.html
 *   node tools/build-single.mjs --embed <file>  -> also writes a body-only fragment for
 *                                                  sandboxed hosts that add their own
 *                                                  document shell and block downloads
 *
 * No dependencies. The multi-file app in the repository root needs no build at all.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let css = read('css/styles.css');
css = css.replace(/url\("\.\.\/(assets\/fonts\/[^"]+\.woff2)"\)/g, (_, file) =>
  'url("data:font/woff2;base64,' + readFileSync(join(root, file)).toString('base64') + '")');

const html = read('index.html');
const scripts = [];
const scriptRe = /<script src="(js\/[^"]+)"><\/script>\s*/g;
let m;
while ((m = scriptRe.exec(html))) scripts.push(m[1]);
if (!scripts.length) throw new Error('no scripts found in index.html');
const inlineJs = (extra) =>
  (extra || '') + scripts.map((s) => '<script>\n' + read(s).replace(/<\/script/g, '<\\/script') + '\n</script>').join('\n');

// 1. standalone single file
// (function replacers: a plain string would have its "$" sequences interpreted)
const single = html
  .replace('<link rel="stylesheet" href="css/styles.css">', () => '<style>\n' + css + '\n</style>')
  .replace(scriptRe, '')
  .replace('</body>', () => inlineJs() + '\n</body>');
mkdirSync(join(root, 'dist'), { recursive: true });
writeFileSync(join(root, 'dist/terrawaltz.html'), single);
console.log('dist/terrawaltz.html', (single.length / 1024).toFixed(0) + ' KB');

// 2. optional body-only fragment
const i = process.argv.indexOf('--embed');
if (i > -1 && process.argv[i + 1]) {
  const title = (html.match(/<title>[^<]*<\/title>/) || ['<title>TerraWaltz</title>'])[0];
  const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(scriptRe, '');
  const frag = [
    title,
    '<meta name="claude:viewport-fit-sides" content="cover">',
    '<style>\n' + css + '\n</style>',
    body.trim(),
    inlineJs('<script>window.TW_EMBED = true;</script>\n'),
  ].join('\n');
  const out = resolve(process.argv[i + 1]);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, frag);
  console.log(out, (frag.length / 1024).toFixed(0) + ' KB');
}
