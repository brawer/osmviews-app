// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// A circular "loupe" over the tapped location, magnified to
// current_zoom + 2 -- focus (the zoomed-in content) plus context (the
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
// confirmation without needing a crosshair. A short leader line runs
// from the dot down and to the right into a small label with the tapped
// value -- the same number the ramp card shows -- so it can be read right
// where the eye already is, without glancing over at the ramp.
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
const ZOOM_OFFSET = 2;

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
        addCogRasterLayer(loupeMap, cogUrl);
        setLoupeReady(true);
      });
    });
    return () => {
      cancelled = true;
      loupeMapRef.current?.remove();
      loupeMapRef.current = null;
    };
  }, [cogUrl]);

  // Center the loupe on the tapped location on every new tap, and keep it
  // in step with the main map from then on: always ZOOM_OFFSET levels
  // deeper than the main map's zoom, and rotated by the same bearing.
  // A plain pan changes neither, only where the loupe sits on screen
  // (see below), so skip the jumpTo then.
  useEffect(() => {
    if (!tapValue || !loupeReady) return;
    const loupeMap = loupeMapRef.current;
    loupeMap.jumpTo({ center: tapValue.lngLat, zoom: map.getZoom() + ZOOM_OFFSET, bearing: map.getBearing() });
    const sync = () => {
      const zoom = map.getZoom() + ZOOM_OFFSET;
      const bearing = map.getBearing();
      if (zoom === loupeMap.getZoom() && bearing === loupeMap.getBearing()) return;
      loupeMap.jumpTo({ zoom, bearing });
    };
    map.on('move', sync);
    return () => map.off('move', sync);
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

  // Pinch-zoom/rotate and wheel/trackpad zoom inside the loupe drive the
  // main map, exactly like the same gesture on the main map would (the
  // sync effect above then carries the loupe along). Without this, the
  // gesture lands on the non-interactive loupe and falls through to the
  // browser, which zooms the whole page instead. Both pivot on the tapped
  // location rather than the fingers/pointer, so the loupe stays put over
  // its point while the map zooms and turns underneath it.
  useEffect(() => {
    if (!loupeReady || !tapValue) return;
    const el = containerRef.current;
    let pinch = null;

    const fingers = (touches) => {
      const [a, b] = touches;
      const dx = b.clientX - a.clientX;
      const dy = b.clientY - a.clientY;
      return { dist: Math.hypot(dx, dy), angle: Math.atan2(dy, dx) };
    };
    const onTouchStart = (e) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      pinch = { ...fingers(e.touches), zoom: map.getZoom(), bearing: map.getBearing() };
    };
    const onTouchMove = (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const { dist, angle } = fingers(e.touches);
      if (!pinch.dist) return;
      map.easeTo({
        zoom: pinch.zoom + Math.log2(dist / pinch.dist),
        // Fingers turning clockwise on screen turn the map clockwise too,
        // which is a decreasing bearing.
        bearing: pinch.bearing - ((angle - pinch.angle) * 180) / Math.PI,
        around: tapValue.lngLat,
        duration: 0,
      });
    };
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) pinch = null;
    };

    // Wheel and trackpad pinch (which browsers report as ctrl+wheel):
    // hand the event on to the main map's own scroll-zoom handler, so it
    // keeps MapLibre's wheel-vs-trackpad detection and smoothing, but with
    // the pointer moved onto the tapped point to pivot the zoom there.
    const onWheel = (e) => {
      e.preventDefault();
      const p = map.project(tapValue.lngLat);
      const rect = map.getCanvas().getBoundingClientRect();
      map.getCanvasContainer().dispatchEvent(
        new WheelEvent('wheel', {
          deltaX: e.deltaX,
          deltaY: e.deltaY,
          deltaZ: e.deltaZ,
          deltaMode: e.deltaMode,
          ctrlKey: e.ctrlKey,
          shiftKey: e.shiftKey,
          clientX: rect.left + p.x,
          clientY: rect.top + p.y,
          bubbles: true,
          cancelable: true,
        }),
      );
    };

    // Safari's own pinch events, which would otherwise zoom the page.
    const onGesture = (e) => e.preventDefault();

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', onGesture);
    el.addEventListener('gesturechange', onGesture);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGesture);
      el.removeEventListener('gesturechange', onGesture);
    };
  }, [loupeReady, tapValue, map]);

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
      <div className="tap-loupe__rim" />
      {dotColor && (
        <>
          {/* Leader: from just outside the dot's ring, 45° down-right, then
              a short horizontal run into the label. Coordinates are in the
              loupe's own LOUPE_SIZE box, centered on (80, 80). */}
          <svg className="tap-loupe__leader" viewBox={`0 0 ${LOUPE_SIZE} ${LOUPE_SIZE}`} aria-hidden="true">
            <path className="tap-loupe__leader-halo" d="M86.5 86.5 L97 97 H103" />
            <path className="tap-loupe__leader-line" d="M86.5 86.5 L97 97 H103" />
          </svg>
          <div className="tap-loupe__value">{tapValue.normalized.toFixed(3)}</div>
          <div className="tap-loupe__dot" style={{ background: dotColor }} />
        </>
      )}
    </div>
  );
}
