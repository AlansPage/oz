type Variant = "default" | "pill";

type Props = {
  values: number[];
  width?: number;
  height?: number;
  variant?: Variant;
};

const VARIANT_DEFAULTS: Record<Variant, { width: number; height: number; stroke: string; strokeWidth: number; opacity: number }> = {
  default: { width: 120, height: 32, stroke: "var(--primary)", strokeWidth: 1.5, opacity: 0.6 },
  pill: { width: 64, height: 26, stroke: "var(--primary)", strokeWidth: 2.5, opacity: 0.95 },
};

export function Sparkline({ values, width, height, variant = "default" }: Props) {
  if (values.length < 2) return null;

  const defaults = VARIANT_DEFAULTS[variant];
  const w = width ?? defaults.width;
  const h = height ?? defaults.height;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;
  const span = flat ? 1 : max - min;

  const stepX = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = flat ? h / 2 : h - ((v - min) / span) * h;
    return [x, y] as const;
  });

  const d = points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");

  const [lastX, lastY] = points[points.length - 1];
  const isPill = variant === "pill";
  const donutR = 5;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden
      style={{ overflow: "visible" }}
    >
      <path
        d={d}
        fill="none"
        stroke={defaults.stroke}
        strokeWidth={defaults.strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={defaults.opacity}
      />
      {isPill && (
        <g className="oz-donut">
          {/* glossy white inner core */}
          <circle cx={lastX} cy={lastY} r={donutR - 1.4} fill="rgba(255,255,255,0.92)" />
          {/* deep green ring */}
          <circle
            cx={lastX}
            cy={lastY}
            r={donutR}
            fill="none"
            stroke="var(--primary)"
            strokeWidth={1.8}
          />
          {/* tiny specular highlight */}
          <circle
            cx={lastX - 1.2}
            cy={lastY - 1.4}
            r={0.9}
            fill="rgba(255,255,255,0.95)"
          />
          {/* firework sparks radiating outward */}
          {Array.from({ length: 8 }).map((_, i) => {
            const angle = (i / 8) * Math.PI * 2;
            const dist = 9 + (i % 2) * 2.5;
            const cx = lastX + Math.cos(angle) * dist;
            const cy = lastY + Math.sin(angle) * dist;
            return (
              <circle
                key={i}
                className="oz-spark"
                cx={cx}
                cy={cy}
                r={1.25}
                fill="var(--primary)"
                style={{ animationDelay: `${(i * 0.18).toFixed(2)}s` }}
              />
            );
          })}
        </g>
      )}
    </svg>
  );
}
