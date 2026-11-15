import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// modes:
//   (default)  installable web app in dist/ (manifest, icons, service worker from public/)
//   single     one self-contained HTML file in dist-single/ (copied to release/petrova-line.html)
//   embed      same, for sandboxed hosts that block downloads and printing

/** One-file builds open from disk: no manifest, and the favicon goes inline. */
function standaloneHead(): Plugin {
  return {
    name: 'standalone-head',
    transformIndexHtml(html) {
      const svg = readFileSync(new URL('./public/icon.svg', import.meta.url), 'utf8');
      return html
        .replace(/\s*<link rel="manifest"[^>]*>/, '')
        .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
        .replace('href="./icon.svg"', 'href="data:image/svg+xml,' + encodeURIComponent(svg) + '"');
    },
  };
}

/** The installable build lists its files so the service worker can cache all of them on install. */
function precacheList(): Plugin {
  return {
    name: 'precache-list',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) });
    },
  };
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single' || mode === 'embed';
  return {
    base: './',
    publicDir: single ? false : 'public',
    plugins: [react(), ...(single ? [standaloneHead(), viteSingleFile()] : [precacheList()])],
    define: { __EMBED__: JSON.stringify(mode === 'embed') },
    build: {
      outDir: single ? 'dist-' + mode : 'dist',
      target: 'es2020',
      chunkSizeWarningLimit: 1600,
      ...(single ? { assetsInlineLimit: 100_000_000, cssCodeSplit: false } : {}),
    },
  };
});
