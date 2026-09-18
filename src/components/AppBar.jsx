// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

export default function AppBar({ onMenuClick }) {
  return (
    <header className="app-bar">
      <span className="app-bar__brand">
        <a
          href="https://brawer.ch/"
          target="_blank"
          rel="noreferrer"
          className="app-bar__logo"
          aria-label="Sascha Brawer's home page"
        >
          🌼
        </a>
        <span className="app-bar__title">
          <span className="app-bar__title-osm">OSM</span>
          <span className="app-bar__title-views">Views</span>
        </span>
      </span>
      <button
        type="button"
        className="app-bar__menu-button"
        onClick={onMenuClick}
        aria-label="Open menu"
        aria-haspopup="true"
      >
        ☰
      </button>
    </header>
  );
}
