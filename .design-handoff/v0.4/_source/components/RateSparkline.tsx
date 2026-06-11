// Calm, self-contained sparkline for the v2 rate widget.
// - draws itself left→right on mount (SVG stroke-dasharray, normalized via pathLength=1)
// - fades out on the left edge through an SVG mask so the line "emerges"
// - open circle marker at the current value; it repositions smoothly on rate updates
// All animation lives in globals.css (.oz-rate__spark*). No JS animation, no deps.

// Fixed coordinate space; CSS controls the rendered size (responsive in globals.css).
const VB_W = 120;
const VB_H = 44;
const PAD = 6;

type Props = {
  values: number[];
};

export function RateSparkline({ values }: Props) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;
  const span = flat ? 1 : max - min;

  const innerW = VB_W - PAD * 2;
  const innerH = VB_H - PAD * 2;
  const stepX = innerW / (values.length - 1);

  const points = values.map((v, i) => {
    const x = PAD + i * stepX;
    const y = flat ? VB_H / 2 : VB_H - PAD - ((v - min) / span) * innerH;
    return [x, y] as const;
  });

  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  const [dotX, dotY] = points[points.length - 1];

  return (
    <svg
      className="oz-rate__spark"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      role="presentation"
      aria-hidden
    >
      <defs>
        <linearGradient
          id="oz-rate-spark-fade"
          gradientUnits="userSpaceOnUse"
          x1="0"
          y1="0"
          x2={VB_W}
          y2="0"
        >
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.28" stopColor="#fff" stopOpacity="1" />
        </linearGradient>
        <mask id="oz-rate-spark-mask">
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#oz-rate-spark-fade)" />
        </mask>
      </defs>

      <g mask="url(#oz-rate-spark-mask)">
        <path className="oz-rate__spark-path" d={d} pathLength={1} />
      </g>

      <circle className="oz-rate__spark-dot" cx={dotX.toFixed(2)} cy={dotY.toFixed(2)} r={4} />
    </svg>
  );
}
