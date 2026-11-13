import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// modes:
//   (default)  multi-file production build in dist/
//   single     one self-contained HTML file in dist-single/ (copied to release/terrawaltz.html)
//   embed      same, for sandboxed hosts that block downloads and printing
export default defineConfig(({ mode }) => {
  const single = mode === 'single' || mode === 'embed';
  return {
    base: './',
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    define: { __EMBED__: JSON.stringify(mode === 'embed') },
    build: {
      outDir: single ? 'dist-' + mode : 'dist',
      target: 'es2020',
      chunkSizeWarningLimit: 1600,
      ...(single ? { assetsInlineLimit: 100_000_000, cssCodeSplit: false } : {}),
    },
  };
});
