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
// Tapping inside the loupe re-taps at the point under the pointer as
// seen through the loupe's own map, not the main map's: at any given
// screen pixel inside the circle, the loupe is showing a different, more
// zoomed-in place than what's at that same pixel on the main map
// underneath, so the two would disagree about which location was
// actually tapped. Dragging inside the loupe slides it across the map,
// and pinching zooms and rotates the map underneath it.

import { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { colorScale, locationValues } from '@geomatico/maplibre-cog-protocol';
import { addCogRasterLayer, COG_LAYER_ID } from '../lib/cogLayer.js';
import { isInView } from '../lib/inView.js';
import { currentRamp } from '../lib/ramp.js';
import { loadMinimalBasemapStyle } from '../lib/basemapStyle.js';

const LOUPE_SIZE = 160; // px, keep in sync with app.css's .tap-loupe
const ZOOM_OFFSET = 2;
const TAP_TOLERANCE = 4; // px a press may move and still count as a tap

export default function TapLoupe({ map, tapValue, cogUrl, smax, onTapValue }) {
  const containerRef = useRef(null);
  const loupeMapRef = useRef(null);
  const [loupeReady, setLoupeReady] = useState(false);
  const [screenPos, setScreenPos] = useState(null);
  // While dragging, where the loupe has been slid to; it takes over from
  // tapValue as the loupe's focus point until the drag's final spot has
  // been looked up and handed back through onTapValue.
  const [dragLngLat, setDragLngLat] = useState(null);
  const focus = dragLngLat ?? tapValue?.lngLat ?? null;
  const focusRef = useRef(focus);

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
        // No fade-in for labels (and, below, for raster tiles): measured,
        // MapLibre's default 300 ms fades made every tap wait another
        // 300-600 ms after the last tile had already arrived -- even with
        // every tile cached. A magnifier should show its content
        // right away; the main map keeps its fades.
        fadeDuration: 0,
      });
      loupeMapRef.current = loupeMap;
      loupeMap.once('style.load', () => {
        if (cancelled) return;
        addCogRasterLayer(loupeMap, cogUrl);
        loupeMap.setPaintProperty(COG_LAYER_ID, 'raster-fade-duration', 0);
        setLoupeReady(true);
      });
    });
    return () => {
      cancelled = true;
      loupeMapRef.current?.remove();
      loupeMapRef.current = null;
    };
  }, [cogUrl]);

  // Center the loupe on its focus point whenever that changes (a new tap,
  // or a drag sliding it along -- see below), and keep it in step with the
  // main map from then on: always ZOOM_OFFSET levels deeper than the main
  // map's zoom, and rotated by the same bearing. A plain pan changes
  // neither, only where the loupe sits on screen (see below), so skip the
  // jumpTo then.
  useEffect(() => {
    if (!focus || !loupeReady) return;
    const loupeMap = loupeMapRef.current;
    loupeMap.jumpTo({ center: focus, zoom: map.getZoom() + ZOOM_OFFSET, bearing: map.getBearing() });
    const sync = () => {
      const zoom = map.getZoom() + ZOOM_OFFSET;
      const bearing = map.getBearing();
      if (zoom === loupeMap.getZoom() && bearing === loupeMap.getBearing()) return;
      loupeMap.jumpTo({ zoom, bearing });
    };
    map.on('move', sync);
    return () => map.off('move', sync);
  }, [focus, loupeReady, map]);

  // Track the focus point's screen position as the main map pans, so the
  // loupe stays visually pinned over the place it's showing -- subscribes
  // only while there's a point to track; render below derives "hidden"
  // from tapValue directly rather than resetting state up front here.
  useEffect(() => {
    if (!focus) return;
    const update = () => {
      const p = map.project(focus);
      setScreenPos(isInView(map, p) ? p : null);
    };
    update();
    map.on('move', update);
    return () => map.off('move', update);
  }, [map, focus]);

  // For the gesture handlers below, which are registered once rather than
  // on every drag frame, and read the current focus point at event time.
  useEffect(() => {
    focusRef.current = focus;
  }, [focus]);

  // One-finger drag (or mouse drag) slides the loupe across the map, like
  // moving a magnifying glass over paper: the main map stays put, and the
  // loupe follows the pointer 1:1 at the main map's scale, so it stays
  // under the finger. (At the loupe's own scale it would lag the finger
  // 2^ZOOM_OFFSET = 4x behind and slip off it within a short drag.) The
  // value is looked up as it goes, so the dot, label and ramp card read
  // out what's under the loupe while scrubbing.
  //
  // A tap -- a press that moves less than TAP_TOLERANCE -- re-taps instead,
  // at the point under the pointer as unprojected through the loupe's own
  // (more zoomed-in) view, exactly the coordinate the user is pointing
  // at; that's what makes it a "drill in for more precision" interaction.
  // It's handled here rather than with the loupe map's click event:
  // MapLibre only fires that if the pointer moved less than its click
  // tolerance *within the loupe map*, and since the loupe moves along with
  // the pointer while dragging, a drag would pass that check too.
  //
  // Lookups are async, so at most one is in flight at a time; when it
  // resolves for a spot the loupe has since moved past, its result is
  // dropped and the newest spot looked up instead, so the readout never
  // shows a value for a place the loupe isn't over. In between, the
  // readout is marked stale (see render below).
  useEffect(() => {
    if (!loupeReady) return;
    const el = containerRef.current;
    const loupeMap = loupeMapRef.current;
    const pointers = new Set();
    let gesture = null; // { id, startX, startY, startPoint, x, y, dragging }
    let frame = 0;
    let latest = null; // newest drag target
    let inFlight = false;
    let dragEnded = true;
    let disposed = false;

    const lookup = (lngLat) =>
      locationValues(cogUrl, { latitude: lngLat.lat, longitude: lngLat.lng }, loupeMap.getZoom()).then(
        (result) => {
          const value = result?.[0];
          if (!Number.isFinite(value) || smax == null) return null;
          return { value, normalized: Math.min(1, Math.max(0, value / smax)), lngLat };
        },
        () => null,
      );

    // Look up the newest drag target, unless a lookup is already running
    // (whose completion then calls this again if it's been overtaken).
    // Once the drag has ended and its final spot is looked up, hand the
    // focus back from the drag to tapValue -- in the same tick as the
    // onTapValue for that spot, so the loupe doesn't jump. (If that last
    // spot has no value, it falls back to the last one that did.)
    const settle = () => {
      if (inFlight || !latest) return;
      const target = latest;
      inFlight = true;
      lookup(target).then((tap) => {
        inFlight = false;
        if (disposed) return;
        if (target !== latest) {
          settle();
          return;
        }
        if (tap) onTapValue(tap);
        if (dragEnded) {
          latest = null;
          setDragLngLat(null);
        }
      });
    };

    const moveTo = (clientX, clientY) => {
      const container = map.getContainer();
      const x = Math.min(container.clientWidth, Math.max(0, gesture.startPoint.x + clientX - gesture.startX));
      const y = Math.min(container.clientHeight, Math.max(0, gesture.startPoint.y + clientY - gesture.startY));
      latest = map.unproject([x, y]);
      setDragLngLat(latest);
      settle();
    };

    const endDrag = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      dragEnded = true;
      settle();
    };

    const onPointerDown = (e) => {
      pointers.add(e.pointerId);
      if (pointers.size > 1) {
        // A second finger: the pinch handler below takes over.
        if (gesture?.dragging) endDrag();
        gesture = null;
        return;
      }
      if (e.button !== 0 || !focusRef.current) return;
      if (e.pointerType === 'mouse') e.preventDefault(); // no text selection
      el.setPointerCapture(e.pointerId);
      gesture = {
        id: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startPoint: map.project(focusRef.current),
        dragging: false,
      };
    };

    const onPointerMove = (e) => {
      if (gesture?.id !== e.pointerId) return;
      if (!gesture.dragging) {
        if (Math.hypot(e.clientX - gesture.startX, e.clientY - gesture.startY) < TAP_TOLERANCE) return;
        gesture.dragging = true;
        dragEnded = false;
      }
      gesture.x = e.clientX;
      gesture.y = e.clientY;
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          moveTo(gesture.x, gesture.y);
        });
      }
    };

    const onPointerUp = (e) => {
      pointers.delete(e.pointerId);
      if (gesture?.id !== e.pointerId) return;
      if (gesture.dragging) {
        moveTo(e.clientX, e.clientY);
        endDrag();
      } else {
        const rect = el.getBoundingClientRect();
        lookup(loupeMap.unproject([e.clientX - rect.left, e.clientY - rect.top])).then((tap) => {
          if (tap && !disposed) onTapValue(tap);
        });
      }
      gesture = null;
    };

    const onPointerCancel = (e) => {
      pointers.delete(e.pointerId);
      if (gesture?.id !== e.pointerId) return;
      if (gesture.dragging) endDrag();
      gesture = null;
    };

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerCancel);
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerCancel);
    };
  }, [loupeReady, map, cogUrl, smax, onTapValue]);

  // Pinch-zoom/rotate and wheel/trackpad zoom inside the loupe drive the
  // main map, exactly like the same gesture on the main map would (the
  // sync effect above then carries the loupe along). Without this, the
  // gesture lands on the non-interactive loupe and falls through to the
  // browser, which zooms the whole page instead. Both pivot on the
  // loupe's focus point rather than the fingers/pointer, so the loupe
  // stays put over its point while the map zooms and turns underneath it.
  useEffect(() => {
    if (!loupeReady) return;
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
      if (!pinch || e.touches.length !== 2 || !focusRef.current) return;
      e.preventDefault();
      const { dist, angle } = fingers(e.touches);
      if (!pinch.dist) return;
      map.easeTo({
        zoom: pinch.zoom + Math.log2(dist / pinch.dist),
        // Fingers turning clockwise on screen turn the map clockwise too,
        // which is a decreasing bearing.
        bearing: pinch.bearing - ((angle - pinch.angle) * 180) / Math.PI,
        around: focusRef.current,
        duration: 0,
      });
    };
    const onTouchEnd = (e) => {
      if (e.touches.length < 2) pinch = null;
    };

    // Wheel and trackpad pinch (which browsers report as ctrl+wheel):
    // hand the event on to the main map's own scroll-zoom handler, so it
    // keeps MapLibre's wheel-vs-trackpad detection and smoothing, but with
    // the pointer moved onto the focus point to pivot the zoom there.
    const onWheel = (e) => {
      e.preventDefault();
      if (!focusRef.current) return;
      const p = map.project(focusRef.current);
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
  }, [loupeReady, map]);
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
  // Mid-drag, until the lookup for the loupe's current spot comes back,
  // the dot and label still show the previous spot's value.
  const stale = dragLngLat != null && tapValue?.lngLat !== dragLngLat;

  return (
    <div
      className={stale ? 'tap-loupe tap-loupe--stale' : 'tap-loupe'}
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
