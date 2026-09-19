// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// The value-density color ramp, as plain hex stops -- kept here as the one
// source of truth, read into CSS custom properties (theme.css) for the UI
// and passed to @geomatico/maplibre-cog-protocol's colorScale() for the map
// layer, so both stay in sync. See theme.css for the design rationale.
export const RAMP_LIGHT = ['#1a3a5c', '#3d6f96', '#e3b56a', '#e2823f', '#c1523a', '#8c3f5c'];
export const RAMP_DARK = ['#4488b8', '#6aa0c9', '#e3b56a', '#e2823f', '#d5636b', '#e2a0bc'];

export function prefersDark() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

export function currentRamp() {
  return prefersDark() ? RAMP_DARK : RAMP_LIGHT;
}
