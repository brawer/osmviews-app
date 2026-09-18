// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// The OSMViews raster is fully opaque and gets inserted directly below the
// first boundary/label layer (see MapView.jsx's insertion-point logic), so
// every fill, background, and line layer *before* that point in the
// basemap style is always completely hidden the moment the raster paints.
// Loading the style unfiltered means the browser draws all of that --
// land-use polygons, water fill, a separate shaded-relief source -- only to
// have the COG layer cover it a moment later, a visible flash of color that
// serves no purpose. Drop those layers up front instead, so nothing paints
// that's guaranteed to be hidden, and their tiles never get fetched either.
export async function loadMinimalBasemapStyle() {
  try {
    const res = await fetch(OPENFREEMAP_STYLE_URL);
    const style = await res.json();
    const firstVisible = style.layers.findIndex((l) => l.id.startsWith('boundary') || l.type === 'symbol');
    if (firstVisible > 0) {
      style.layers = style.layers.slice(firstVisible);
    }
    return style;
  } catch {
    // Network hiccup fetching the style ourselves: fall back to the plain
    // URL and let MapLibre fetch the unfiltered style -- the flicker this
    // is meant to avoid, but a working map beats a broken one.
    return OPENFREEMAP_STYLE_URL;
  }
}
