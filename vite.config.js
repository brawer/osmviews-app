// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import sirv from 'sirv';

// In production, /data/* is served by the same Bunny pull zone as the app
// itself (see brawer/production's cdn.tf). Locally, serve this repo's
// (gitignored) data/ folder at the same path -- with real Range-request
// support via sirv, so the COG-reading code path is exercised faithfully
// even while the CDN itself doesn't yet support ranges (brawer/production#38).
// This only patches the dev server; it must never affect `vite build`, so
// it's wired via configureServer, not `publicDir` (which would copy the
// ~580 MB data/ folder into dist/ on every build).
function serveLocalData() {
  const serve = sirv('data', { dev: true });
  return {
    name: 'serve-local-data',
    configureServer(server) {
      server.middlewares.use('/data', serve);
    },
  };
}

// Bunny's storage/CDN layer does its own extension-based Content-Type
// detection on serve and ignores whatever Content-Type is sent on upload
// (confirmed empirically: a .js file uploaded as "text/javascript" is
// served back as "application/javascript" -- Bunny's own guess, not ours).
// ".mjs" isn't in its recognized-extensions table, so it falls back to
// application/octet-stream regardless of what scripts/deploy.mjs sends,
// and Firefox correctly refuses to run a module worker or import a module
// script served with that MIME type.
//
// MapLibre's worker script (imported via `?url` in MapView.jsx) is a
// ".mjs" file, and it in turn imports a second one, "./maplibre-gl-shared
// .mjs", by a hardcoded relative path -- both need to end up served as
// plain ".js" for Bunny to get the Content-Type right, which for the
// worker script alone is just a rename (handled by assetFileNames below),
// but for its dependency also means: (a) emitting a file nothing in our
// own source imports, since only the worker script's own text references
// it, and (b) rewriting that reference after Vite has already renamed the
// file it points to. Confirmed by testing: this dependency doesn't itself
// import anything further, so this covers the whole chain.
function fixMaplibreWorkerMjsExtensions() {
  return {
    name: 'fix-maplibre-worker-mjs-extensions',
    buildStart() {
      const sharedPath = fileURLToPath(
        new URL('./node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs', import.meta.url),
      );
      this.emitFile({
        type: 'asset',
        name: 'maplibre-gl-shared.mjs',
        source: readFileSync(sharedPath),
      });
    },
    generateBundle(_options, bundle) {
      // The shared asset's own filename carries a content hash (assigned
      // by the same assetFileNames rule that renamed it to .js), so the
      // worker's patched reference has to look that real name up rather
      // than assume a fixed one.
      const sharedFileName = Object.keys(bundle).find(
        (f) => f.startsWith('assets/maplibre-gl-shared-') && f.endsWith('.js'),
      );
      if (!sharedFileName) {
        this.error('fixMaplibreWorkerMjsExtensions: emitted maplibre-gl-shared asset not found in bundle');
      }
      const sharedBasename = sharedFileName.slice(sharedFileName.lastIndexOf('/') + 1);

      for (const [fileName, asset] of Object.entries(bundle)) {
        if (asset.type === 'asset' && fileName.startsWith('assets/maplibre-gl-worker-') && fileName.endsWith('.js')) {
          const source = typeof asset.source === 'string' ? asset.source : Buffer.from(asset.source).toString('utf-8');
          asset.source = source.replaceAll('./maplibre-gl-shared.mjs', `./${sharedBasename}`);
        }
      }
    },
  };
}

export default defineConfig({
  base: '/',
  plugins: [react(), serveLocalData(), fixMaplibreWorkerMjsExtensions()],
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) => {
          const name = assetInfo.names?.[0] ?? assetInfo.name ?? '';
          return name.endsWith('.mjs') ? 'assets/[name]-[hash].js' : 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  optimizeDeps: {
    // MapLibre GL spawns a Web Worker via a URL Vite's dev-time dependency
    // pre-bundler doesn't rewrite correctly, leaving the worker chunk
    // 404ing at runtime (harmless in `vite build`, which doesn't use this
    // pre-bundling step -- dev-server only).
    exclude: ['maplibre-gl'],
  },
});
