// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

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
          <a href="https://github.com/brawer/osmviews" target="_blank" rel="noreferrer">
            brawer/osmviews on GitHub
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
          <a href="https://brawer.ch/" target="_blank" rel="noreferrer">
            brawer.ch
          </a>
        </section>

        <section className="drawer__section drawer__section--license">
          <a
            href="https://creativecommons.org/publicdomain/zero/1.0/"
            target="_blank"
            rel="noreferrer"
            aria-label="Data licensed CC0 1.0 Universal"
          >
            CC0 · Public Domain
          </a>
        </section>
      </nav>
    </>
  );
}
