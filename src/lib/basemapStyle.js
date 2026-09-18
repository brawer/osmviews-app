// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Symbol-type layers worth keeping once the raster is drawing beneath them:
// place-name labels (geographic orientation -- "where am I") and water
// names. Everything else symbol-typed in the "liberty" style is
// navigational detail this app has no use for -- road names, highway
// shields (osmviews-app#12), POI icons, transit stops, airport markers --
// and is dropped. An explicit allowlist, not a denylist: an OpenFreeMap
// style update that adds a new symbol layer this doesn't recognize
// defaults to hidden, not shown.
const KEPT_SYMBOL_LAYERS = new Set([
  'waterway_line_label',
  'water_name_point_label',
  'water_name_line_label',
  'label_other',
  'label_village',
  'label_town',
  'label_state',
  'label_city',
  'label_city_capital',
  'label_country_3',
  'label_country_2',
  'label_country_1',
]);

// The OSMViews raster is fully opaque and gets inserted directly below the
// first boundary/label layer (see MapView.jsx's insertion-point logic), so
// every fill, background, and line layer *before* that point in the
// basemap style is always completely hidden the moment the raster paints.
// Loading the style unfiltered means the browser draws all of that --
// land-use polygons, water fill, a separate shaded-relief source, bridge
// casings, building footprints -- only to have the COG layer cover it a
// moment later, a visible flash of color that serves no purpose. Drop
// those layers up front instead, so nothing paints that's guaranteed to
// be hidden, and their tiles never get fetched either.
export async function loadMinimalBasemapStyle() {
  try {
    const res = await fetch(OPENFREEMAP_STYLE_URL);
    const style = await res.json();

    // First *administrative boundary* layer, not just "first symbol
    // layer": the "liberty" style has two stray symbol layers
    // (road_one_way_arrow / road_one_way_arrow_opposite) sitting well
    // before boundary_3, so matching on type alone cut in the wrong
    // place -- every bridge casing and building footprint between that
    // point and the real boundary_3 was being kept and rendered on TOP
    // of the raster instead of hidden by it. Falls back to "first symbol
    // layer" only if a style has no boundary_*-named layers at all.
    let cutoff = style.layers.findIndex((l) => l.id.startsWith('boundary'));
    if (cutoff === -1) {
      cutoff = style.layers.findIndex((l) => l.type === 'symbol');
    }
    if (cutoff > 0) {
      style.layers = style.layers.slice(cutoff);
    }

    // Of what's left (boundary lines + every symbol/label layer), drop
    // the symbol layers that aren't on the allowlist above.
    style.layers = style.layers.filter((l) => l.type !== 'symbol' || KEPT_SYMBOL_LAYERS.has(l.id));

    return style;
  } catch {
    // Network hiccup fetching the style ourselves: fall back to the plain
    // URL and let MapLibre fetch the unfiltered style -- the flicker and
    // label clutter this is meant to avoid, but a working map beats a
    // broken one.
    return OPENFREEMAP_STYLE_URL;
  }
}
