// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

export default function AppBar({ onMenuClick }) {
  return (
    <header className="app-bar">
      <span className="app-bar__title">OSMViews</span>
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
