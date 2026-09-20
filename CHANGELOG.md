# Changelog

## [0.1.6](https://github.com/brawer/osmviews-app/compare/v0.1.5...v0.1.6) (2026-09-20)


### 🐞 Fixes

* use nearest-neighbor resampling for the raster layer ([#28](https://github.com/brawer/osmviews-app/issues/28)) ([9a4f36d](https://github.com/brawer/osmviews-app/commit/9a4f36d32f9e035820949a4e65ca41cbd6a36aa0))

## [0.1.5](https://github.com/brawer/osmviews-app/compare/v0.1.4...v0.1.5) (2026-09-18)


### 🐞 Fixes

* MapLibre worker actually broken in Firefox -- prior "fix" never worked ([#24](https://github.com/brawer/osmviews-app/issues/24)) ([bb69ae2](https://github.com/brawer/osmviews-app/commit/bb69ae2b4eb1982965eba9004749c3456b30502f))
* move map attribution above the histogram card ([#22](https://github.com/brawer/osmviews-app/issues/22)) ([7695019](https://github.com/brawer/osmviews-app/commit/769501912d6a79d7056d9103afed750df6297e18))

## [0.1.4](https://github.com/brawer/osmviews-app/compare/v0.1.3...v0.1.4) (2026-09-18)


### 🐞 Fixes

* curate basemap labels, fix bridges/buildings over the raster ([#12](https://github.com/brawer/osmviews-app/issues/12)) ([#19](https://github.com/brawer/osmviews-app/issues/19)) ([dd4e9e2](https://github.com/brawer/osmviews-app/commit/dd4e9e2f4e64429a0a351b4938cb6232f7be3a58))
* remove the underline under the flower emoji link ([#21](https://github.com/brawer/osmviews-app/issues/21)) ([d99ed53](https://github.com/brawer/osmviews-app/commit/d99ed533ff6cb9a05ebeaaaba73d44474cca0eea))

## [0.1.3](https://github.com/brawer/osmviews-app/compare/v0.1.2...v0.1.3) (2026-09-18)


### 🐞 Fixes

* two Firefox-only bugs -- stuck histogram/click, and worker MIME type ([#14](https://github.com/brawer/osmviews-app/issues/14)) ([6a047e1](https://github.com/brawer/osmviews-app/commit/6a047e1fc0c4255b52be7dedb65d031352fa7830))

## [0.1.2](https://github.com/brawer/osmviews-app/compare/v0.1.1...v0.1.2) (2026-09-18)


### 🐞 Fixes

* the map never rendered the OSMViews layer on the live site ([#9](https://github.com/brawer/osmviews-app/issues/9)) ([91f9b50](https://github.com/brawer/osmviews-app/commit/91f9b503d5e67d7f0e52dbb4d38c8bc98b3f2fb2))


### 🏎️ Performance

* don't render basemap layers the opaque raster always hides ([#11](https://github.com/brawer/osmviews-app/issues/11)) ([537897c](https://github.com/brawer/osmviews-app/commit/537897c0dd221b60d1e4119e8f449d7c037ce0e5))

## [0.1.1](https://github.com/brawer/osmviews-app/compare/v0.1.0...v0.1.1) (2026-09-18)


### 🆕 Features

* add map-centric web app for OSMViews ([2de190f](https://github.com/brawer/osmviews-app/commit/2de190f70efb307b114c74be31b7353efbf09ffd))


### 🐞 Fixes

* cap map zoom at 14 ([#5](https://github.com/brawer/osmviews-app/issues/5)) ([9494241](https://github.com/brawer/osmviews-app/commit/9494241cadda38012ce9eacad75e2e4ef39dec68))
* pre-seed CHANGELOG.md with an SPDX header ([#6](https://github.com/brawer/osmviews-app/issues/6)) ([7fbc7ea](https://github.com/brawer/osmviews-app/commit/7fbc7ea14ea8ed407c3843dd6f0e9a03774068af))
* re-run PR-title lint on new commits, not just open/edit ([#8](https://github.com/brawer/osmviews-app/issues/8)) ([9e3c846](https://github.com/brawer/osmviews-app/commit/9e3c846872931173862b50ae2abf697cfd0c0fc5))
* slide the drawer in from the right edge ([#4](https://github.com/brawer/osmviews-app/issues/4)) ([57f3632](https://github.com/brawer/osmviews-app/commit/57f36326ad59ae58813990becdf6adc439695cb0))

<!--
SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
SPDX-License-Identifier: MIT
-->

## Changelog

All notable changes to this app are recorded here, maintained by
[release-please](https://github.com/googleapis/release-please) from the
Conventional Commit history. Versioning follows
[Semantic Versioning](https://semver.org); while the app is pre-1.0 a bump of
the **minor** version may be breaking — see
[RELEASING.md](RELEASING.md#choosing-the-version-number).
