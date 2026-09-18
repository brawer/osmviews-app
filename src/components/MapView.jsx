// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

import { useEffect, useRef } from 'react';
// MapLibre GL 6 dropped its UMD/default-export build; import as a namespace.
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
// MapLibre resolves its worker script at runtime relative to its own module
// URL, which only works when that file is served standalone. Our production
// build bundles maplibre-gl's code into one chunk instead, so that
// resolution points at a URL that was never emitted -- the CDN's SPA
// fallback then serves index.html (200, text/html) for it, which browsers
// correctly refuse to run as a module worker (blocked on MIME type). The
// `?url` import asks Vite to copy this file into dist/assets/ as its own
// hashed asset and give us the real URL, which setWorkerUrl() then points
// the library at explicitly.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { cogProtocol, colorScale, setColorFunction, locationValues } from '@geomatico/maplibre-cog-protocol';
import { readCogMeta } from '../lib/cogMeta.js';
import { currentRamp } from '../lib/ramp.js';
import { parseViewFromPath, makeViewStateSync } from '../lib/urlState.js';
import { loadMinimalBasemapStyle } from '../lib/basemapStyle.js';

const COG_SOURCE_ID = 'osmviews';
const COG_LAYER_ID = 'osmviews-raster';

let protocolRegistered = false;
function ensureCogProtocol() {
  if (!protocolRegistered) {
    maplibregl.setWorkerUrl(maplibreWorkerUrl);
    maplibregl.addProtocol('cog', cogProtocol);
    protocolRegistered = true;
  }
}

// A handful of sample points spanning the current viewport, used to
// approximate the visible value range for the histogram card's greyed-out
// range indicator (step 8 of the plan) -- a 4x4 grid of locationValues()
// calls is cheap (each reads one already-cached/nearby tile) and avoids
// reaching into the COG protocol's internal tile cache.
function sampleViewportPoints(bounds) {
  const points = [];
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      points.push({
        longitude: bounds.getWest() + ((bounds.getEast() - bounds.getWest()) * i) / steps,
        latitude: bounds.getSouth() + ((bounds.getNorth() - bounds.getSouth()) * j) / steps,
      });
    }
  }
  return points;
}

export default function MapView({ tiffUrl, onCogMeta, onViewportRange, onTapValue }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  // Promise, resolves once mapRef.current is set (the map is constructed).
  // Needed because construction is now deferred behind the basemap-style
  // fetch below: the effect that builds the COG layer runs in the same
  // commit as this one, so it can't just check `mapRef.current` synchronously
  // any more -- it awaits this instead, which works regardless of which
  // effect's async work actually finishes first.
  const mapReadyRef = useRef(null);
  const mapLoadedRef = useRef(null); // Promise, resolves once the map's own style has loaded
  const cogUrlRef = useRef(null);
  const smaxRef = useRef(null);

  useEffect(() => {
    ensureCogProtocol();
    let cancelled = false;
    let map;
    let resolveMapReady;
    mapReadyRef.current = new Promise((resolve) => {
      resolveMapReady = resolve;
    });

    // The style is fetched and trimmed (loadMinimalBasemapStyle) before the
    // map exists, rather than handing MapLibre the bare URL and removing
    // unwanted layers once loaded: by the time we could remove them, they'd
    // already have painted one frame of colorful basemap that the opaque
    // COG layer immediately covers -- exactly the flash this is meant to
    // avoid, just deferred a few dozen milliseconds.
    loadMinimalBasemapStyle().then((style) => {
      if (cancelled) return;
      const initialView = parseViewFromPath(window.location.pathname);
      map = new maplibregl.Map({
        container: containerRef.current,
        style,
        center: [initialView.lng, initialView.lat],
        zoom: initialView.zoom,
        maxZoom: 14,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      if (import.meta.env.DEV) window.__debugMap = map;
      // MapLibre's compact attribution starts expanded and only collapses
      // once the user drags the map (AttributionControl._updateCompact
      // opens it unconditionally on init; only its drag-triggered
      // _updateCompactMinimize ever removes maplibregl-compact-show).
      // Collapsed from the start reads better landing on the map fresh.
      // A single removal right after construction isn't enough: the
      // control starts "empty" (no source has reported its attribution
      // string yet) and only gets classed maplibregl-compact-show a beat
      // later, once that content loads in -- observed ~200ms later in
      // testing, overwriting an immediate removal. A one-shot
      // MutationObserver reacts whenever the class actually appears
      // (matching the exact same moment MapLibre itself decides to open
      // it) and disconnects right after, so it doesn't fight a later
      // legitimate click to expand it.
      const attrib = map.getContainer().querySelector('.maplibregl-ctrl-attrib');
      if (attrib) {
        const collapseOnce = () => {
          if (attrib.classList.contains('maplibregl-compact-show')) {
            attrib.classList.remove('maplibregl-compact-show');
            observer.disconnect();
          }
        };
        const observer = new MutationObserver(collapseOnce);
        observer.observe(attrib, { attributes: true, attributeFilter: ['class'] });
        collapseOnce();
      }
      // Wait for the style's `'style.load'` event, not the Map-level
      // `'load'` event and not `isStyleLoaded()` -- both of those
      // additionally require every initial source's tiles to finish
      // loading (MapLibre's `Style.loaded()` walks every tile manager),
      // which for a basemap covering the whole world at our starting zoom
      // took well over a minute in testing against the real CDN.
      // `addSource`/`addLayer` only need the style JSON/sprite/glyphs
      // parsed and sources/layers registered, which is exactly what
      // `'style.load'` (fired once, from inside `Style._load`) signals --
      // no tile data involved. Set up as a promise right alongside the
      // map, not a listener registered later: if the event already fired
      // by the time the COG metadata fetch resolves (a real race, worse
      // under React StrictMode's double-effect-invocation in dev, which
      // adds an extra async round trip before the *second*, real map
      // instance's setup starts), a listener attached after the fact
      // never fires and the layer silently never gets added.
      mapLoadedRef.current = new Promise((resolve) => map.once('style.load', resolve));

      const syncUrl = makeViewStateSync();
      map.on('moveend', () => {
        syncUrl({ zoom: map.getZoom(), lat: map.getCenter().lat, lng: map.getCenter().lng });
        if (cogUrlRef.current && smaxRef.current != null) {
          Promise.all(
            sampleViewportPoints(map.getBounds()).map((p) => locationValues(cogUrlRef.current, p, map.getZoom())),
          ).then((results) => {
            const values = results.map((r) => r?.[0]).filter((v) => Number.isFinite(v));
            if (values.length > 0) {
              onViewportRange({ min: Math.min(...values), max: Math.max(...values) });
            }
          });
        }
      });

      map.on('click', (e) => {
        if (!cogUrlRef.current || smaxRef.current == null) return;
        locationValues(cogUrlRef.current, { latitude: e.lngLat.lat, longitude: e.lngLat.lng }, map.getZoom()).then(
          (result) => {
            const value = result?.[0];
            if (!Number.isFinite(value)) return;
            const normalized = Math.min(1, Math.max(0, value / smaxRef.current));
            onTapValue({ value, normalized, lngLat: e.lngLat });
          },
        );
      });

      resolveMapReady();
    });

    return () => {
      cancelled = true;
      // Unblocks the COG-layer effect's `await mapReadyRef.current` if it's
      // still pending (unmounted before the style fetch resolved) -- its
      // own `cancelled` check right after makes this a clean no-op.
      resolveMapReady();
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; tiffUrl changes handled below
  }, []);

  // (Re)build the raster layer whenever the resolved data build changes.
  useEffect(() => {
    if (!tiffUrl) return;

    const cogUrl = new URL(tiffUrl, window.location.origin).href;
    let cancelled = false;

    async function setup() {
      // The map is constructed asynchronously (see mapReadyRef above), so
      // this can't just read mapRef.current synchronously -- it may not
      // exist yet even though this effect already ran.
      await mapReadyRef.current;
      if (cancelled) return;
      const map = mapRef.current;

      const [{ smax, histogram }] = await Promise.all([readCogMeta(cogUrl), mapLoadedRef.current]);
      if (cancelled) return;
      cogUrlRef.current = cogUrl;
      smaxRef.current = smax;
      onCogMeta({ smax, histogram });

      const interpolate = colorScale({ customColors: currentRamp(), min: 0, max: smax, isContinuous: true });
      setColorFunction(cogUrl, (pixel, color) => {
        const [r, g, b] = interpolate(pixel[0]);
        color.set([r, g, b, 255]); // fully opaque -- 0 (ocean/desert) is a real value, not "no data"
      });

      if (map.getSource(COG_SOURCE_ID)) return;
      map.addSource(COG_SOURCE_ID, { type: 'raster', url: `cog://${cogUrl}`, tileSize: 256 });
      // Insert above every polygon fill and line -- roads, waterways, water
      // itself -- but below administrative boundaries and the (curated,
      // see basemapStyle.js) text labels, so those stay legible over the
      // color layer. loadMinimalBasemapStyle() already trimmed everything
      // before the boundary layers out of the style entirely, so this
      // resolves to the very first remaining layer in practice; kept as a
      // real search (not just styleLayers[0]) so an unrelated style
      // without boundary_*-named layers still inserts before its first
      // symbol layer, keeping labels on top, same fallback
      // loadMinimalBasemapStyle() itself uses.
      const styleLayers = map.getStyle().layers ?? [];
      const beforeId = styleLayers.find((l) => l.id.startsWith('boundary') || l.type === 'symbol')?.id;
      map.addLayer(
        {
          id: COG_LAYER_ID,
          source: COG_SOURCE_ID,
          type: 'raster',
          paint: {
            // The COG's native resolution is ~z10 (Phase 0 finding in
            // brawer/osmviews#100); past z12 it's an overzoomed flat wash
            // with no more real detail, so fade it out and let the
            // basemap carry street-level detail instead.
            'raster-opacity': ['interpolate', ['linear'], ['zoom'], 10, 1, 13, 0.55],
          },
        },
        beforeId,
      );
    }
    setup().catch((err) => console.error('Failed to set up the OSMViews raster layer:', err));

    return () => {
      cancelled = true;
    };
  }, [tiffUrl, onCogMeta, onViewportRange, onTapValue]);

  return <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />;
}
