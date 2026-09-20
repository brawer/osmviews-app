// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Reads SMaxSampleValue (TIFF tag 341), the one piece of COG metadata
// geotiff.js's own helpers don't expose: the domain ceiling for the color
// ramp and for normalizing a queried value to 0.0-1.0, matching
// osmviews-py's / osmviews-rs's rank() convention (pixelValue / SMax,
// clamped). Comes from the small file-directory (IFD) read that geotiff.js
// already does to open the image -- no separate pixel-data fetch.
//
// Also hands back the open `tiff` handle itself, so callers (see
// viewportRange.js) can read windowed overview data from the same
// connection instead of opening a second one -- geotiff.js only fetches
// the byte ranges an actual read touches, so opening it here costs nothing
// beyond what reading smax already needed.

import { fromUrl } from 'geotiff';

export async function readCogMeta(url) {
  const tiff = await fromUrl(url);
  const image = await tiff.getImage(0);
  const dir = image.fileDirectory;

  const smaxArray = await dir.loadValue('SMaxSampleValue');
  const smax = Array.isArray(smaxArray) ? smaxArray[0] : smaxArray;

  return { smax, tiff };
}
