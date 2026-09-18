// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Small decorative icons for the drawer, inlined as data: URLs -- no
// external request (the production repo's landing page has a standing CSP
// violation from loading its CC0 button off mirrors.creativecommons.org,
// brawer/osmviews#105; this sidesteps that class of problem entirely).
// `currentColor` doesn't resolve inside an <img>-loaded SVG (it has no view
// of the host page's computed style), so the color is baked in per theme.

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

// A minimal "0 in a circle" mark, in the spirit of Creative Commons' own
// CC0 badge (a circle-enclosed glyph) without reproducing their exact
// multi-badge artwork.
export function cc0IconDataUri() {
  const color = inkSoft();
  return svgDataUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16">` +
      `<circle cx="8" cy="8" r="7" fill="none" stroke="${color}" stroke-width="1.4"/>` +
      `<text x="8" y="11" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="${color}">0</text>` +
      `</svg>`,
  );
}
