// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Reads SMaxSampleValue (TIFF tag 341), the one piece of COG metadata
// geotiff.js's own helpers don't expose: the domain ceiling for the color
// ramp and for normalizing a queried value to 0.0-1.0, matching
// osmviews-py's / osmviews-rs's rank() convention (pixelValue / SMax,
// clamped). Comes from the small file-directory (IFD) read that geotiff.js
// already does to open the image -- no separate pixel-data fetch.

import { fromUrl } from 'geotiff';

export async function readCogMeta(url) {
  const tiff = await fromUrl(url);
  const image = await tiff.getImage(0);
  const dir = image.fileDirectory;

  const smaxArray = await dir.loadValue('SMaxSampleValue');
  const smax = Array.isArray(smaxArray) ? smaxArray[0] : smaxArray;

  return { smax };
}
