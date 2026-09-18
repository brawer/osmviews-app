// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

import { useEffect, useRef } from 'react';
// MapLibre GL 6 dropped its UMD/default-export build; import as a namespace.
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { cogProtocol, colorScale, setColorFunction, locationValues } from '@geomatico/maplibre-cog-protocol';
import { readCogMeta } from '../lib/cogMeta.js';
import { currentRamp } from '../lib/ramp.js';
import { parseViewFromPath, makeViewStateSync } from '../lib/urlState.js';

const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const COG_SOURCE_ID = 'osmviews';
const COG_LAYER_ID = 'osmviews-raster';

let protocolRegistered = false;
function ensureCogProtocol() {
  if (!protocolRegistered) {
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
  const mapLoadedRef = useRef(null); // Promise, resolves once the map's own style has loaded
  const cogUrlRef = useRef(null);
  const smaxRef = useRef(null);

  useEffect(() => {
    ensureCogProtocol();
    const initialView = parseViewFromPath(window.location.pathname);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE,
      center: [initialView.lng, initialView.lat],
      zoom: initialView.zoom,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    // Gate layer setup on this instead of a bare `map.once('load', ...)`
    // registered later: if 'load' already fired by the time the COG
    // metadata fetch resolves (a real race, worse under React StrictMode's
    // double-effect-invocation in dev, which adds an extra async round
    // trip before the *second*, real map instance's setup starts), a
    // listener attached after the fact never fires and the layer silently
    // never gets added. A promise created right alongside the map can't
    // miss the event.
    mapLoadedRef.current = new Promise((resolve) => map.once('load', resolve));

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

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map is created once; tiffUrl changes handled below
  }, []);

  // (Re)build the raster layer whenever the resolved data build changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tiffUrl) return;

    const cogUrl = new URL(tiffUrl, window.location.origin).href;
    let cancelled = false;

    async function setup() {
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
      // itself -- but below administrative boundaries and text/icon labels,
      // so those stay legible over the color layer. OpenFreeMap's "liberty"
      // style draws boundary_* well before any label layer, so "the first
      // boundary_* or symbol layer, whichever comes first" is the
      // insertion point. (Not fully style-agnostic -- an unrelated style
      // without boundary_*-named layers falls back to "before the first
      // symbol layer", which still keeps labels on top.)
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
