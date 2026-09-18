// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Reads two things geotiff.js's GDAL metadata helper doesn't expose:
//
// - SMaxSampleValue (TIFF tag 341): the domain ceiling for the color ramp
//   and for normalizing a queried value to 0.0-1.0, matching osmviews-py's
//   / osmviews-rs's rank() convention (pixelValue / SMax, clamped).
// - The embedded histogram: GDAL writes it as a <GDALRasterAttributeTable>
//   nested inside the GDAL_METADATA tag (42112)'s XML, under an
//   <Item name="DEFAULT_RASTER_ATTRIBUTE_TABLE" role="rat">. geotiff.js's
//   own getGDALMetadata() only parses plain <Item> key/value pairs, not
//   this nested structure, so it's parsed here directly from the raw tag
//   string with DOMParser.
//
// Both come from the small file-directory (IFD) read that geotiff.js
// already does to open the image -- no separate pixel-data fetch.

import { fromUrl } from 'geotiff';

export async function readCogMeta(url) {
  const tiff = await fromUrl(url);
  const image = await tiff.getImage(0);
  const dir = image.fileDirectory;

  const smaxArray = await dir.loadValue('SMaxSampleValue');
  const smax = Array.isArray(smaxArray) ? smaxArray[0] : smaxArray;

  const gdalMetadata = await dir.loadValue('GDAL_METADATA');
  const histogram = gdalMetadata ? parseRatHistogram(gdalMetadata) : null;

  return { smax, histogram };
}

// Parses a GDAL <GDALRasterAttributeTable> (athematic, linear binning) into
// { binSize, bins: [{ min, max, count }, ...] }. Negative or non-finite
// counts are clamped to 0 defensively; none are expected (the RAT's own
// integers are full-precision text, well under Number.MAX_SAFE_INTEGER), but
// a bin shouldn't render as a negative bar if some future build ever wrote
// one.
function parseRatHistogram(gdalMetadataXml) {
  const doc = new DOMParser().parseFromString(gdalMetadataXml, 'application/xml');
  const rat = doc.querySelector('GDALRasterAttributeTable');
  if (!rat) return null;

  const binSize = Number(rat.getAttribute('BinSize'));
  const fields = [...rat.querySelectorAll('FieldDefn')].map((f) => f.querySelector('Name')?.textContent);
  const minIndex = fields.indexOf('min');
  const maxIndex = fields.indexOf('max');
  const countIndex = fields.indexOf('count');

  const bins = [...rat.querySelectorAll('Row')].map((row) => {
    const values = [...row.querySelectorAll('F')].map((f) => Number(f.textContent));
    const count = values[countIndex];
    return {
      min: values[minIndex],
      max: values[maxIndex],
      count: Number.isFinite(count) && count > 0 ? count : 0,
    };
  });

  return { binSize, bins };
}
