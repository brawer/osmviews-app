// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Computes the true min/max pixel value visible within a lng/lat bounding
// box, for the ramp card's viewport-dimming indicator. Earlier this
// point-sampled a sparse grid (a handful of locationValues() calls spread
// across the viewport), which reliably missed small, dense hotspots --
// a city can be a fraction of a degree wide, while a 5x5 grid over a
// continent-spanning low-zoom viewport has points several degrees apart.
//
// Reading from the COG's own overview pyramid instead fixes that for the
// max: the pyramid is built with "max" resampling (osmviews' pipeline), so
// the max of a coarse overview block equals the true max of the full-
// resolution pixels underneath it, exactly -- no hotspot can hide inside a
// downsampled block the way it can between sample points. The min is only
// as accurate as the chosen overview level lets it be (a max-pooled block
// reports 0 only if *every* full-res pixel in it is 0), which is why
// pickOverviewLevel below keeps blocks reasonably small rather than always
// grabbing the coarsest level available.

const EARTH_RADIUS = 6378137; // meters, EPSG:3857
const MIN_OVERVIEW_DIM = 256; // px, floor on the window's shorter side

function lonToMercatorX(lon) {
  return EARTH_RADIUS * ((lon * Math.PI) / 180);
}

function latToMercatorY(lat) {
  const rad = (lat * Math.PI) / 180;
  return EARTH_RADIUS * Math.log(Math.tan(Math.PI / 4 + rad / 2));
}

// Computes the true min/max over every pixel visible in `bounds` (a
// MapLibre LngLatBounds), or null if the window doesn't overlap the COG at
// all. `tiff` is the open geotiff.js handle from readCogMeta().
export async function computeViewportRange(tiff, bounds) {
  const full = await tiff.getImage(0);
  const [ox, oy, mx, my] = full.getBoundingBox();
  const fullWidth = full.getWidth();
  const fullHeight = full.getHeight();

  const x0 = lonToMercatorX(bounds.getWest());
  const x1 = lonToMercatorX(bounds.getEast());
  const y0 = latToMercatorY(bounds.getSouth());
  const y1 = latToMercatorY(bounds.getNorth());

  // Pixel window at full resolution (image y increases downward; world y
  // increases upward, hence the north/south swap below).
  const px0 = ((x0 - ox) / (mx - ox)) * fullWidth;
  const px1 = ((x1 - ox) / (mx - ox)) * fullWidth;
  const py0 = ((my - y1) / (my - oy)) * fullHeight;
  const py1 = ((my - y0) / (my - oy)) * fullHeight;

  const imageCount = await tiff.getImageCount();
  let level = 0;
  // Each overview level halves resolution (standard COG pyramid); pick the
  // coarsest one whose window is still >= MIN_OVERVIEW_DIM px on its
  // shorter side, so the read stays cheap without over-coarsening the
  // blocks the min gets computed from.
  for (let i = 1; i < imageCount; i++) {
    const scale = 1 / 2 ** i;
    if (Math.min((px1 - px0) * scale, (py1 - py0) * scale) < MIN_OVERVIEW_DIM) break;
    level = i;
  }

  const scale = 1 / 2 ** level;
  const overview = level === 0 ? full : await tiff.getImage(level);
  const window = [
    Math.max(0, Math.floor(px0 * scale)),
    Math.max(0, Math.floor(py0 * scale)),
    Math.min(overview.getWidth(), Math.ceil(px1 * scale)),
    Math.min(overview.getHeight(), Math.ceil(py1 * scale)),
  ];
  if (window[2] <= window[0] || window[3] <= window[1]) return null;

  const [data] = await overview.readRasters({ window });
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return { min, max };
}
