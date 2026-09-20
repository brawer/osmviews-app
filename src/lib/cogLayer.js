// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Adds the OSMViews COG raster source+layer to a MapLibre map. Shared
// between the main MapView and TapLoupe's own small map instance (see
// TapLoupe.jsx) so both render the raster identically -- the loupe is a
// second, independent `maplibregl.Map`, not a view into the main one.

export const COG_SOURCE_ID = 'osmviews';
export const COG_LAYER_ID = 'osmviews-raster';

// `opacity` is a MapLibre paint value (a literal or an expression). The
// main map fades the raster out past z13 -- overzoomed past the COG's
// native ~z10 resolution, it's a flat wash better left to the basemap
// (see MapView.jsx) -- but the loupe exists specifically to show that
// flat wash up close, so it always passes a plain `1` instead.
export function addCogRasterLayer(map, cogUrl, opacity) {
  if (map.getSource(COG_SOURCE_ID)) return;
  map.addSource(COG_SOURCE_ID, { type: 'raster', url: `cog://${cogUrl}`, tileSize: 256 });
  // Insert above every polygon fill and line -- roads, waterways, water
  // itself -- but below administrative boundaries and the (curated, see
  // basemapStyle.js) text labels, so those stay legible over the color
  // layer. loadMinimalBasemapStyle() already trimmed everything before the
  // boundary layers out of the style entirely, so this resolves to the
  // very first remaining layer in practice; kept as a real search (not
  // just styleLayers[0]) so an unrelated style without boundary_*-named
  // layers still inserts before its first symbol layer, keeping labels on
  // top, same fallback loadMinimalBasemapStyle() itself uses.
  const styleLayers = map.getStyle().layers ?? [];
  const beforeId = styleLayers.find((l) => l.id.startsWith('boundary') || l.type === 'symbol')?.id;
  map.addLayer(
    {
      id: COG_LAYER_ID,
      source: COG_SOURCE_ID,
      type: 'raster',
      paint: {
        'raster-opacity': opacity,
        // This is discrete per-pixel grid data, not a continuous field --
        // MapLibre's default bilinear resampling blurs adjacent cells
        // together on overzoom, which reads as a rendering glitch rather
        // than what it actually is (a coarser grid cell shown bigger).
        // Nearest-neighbor keeps cell edges sharp instead.
        'raster-resampling': 'nearest',
      },
    },
    beforeId,
  );
}
