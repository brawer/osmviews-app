// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

import { githubIconDataUri, cc0IconDataUri } from '../lib/icons.js';

export default function Drawer({ open, onClose, buildVersion }) {
  return (
    <>
      <div
        className={`drawer-backdrop ${open ? 'drawer-backdrop--open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <nav className={`drawer ${open ? 'drawer--open' : ''}`} aria-label="Menu">
        <button type="button" className="drawer__close" onClick={onClose} aria-label="Close menu">
          ×
        </button>

        <section className="drawer__section">
          <h3>About</h3>
          <p>
            OSMViews is a world-wide ranking of geographic locations by how much they are looked at on
            OpenStreetMap-based maps, built from a trailing year of OpenStreetMap tile-log data and rebuilt weekly.
            {buildVersion && <> You're viewing the build from {buildVersion}.</>}
          </p>
          <a
            href="https://github.com/brawer/osmviews"
            target="_blank"
            rel="noreferrer"
            className="drawer__icon-link"
          >
            <img src={githubIconDataUri()} alt="" width="16" height="16" />
            brawer/osmviews
          </a>
        </section>

        <section className="drawer__section">
          <h3>Download</h3>
          <p>The raw GeoTIFF, its data package manifest, and full provenance (a CycloneDX bill of materials).</p>
          <a href="https://github.com/brawer/osmviews/blob/main/docs/downloads.md" target="_blank" rel="noreferrer">
            Download &amp; provenance docs
          </a>
        </section>

        <section className="drawer__section">
          <h3>Client libraries</h3>
          <p>Query the raster directly from your own code — both return a 0.0–1.0 rank per location.</p>
          <a href="https://github.com/brawer/osmviews-py" target="_blank" rel="noreferrer">
            osmviews-py (Python)
          </a>
          <a href="https://github.com/brawer/osmviews-rs" target="_blank" rel="noreferrer">
            osmviews-rs (Rust)
          </a>
        </section>

        <section className="drawer__section">
          <h3>Author</h3>
          <p className="drawer__author">
            <a href="https://brawer.ch/" target="_blank" rel="noreferrer">
              Sascha Brawer
            </a>
            <span aria-hidden="true"> · </span>
            sascha@brawer.ch
          </p>
        </section>

        <section className="drawer__section">
          <h3>Map tiles</h3>
          <p>
            <a href="https://openfreemap.org/" target="_blank" rel="noreferrer">
              OpenFreeMap
            </a>
            {' '}&middot;{' '}
            <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">
              OpenMapTiles
            </a>
            {' '}&middot; Data from{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>
          </p>
        </section>

        <section className="drawer__section drawer__section--license">
          <a
            href="https://creativecommons.org/publicdomain/zero/1.0/"
            target="_blank"
            rel="noreferrer"
            className="drawer__icon-link"
            aria-label="OSMViews data licensed CC0 1.0 Universal"
          >
            <img src={cc0IconDataUri()} alt="" width="16" height="16" />
            Public Domain
          </a>
        </section>
      </nav>
    </>
  );
}
