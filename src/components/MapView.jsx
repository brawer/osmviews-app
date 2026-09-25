// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

import { useEffect, useRef, useState } from 'react';
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
import { computeViewportRange } from '../lib/viewportRange.js';
import { addCogRasterLayer } from '../lib/cogLayer.js';
import { currentRamp } from '../lib/ramp.js';
import { parseViewFromPath, makeViewStateSync } from '../lib/urlState.js';
import { loadMinimalBasemapStyle } from '../lib/basemapStyle.js';
import TapLoupe from './TapLoupe.jsx';

let protocolRegistered = false;
function ensureCogProtocol() {
  if (!protocolRegistered) {
    maplibregl.setWorkerUrl(maplibreWorkerUrl);
    maplibregl.addProtocol('cog', cogProtocol);
    protocolRegistered = true;
  }
}

// Reports the current viewport's true value range, for the ramp card's
// dimming -- shared between the 'moveend' handler (pan/zoom) and the
// initial layer setup below (deep links, so dimming doesn't wait for the
// user's first pan). See viewportRange.js for why this reads the COG's
// overview pyramid instead of point-sampling.
function updateViewportRange(map, tiff, onViewportRange) {
  if (!tiff) return;
  computeViewportRange(tiff, map.getBounds()).then((range) => {
    if (range) onViewportRange(range);
  });
}

export default function MapView({ tiffUrl, onCogMeta, onViewportRange, onTapValue, tapValue }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  // mapInstance/cogReady mirror mapRef/cogUrlRef/smaxRef, set once each is
  // known, purely so TapLoupe (below) can receive them as props -- reading
  // a ref's .current during render isn't safe, and refs don't trigger a
  // re-render on their own when set from inside an effect anyway.
  const [mapInstance, setMapInstance] = useState(null);
  const [cogReady, setCogReady] = useState(null); // { cogUrl, smax }
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
  const cogTiffRef = useRef(null);

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
        // Attribution lives in the drawer instead (Drawer.jsx) -- still one
        // click away, but not a permanent overlay competing with the
        // ramp card for the map's bottom corners.
        attributionControl: false,
      });
      mapRef.current = map;
      setMapInstance(map);
      if (import.meta.env.DEV) window.__debugMap = map;
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
        updateViewportRange(map, cogTiffRef.current, onViewportRange);
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

      const [{ smax, tiff }] = await Promise.all([readCogMeta(cogUrl), mapLoadedRef.current]);
      if (cancelled) return;
      cogUrlRef.current = cogUrl;
      smaxRef.current = smax;
      cogTiffRef.current = tiff;
      setCogReady({ cogUrl, smax });
      onCogMeta({ smax });

      const interpolate = colorScale({ customColors: currentRamp(), min: 0, max: smax, isContinuous: true });
      setColorFunction(cogUrl, (pixel, color) => {
        const [r, g, b] = interpolate(pixel[0]);
        color.set([r, g, b, 255]); // fully opaque -- 0 (ocean/desert) is a real value, not "no data"
      });

      // Past z12 the COG's native ~z10 resolution is an overzoomed flat
      // wash with no more real detail, so fade it out there and let the
      // basemap carry street-level detail instead.
      addCogRasterLayer(map, cogUrl, ['interpolate', ['linear'], ['zoom'], 10, 1, 13, 0.55]);
      // 'idle' fires once every source has finished loading and a frame has
      // rendered -- including near-instantly if these tiles are already
      // cached, matching the "or, if cached, immediately" case.
      map.once('idle', () => {
        if (cancelled) return;
        updateViewportRange(map, tiff, onViewportRange);
      });
    }
    setup().catch((err) => console.error('Failed to set up the OSMViews raster layer:', err));

    return () => {
      cancelled = true;
    };
  }, [tiffUrl, onCogMeta, onViewportRange, onTapValue]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      {mapInstance && cogReady && (
        <TapLoupe
          map={mapInstance}
          tapValue={tapValue}
          cogUrl={cogReady.cogUrl}
          smax={cogReady.smax}
          onTapValue={onTapValue}
        />
      )}
    </div>
  );
}
