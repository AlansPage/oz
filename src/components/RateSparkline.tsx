// Calm, self-contained sparkline for the v2 rate widget.
//
// The shape is taken VERBATIM from the design reference
// (.design-handoff/rate-widget-v2/widget-rest.svg) — its climb → peak →
// valley → climb structure is intentional and must not be regenerated from a
// synthetic curve. Coordinates live in the reference's own viewBox space
// (the 148→360 right-hand slice).
//
// - draws itself left→right on mount (SVG stroke-dasharray, normalized via pathLength=1)
// - fades out on the left edge through an SVG mask so the line "emerges"
// - open circle marker at the current value
// All animation lives in globals.css (.oz-rate__spark*). No JS animation, no deps.

// Reference-space viewBox: the right-hand slice of the 360-wide source SVG.
const VB = { x: 148, y: 44, w: 212, h: 64 } as const;

// Path d-attribute reproduced from the reference lines/segments, joined into one
// polyline: start (low) → peak → valley → climb. Marker sits at the climbing end.
const SPARK_PATH = "M148.612 103.358 L239.612 48.358 L316.391 95.361 L350 55.5";
const MARKER = { cx: 352.5, cy: 52.5, r: 3 } as const;

export function RateSparkline() {
  return (
    <svg
      className="oz-rate__spark"
      viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
      role="presentation"
      aria-hidden
    >
      <defs>
        <linearGradient
          id="oz-rate-spark-fade"
          gradientUnits="userSpaceOnUse"
          x1={VB.x}
          y1="0"
          x2={VB.x + VB.w}
          y2="0"
        >
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.26" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="oz-rate-spark-mask">
          <rect x={VB.x} y={VB.y} width={VB.w} height={VB.h} fill="url(#oz-rate-spark-fade)" />
        </mask>
      </defs>

      <g mask="url(#oz-rate-spark-mask)">
        <path className="oz-rate__spark-path" d={SPARK_PATH} pathLength={1} />
      </g>

      <circle className="oz-rate__spark-dot" cx={MARKER.cx} cy={MARKER.cy} r={MARKER.r} />
    </svg>
  );
}
