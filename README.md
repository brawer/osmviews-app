<!--
SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
SPDX-License-Identifier: MIT
-->

# osmviews-app

The map-centric web app at [osmviews.brawer.ch](https://osmviews.brawer.ch/) —
visualizes [OSMViews](https://github.com/brawer/osmviews), a world-wide
raster ranking of geographic locations by how much they're looked at on
OpenStreetMap-based maps.

A static Vite + React + [MapLibre GL](https://maplibre.org/) app. It reads the
published Cloud-Optimized GeoTIFF directly in the browser via
[`@geomatico/maplibre-cog-protocol`](https://github.com/geomatico/maplibre-cog-protocol)
(HTTP range requests, no tile server), color-ramps it client-side, and overlays
an [OpenFreeMap](https://openfreemap.org/) basemap for labels and boundaries.
Background in [brawer/osmviews#100](https://github.com/brawer/osmviews/issues/100).

## Development

```sh
npm ci
npm run dev
```

The dev server serves `/data/*` from a local copy of the pipeline's published
files (a `data/` folder at the repo root — gitignored, fetch it yourself from
[`osmviews.brawer.ch/data/datapackage.json`](https://osmviews.brawer.ch/data/datapackage.json)
per [downloads.md](https://github.com/brawer/osmviews/blob/main/docs/downloads.md)),
with real Range-request support so the client-side COG-reading code path is
exercised faithfully.

```sh
npm run build   # -> dist/
npm run lint
```

## Deployment

See [RELEASING.md](RELEASING.md) — deploys are triggered by a tagged release,
not every push to `main`.

## License

MIT — see [LICENSE](LICENSE).
