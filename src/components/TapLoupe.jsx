// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// A circular "loupe" over the tapped location, magnified to
// current_zoom + 4 -- focus (the zoomed-in content) plus context (the
// full map still visible all around it), the way a real magnifying glass
// held over a paper map works, rather than replacing the view entirely.
// It's a second, independent maplibregl.Map, not a viewport into the main
// one: MapLibre has no notion of a circular/magnified inset of an
// existing map, so this renders its own small map, clipped to a circle
// with CSS, and keeps it positioned exactly over the tapped point as the
// main map pans underneath it.
//
// No crosshair inside the loupe: its optical center *is* the tapped
// point, by construction, the same way the macOS accessibility loupe
// marks nothing either -- centering the magnifier on the point already
// tells you where it is. A small dot at that exact center, colored with
// the actual pixel value there (not white), doubles as a quiet
// confirmation without needing a crosshair.
//
// Clicking inside the loupe re-taps using the loupe's own map's click
// event, not the main map's: at any given screen pixel inside the
// circle, the loupe is showing a different, more zoomed-in place than
// what's at that same pixel on the main map underneath, so the two
// would disagree about which location was actually clicked.

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { colorScale, locationValues } from '@geomatico/maplibre-cog-protocol';
import { addCogRasterLayer } from '../lib/cogLayer.js';
import { currentRamp } from '../lib/ramp.js';
import { loadMinimalBasemapStyle } from '../lib/basemapStyle.js';

const LOUPE_SIZE = 160; // px, keep in sync with app.css's .tap-loupe
const ZOOM_OFFSET = 4;

export default function TapLoupe({ map, tapValue, cogUrl, smax, onTapValue }) {
  const containerRef = useRef(null);
  const loupeMapRef = useRef(null);
  const [loupeReady, setLoupeReady] = useState(false);
  const [screenPos, setScreenPos] = useState(null);

  // Build the loupe's own small map + COG layer once, on mount.
  useEffect(() => {
    let cancelled = false;
    loadMinimalBasemapStyle().then((style) => {
      if (cancelled || !containerRef.current) return;
      const loupeMap = new maplibregl.Map({
        container: containerRef.current,
        style,
        interactive: false,
        attributionControl: false,
      });
      loupeMapRef.current = loupeMap;
      loupeMap.once('style.load', () => {
        if (cancelled) return;
        // Fully opaque, always -- unlike the main map (which fades the
        // raster out past z13, an overzoomed flat wash there), the loupe
        // exists specifically to show that flat wash up close.
        addCogRasterLayer(loupeMap, cogUrl, 1);
        setLoupeReady(true);
      });
    });
    return () => {
      cancelled = true;
      loupeMapRef.current?.remove();
      loupeMapRef.current = null;
    };
  }, [cogUrl]);

  // Snap the loupe to the tapped location/zoom on every new tap -- a
  // fixed snapshot from then on, not continuously re-zooming as the main
  // map's own zoom changes afterwards.
  useEffect(() => {
    if (!tapValue || !loupeReady) return;
    loupeMapRef.current?.jumpTo({ center: tapValue.lngLat, zoom: map.getZoom() + ZOOM_OFFSET });
  }, [tapValue, loupeReady, map]);

  // Track the tapped point's screen position as the main map pans, so the
  // loupe stays visually pinned over the place it's showing -- subscribes
  // only while there's a tapValue to track; render below derives "hidden"
  // from tapValue directly rather than resetting state up front here.
  useEffect(() => {
    if (!tapValue) return;
    const update = () => {
      const p = map.project(tapValue.lngLat);
      const el = map.getContainer();
      const inView = p.x >= 0 && p.x <= el.clientWidth && p.y >= 0 && p.y <= el.clientHeight;
      setScreenPos(inView ? p : null);
    };
    update();
    map.on('move', update);
    return () => map.off('move', update);
  }, [map, tapValue]);

  // Re-tap on a click inside the loupe, using its own map's click event --
  // e.lngLat here is already unprojected through the loupe's own (more
  // zoomed-in) view, exactly the coordinate the user is actually pointing
  // at. Feeding it back through the same onTapValue the main map uses lets
  // this double as a "drill in for more precision" interaction: it snaps
  // both the ramp card and the loupe itself (still at map.getZoom() +
  // ZOOM_OFFSET, not a further zoom) to the refined location.
  useEffect(() => {
    if (!loupeReady) return;
    const loupeMap = loupeMapRef.current;
    const onClick = (e) => {
      locationValues(cogUrl, { latitude: e.lngLat.lat, longitude: e.lngLat.lng }, loupeMap.getZoom()).then(
        (result) => {
          const value = result?.[0];
          if (!Number.isFinite(value) || smax == null) return;
          const normalized = Math.min(1, Math.max(0, value / smax));
          onTapValue({ value, normalized, lngLat: e.lngLat });
        },
      );
    };
    loupeMap.on('click', onClick);
    return () => loupeMap.off('click', onClick);
  }, [loupeReady, cogUrl, smax, onTapValue]);

  let dotColor = null;
  if (tapValue && smax != null) {
    const interpolate = colorScale({ customColors: currentRamp(), min: 0, max: smax, isContinuous: true });
    const [r, g, b] = interpolate(tapValue.value);
    dotColor = `rgb(${r}, ${g}, ${b})`;
  }

  // tapValue itself (not just screenPos) gates visibility: once tapValue
  // goes back to null, screenPos may still hold its last tracked value
  // until this component re-renders, and should not flash there.
  const displayPos = tapValue ? screenPos : null;

  return (
    <div
      className="tap-loupe"
      style={{
        display: displayPos ? 'block' : 'none',
        left: (displayPos?.x ?? 0) - LOUPE_SIZE / 2,
        top: (displayPos?.y ?? 0) - LOUPE_SIZE / 2,
      }}
    >
      <div ref={containerRef} className="tap-loupe__map" />
      <div className="tap-loupe__sheen" />
      {dotColor && <div className="tap-loupe__dot" style={{ background: dotColor }} />}
    </div>
  );
}
