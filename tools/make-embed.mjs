#!/usr/bin/env node
/*
 * Post-processing for the one-file builds.
 *   --release      dist-single/index.html -> release/terrawaltz.html (opens from disk, no server)
 *   --embed [out]  dist-embed/index.html  -> a body-only fragment for sandboxed hosts that supply
 *                  their own <html>/<head> (default: dist-embed/terrawaltz.fragment.html)
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + ' kB';

function block(html, tag) {
  const a = html.indexOf('<' + tag);
  const b = html.indexOf('</' + tag + '>', a);
  if (a < 0 || b < 0) throw new Error('make-embed: no <' + tag + '> block in the build');
  return html.slice(a, b + tag.length + 3);
}

if (args.includes('--release')) {
  const html = readFileSync(resolve(root, 'dist-single/index.html'), 'utf8');
  const out = resolve(root, 'release/terrawaltz.html');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
  console.log('release/terrawaltz.html  ' + kb(html));
}

if (args.includes('--embed')) {
  const html = readFileSync(resolve(root, 'dist-embed/index.html'), 'utf8');
  const next = args[args.indexOf('--embed') + 1];
  const out = resolve(root, next && !next.startsWith('--') ? next : 'dist-embed/terrawaltz.fragment.html');
  const fragment = [
    '<title>TerraWaltz</title>',
    '<meta name="claude:viewport-fit-sides" content="cover">',
    block(html, 'style'),
    '<div id="root"></div>',
    block(html, 'script'),
    '',
  ].join('\n');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, fragment);
  console.log(out.replace(root + '/', '') + '  ' + kb(fragment));
}
