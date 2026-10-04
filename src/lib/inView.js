// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Whether a point, already projected to the map's screen coordinates,
// lies within the map's visible area. Shared by the tap loupe (which
// hides while its point is off screen) and MapView (which clears the
// tapped value once a move ends with the point off screen), so the two
// agree exactly on what "off screen" means.
export function isInView(map, p) {
  const el = map.getContainer();
  return p.x >= 0 && p.x <= el.clientWidth && p.y >= 0 && p.y <= el.clientHeight;
}
