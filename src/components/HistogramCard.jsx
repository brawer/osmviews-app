// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

import { useMemo } from 'react';
import { currentRamp, rampCssGradient } from '../lib/ramp.js';

// Bars are log-scaled -- the RAT's own bucket-0 count (everywhere the
// density rounds to zero: most of the planet) dwarfs every other bucket by
// 2-4 orders of magnitude, exactly as docs/downloads.md warns ("plot the
// counts on a log axis").
function barHeight(count, maxLogCount) {
  if (count <= 0 || maxLogCount === 0) return 0;
  return Math.log10(count + 1) / maxLogCount;
}

export default function HistogramCard({ histogram, smax, buildVersion, viewportRange, tapValue }) {
  const ramp = useMemo(() => currentRamp(), []);
  const gradient = useMemo(() => rampCssGradient(ramp), [ramp]);

  const maxLogCount = useMemo(() => {
    if (!histogram) return 0;
    return Math.max(...histogram.bins.map((b) => Math.log10(b.count + 1)));
  }, [histogram]);

  if (!histogram || !smax) {
    return (
      <div className="histogram-card histogram-card--loading">
        <span>Loading data distribution…</span>
      </div>
    );
  }

  const markerPct = tapValue ? (tapValue.value / smax) * 100 : null;

  return (
    <div className="histogram-card">
      <div className="histogram-card__bars">
        {histogram.bins.map((bin, i) => {
          const mid = (bin.min + bin.max) / 2;
          const inViewport = !viewportRange || (mid >= viewportRange.min && mid <= viewportRange.max);
          return (
            <div
              key={i}
              className="histogram-card__bar"
              style={{
                height: `${barHeight(bin.count, maxLogCount) * 100}%`,
                background: ramp[Math.min(ramp.length - 1, Math.floor((mid / smax) * ramp.length))],
                opacity: inViewport ? 1 : 0.25,
              }}
            />
          );
        })}
        {markerPct !== null && <div className="histogram-card__marker" style={{ left: `${markerPct}%` }} />}
      </div>
      <div className="histogram-card__ramp-strip" style={{ background: gradient }} />
      <div className="histogram-card__footer">
        <span className="histogram-card__version">Build {buildVersion}</span>
        {tapValue && (
          <span className="histogram-card__tap-value">
            Selected: <strong>{tapValue.normalized.toFixed(2)}</strong> (0.0–1.0)
          </span>
        )}
      </div>
    </div>
  );
}
