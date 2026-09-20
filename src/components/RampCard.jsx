// SPDX-FileCopyrightText: 2026 Sascha Brawer <sascha@brawer.ch>
// SPDX-License-Identifier: MIT

// Not a histogram: the actual bin counts weren't visually interesting
// (see the mockup rounds this replaced), and dimming the covered/
// uncovered parts of the color ramp plus a tap marker says more with less
// ink. Ramp colors come from theme.css's --ramp-0..--ramp-5 so this stays
// in sync with the map layer and the light/dark theme without any
// JS-side color table.

const W = 300;
const H = 50;
const PAD_L = 4;
const PAD_R = 4;
const BAR_Y = 18;
const BAR_H = 16;
const PLOT_W = W - PAD_L - PAD_R;

// Maps a raw pixel value (domain [0, smax]) to an SVG x-coordinate.
function sx(value, smax) {
  const clamped = Math.max(0, Math.min(smax, value));
  return PAD_L + (clamped / smax) * PLOT_W;
}

// Keeps a label's text-anchor from running off the edge of the viewBox.
function edgeAwareAnchor(x) {
  if (x < 24) return 'start';
  if (x > W - 24) return 'end';
  return 'middle';
}

export default function RampCard({ smax, viewportRange, tapValue }) {
  // MapView only ever reports a viewportRange/tapValue once smax itself has
  // loaded (both are gated on smaxRef.current there), so these stay null
  // together with smax -- rendering the bare pill in the meantime instead
  // of a "Loading..." placeholder avoids a state swap/flicker for what's
  // otherwise a near-instant load.
  const loX = smax && viewportRange ? sx(viewportRange.min, smax) : null;
  const hiX = smax && viewportRange ? sx(viewportRange.max, smax) : null;
  const showDimLeft = smax && viewportRange && viewportRange.min > 0;
  const showDimRight = smax && viewportRange && viewportRange.max < smax;

  const markerX = smax && tapValue ? sx(tapValue.value, smax) : null;

  return (
    <div className="ramp-card">
      <svg
        className="ramp-card__viz"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="View-density color ramp, showing the range visible in the current map view"
      >
        <defs>
          <linearGradient id="ramp-gradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" className="ramp-card__stop ramp-card__stop--0" />
            <stop offset="20%" className="ramp-card__stop ramp-card__stop--1" />
            <stop offset="40%" className="ramp-card__stop ramp-card__stop--2" />
            <stop offset="60%" className="ramp-card__stop ramp-card__stop--3" />
            <stop offset="80%" className="ramp-card__stop ramp-card__stop--4" />
            <stop offset="100%" className="ramp-card__stop ramp-card__stop--5" />
          </linearGradient>
          <clipPath id="ramp-pill-clip">
            <rect x={PAD_L} y={BAR_Y} width={PLOT_W} height={BAR_H} rx={BAR_H / 2} />
          </clipPath>
        </defs>

        <g clipPath="url(#ramp-pill-clip)">
          <rect x={PAD_L} y={BAR_Y} width={PLOT_W} height={BAR_H} fill="url(#ramp-gradient)" />
          {showDimLeft && (
            <rect className="ramp-card__dim" x={PAD_L} y={BAR_Y} width={loX - PAD_L} height={BAR_H} />
          )}
          {showDimRight && (
            <rect
              className="ramp-card__dim"
              x={hiX}
              y={BAR_Y}
              width={PAD_L + PLOT_W - hiX}
              height={BAR_H}
            />
          )}
        </g>

        {showDimLeft && (
          <text
            className="ramp-card__bound-label"
            x={loX < 24 ? loX + 3 : loX - 3}
            y={BAR_Y + BAR_H + 15}
            textAnchor={loX < 24 ? 'start' : 'end'}
          >
            {(viewportRange.min / smax).toFixed(3)}
          </text>
        )}
        {showDimRight && (
          <text
            className="ramp-card__bound-label"
            x={hiX > W - 24 ? hiX - 3 : hiX + 3}
            y={BAR_Y + BAR_H + 15}
            textAnchor={hiX > W - 24 ? 'end' : 'start'}
          >
            {(viewportRange.max / smax).toFixed(3)}
          </text>
        )}

        {tapValue && (
          <>
            <line
              className="ramp-card__marker"
              x1={markerX}
              x2={markerX}
              y1={BAR_Y - 5}
              y2={BAR_Y + BAR_H + 5}
            />
            <text
              className="ramp-card__marker-label"
              x={markerX}
              y={BAR_Y - 9}
              textAnchor={edgeAwareAnchor(markerX)}
            >
              {tapValue.normalized.toFixed(3)}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
