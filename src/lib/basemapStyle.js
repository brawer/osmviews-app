// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';

// Zoom from which roads and road names get drawn on top of the raster.
// Past the COG's native ~z10 resolution it turns into large flat cells,
// and street-level context helps tell where exactly a cell is; any
// shallower, roads would just clutter the color ramp.
const ROAD_MINZOOM = 12;

// Roads are only there for orientation, so they're toned down to one
// translucent, neutral color instead of Liberty's yellows and oranges,
// which would compete with the color ramp. White reads on the ramp's dark
// blues as well as its ambers, in both light and dark theme.
const ROAD_PAINT = { 'line-color': '#fff', 'line-opacity': 0.3 };

// Road names, drawn from ROAD_MINZOOM on (see above), in the place
// labels' black-on-white-halo style -- Liberty's own grey road names have
// no halo and vanish on the ramp's dark end -- but faded like the roads.
const ROAD_NAME_LAYERS = new Set(['highway-name-path', 'highway-name-minor', 'highway-name-major']);

// Symbol-type layers worth keeping once the raster is drawing beneath them:
// place-name labels (geographic orientation -- "where am I"), water
// names, and road names. Everything else symbol-typed in the "liberty"
// style is navigational detail this app has no use for -- highway
// shields (osmviews-app#12), POI icons, transit stops, airport markers,
// one-way arrows -- and is dropped. An explicit allowlist, not a
// denylist: an OpenFreeMap style update that adds a new symbol layer this
// doesn't recognize defaults to hidden, not shown.
const KEPT_SYMBOL_LAYERS = new Set([
  ...ROAD_NAME_LAYERS,
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
// first boundary/label layer (see cogLayer.js's insertion-point logic), so
// every fill, background, and line layer *before* that point in the
// basemap style is always completely hidden the moment the raster paints
// -- except for the roads, which get moved above it (see below).
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
    // Surface roads and bridges (no casings, rail, tunnels or
    // pedestrian-area patterns; casings would show through the translucent
    // road color, see ROAD_PAINT) are the one exception to "everything
    // before the cutoff is hidden": pull them out and re-insert them
    // after the boundary layers, i.e. above the raster, which goes in
    // right before the first boundary layer (see cogLayer.js).
    const roadLayers = style.layers
      .slice(0, Math.max(cutoff, 0))
      .filter(
        (l) =>
          l.type === 'line' && /^(road|bridge)_/.test(l.id) && !l.id.includes('rail') && !l.id.endsWith('_casing'),
      );
    if (cutoff > 0) {
      style.layers = style.layers.slice(cutoff);
    }
    const lastBoundary = style.layers.findLastIndex((l) => l.id.startsWith('boundary'));
    style.layers.splice(lastBoundary + 1, 0, ...roadLayers);

    // Of what's left (boundary lines, roads, every symbol/label layer), drop
    // the symbol layers that aren't on the allowlist above.
    style.layers = style.layers.filter((l) => l.type !== 'symbol' || KEPT_SYMBOL_LAYERS.has(l.id));

    for (const l of style.layers) {
      if (roadLayers.includes(l)) {
        l.minzoom = Math.max(l.minzoom ?? 0, ROAD_MINZOOM);
        l.paint = { ...l.paint, ...ROAD_PAINT };
      } else if (ROAD_NAME_LAYERS.has(l.id)) {
        l.minzoom = Math.max(l.minzoom ?? 0, ROAD_MINZOOM);
        l.paint = {
          'text-color': '#000',
          'text-halo-color': '#fff',
          'text-halo-width': 1,
          'text-halo-blur': 1,
          'text-opacity': 0.6,
        };
      }
    }

    return style;
  } catch {
    // Network hiccup fetching the style ourselves: fall back to the plain
    // URL and let MapLibre fetch the unfiltered style -- the flicker and
    // label clutter this is meant to avoid, but a working map beats a
    // broken one.
    return OPENFREEMAP_STYLE_URL;
  }
}
