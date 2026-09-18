// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Small decorative icons for the drawer, inlined as data: URLs -- no
// external request (the production repo's landing page has a standing CSP
// violation from loading its CC0 button off mirrors.creativecommons.org,
// brawer/osmviews#105; this sidesteps that class of problem entirely). The
// CC0 mark's path data is creativecommons.org's own cc0-zero.svg, just
// recolored per theme. `currentColor` doesn't resolve inside an
// <img>-loaded SVG (it has no view of the host page's computed style), so
// the color is baked in per theme instead.

import { prefersDark } from './ramp.js';

const INK_SOFT = { light: '#5c5648', dark: '#c9bca5' };

function inkSoft() {
  return prefersDark() ? INK_SOFT.dark : INK_SOFT.light;
}

function svgDataUri(svg) {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

// GitHub's own "mark-github" octicon.
export function githubIconDataUri() {
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">` +
      `<path fill="${inkSoft()}" fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>` +
      `</svg>`,
  );
}

// The official CC0 mark from creativecommons.org (their cc0-zero.svg).
export function cc0IconDataUri() {
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="16" height="16">` +
      `<path fill="${inkSoft()}" d="m32 13.58c-10.564 0-13.22 9.97-13.22 18.42-0.002 8.452 2.66 18.42 13.22 18.42 10.565 0 13.22-9.97 13.22-18.42s-2.655-18.42-13.22-18.42zm0 6.95c0.43 0 0.82 0.06 1.19 0.15 0.76 0.66 1.13 1.564 0.4 2.83l-7.034 12.926c-0.216-1.636-0.246-3.24-0.246-4.436 0-3.723 0.257-11.474 5.69-11.474zm5.267 5.957c0.433 1.983 0.433 4.056 0.433 5.513 0 3.72-0.26 11.475-5.7 11.475-0.425 0-0.82-0.045-1.185-0.135-0.075-0.022-0.135-0.04-0.205-0.07-0.11-0.03-0.23-0.07-0.333-0.11-1.21-0.513-1.972-1.444-0.877-3.09l7.867-13.58z"/>` +
      `<path fill="${inkSoft()}" d="m31.933 0c-8.873 0-16.359 3.09-22.453 9.3-3.09 3.09-5.444 6.6-7.08 10.53-1.6 3.89-2.4 7.94-2.4 12.17 0 4.27 0.8 8.32 2.4 12.17s3.92 7.31 6.97 10.4c3.08 3.04 6.545 5.39 10.39 7.03 3.89 1.6 7.94 2.4 12.17 2.4s8.34-0.83 12.31-2.46c3.96-1.64 7.49-4 10.62-7.09 3.01-2.93 5.29-6.293 6.81-10.1 1.56-3.85 2.33-7.97 2.33-12.35 0-4.34-0.77-8.45-2.33-12.3-1.562-3.888-3.85-7.323-6.86-10.333-6.285-6.247-13.92-9.367-22.88-9.367zm0.134 5.76c7.238 0 13.413 2.57 18.553 7.71 2.48 2.48 4.38 5.308 5.671 8.47 1.299 3.16 1.949 6.54 1.949 10.06 0 7.35-2.515 13.45-7.51 18.33-2.59 2.52-5.5 4.448-8.73 5.78-3.21 1.34-6.5 1.996-9.933 1.996-3.067 0-6.788-0.653-9.949-1.946-3.158-1.336-6.001-3.24-8.518-5.72-2.513-2.51-4.45-5.35-5.824-8.51-1.336-3.2-2.016-6.5-2.016-9.93 0-3.47 0.68-6.79 2.02-9.95 1.37-3.2 3.31-6.075 5.82-8.63 4.99-5.03 11.15-7.66 18.467-7.66z"/>` +
      `</svg>`,
  );
}
