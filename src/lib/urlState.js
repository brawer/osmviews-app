// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Path-based view-state permalinks: /<zoom>/<lat>/<lng>, e.g. /12/47.3/8.5.
// Not maplibre-gl's built-in `hash: true` (a #-fragment) -- the user wants
// clean URLs. Requires a 404->index.html SPA fallback on the CDN, filed as
// brawer/production#39; until that's live, only in-app navigation (not a
// fresh load of a deep link) works on the real domain. Locally, Vite's dev
// server already serves index.html for any unmatched path via its own SPA
// fallback, so deep links work today in `npm run dev`.

const DEFAULT_VIEW = { zoom: 2, lat: 20, lng: 0 };

export function parseViewFromPath(pathname) {
  const match = pathname.match(/^\/(\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)\/?$/);
  if (!match) return DEFAULT_VIEW;
  const [, zoom, lat, lng] = match;
  return { zoom: Number(zoom), lat: Number(lat), lng: Number(lng) };
}

export function viewToPath({ zoom, lat, lng }) {
  return `/${round(zoom, 2)}/${round(lat, 5)}/${round(lng, 5)}`;
}

function round(n, digits) {
  const factor = 10 ** digits;
  return Math.round(n * factor) / factor;
}

// Debounced history.replaceState -- called on every map `move` event, but
// only actually touches the URL a short while after movement settles.
export function makeViewStateSync(delayMs = 300) {
  let timer = null;
  return (view) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const path = viewToPath(view);
      if (path !== window.location.pathname) {
        window.history.replaceState(null, '', path);
      }
    }, delayMs);
  };
}
