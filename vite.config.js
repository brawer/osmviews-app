// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

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

export default defineConfig({
  base: '/',
  plugins: [react(), serveLocalData()],
  build: {
    outDir: 'dist',
  },
  optimizeDeps: {
    // MapLibre GL spawns a Web Worker via a URL Vite's dev-time dependency
    // pre-bundler doesn't rewrite correctly, leaving the worker chunk
    // 404ing at runtime (harmless in `vite build`, which doesn't use this
    // pre-bundling step -- dev-server only).
    exclude: ['maplibre-gl'],
  },
});
