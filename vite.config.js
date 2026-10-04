// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

import { createHash } from 'node:crypto';
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
// This only patches the dev and preview servers; it must never affect
// `vite build`, so it's wired via configureServer/configurePreviewServer,
// not `publicDir` (which would copy the ~580 MB data/ folder into dist/ on
// every build).
function serveLocalData() {
  const serve = sirv('data', { dev: true });
  return {
    name: 'serve-local-data',
    configureServer(server) {
      server.middlewares.use('/data', serve);
    },
    // Also for `vite preview`, to try the production build locally.
    configurePreviewServer(server) {
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
// but for its dependency also means: (a) emitting it ourselves, since
// the worker script is only copied as an asset, so Vite never follows
// its imports, and (b) rewriting the worker's reference to it to match
// the emitted file's hashed name. Confirmed by testing: this dependency doesn't itself
// import anything further, so this covers the whole chain.
function fixMaplibreWorkerMjsExtensions() {
  let isBuild = false;
  let base = '/';
  let sharedFileName = null; // assets/maplibre-gl-shared-<hash>.js
  return {
    name: 'fix-maplibre-worker-mjs-extensions',
    // Ahead of Vite's own resolver, which would otherwise resolve the
    // shared import below before resolveId here ever sees it.
    enforce: 'pre',
    configResolved(config) {
      isBuild = config.command === 'build';
      base = config.base;
    },
    buildStart() {
      if (!isBuild) return;
      const source = readFileSync(
        fileURLToPath(new URL('./node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs', import.meta.url)),
      );
      // Named here, with our own content hash, rather than by
      // assetFileNames once the bundle is written: resolveId below needs
      // the final name already, while the main bundle is being built.
      const hash = createHash('sha256').update(source).digest('base64url').slice(0, 8);
      sharedFileName = `assets/maplibre-gl-shared-${hash}.js`;
      this.emitFile({ type: 'asset', fileName: sharedFileName, source });
    },
    // MapLibre's main module imports the very same shared code, by the
    // same hardcoded relative path. Left alone, Vite inlines a second copy
    // of it into our main bundle, and a first visit downloads those
    // ~500 kB twice: once inlined, once as the worker's own file. Pointing
    // that import at the worker's emitted file instead (as an external,
    // so it stays a real import at runtime) shares one download, cached
    // across both. The main bundle sits in the same assets/ folder, so a
    // relative path works unchanged.
    resolveId(source, importer) {
      if (!isBuild || source !== './maplibre-gl-shared.mjs' || !importer?.includes('maplibre-gl')) return null;
      return { id: `./${sharedFileName.slice('assets/'.length)}`, external: true };
    },
    // That import only starts once the main bundle has been downloaded and
    // parsed; a modulepreload starts fetching it right away, in parallel.
    transformIndexHtml() {
      if (!isBuild) return [];
      return [
        {
          tag: 'link',
          attrs: { rel: 'modulepreload', crossorigin: true, href: `${base}${sharedFileName}` },
          injectTo: 'head',
        },
      ];
    },
    generateBundle(_options, bundle) {
      const sharedBasename = sharedFileName.slice('assets/'.length);
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
    // The main bundle is mostly MapLibre's main module and React, which
    // the map needs before it can draw anything, so splitting it wouldn't
    // get the first screen up any sooner. Set a little above its current
    // ~1.15 MB, so the warning only fires again if something unexpectedly
    // large gets added.
    chunkSizeWarningLimit: 1250,
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
