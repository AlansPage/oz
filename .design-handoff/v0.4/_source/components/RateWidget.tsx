"use client";

import { RateSparkline } from "./RateSparkline";
import { useRate } from "./feed/RateContext";

const rateFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatRate(n: number): string {
  return rateFormatter.format(n);
}

// Hollow, outline-only right-pointing triangle — the direction indicator.
// Deliberately NOT a filled play glyph.
function DirectionTriangle() {
  return (
    <svg
      className="oz-rate__tri"
      width={20}
      height={20}
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden
    >
      <path
        d="M6 4.5 L15 10 L6 15.5 Z"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function RateWidget() {
  const { data, error, pulse } = useRate();

  const hasData = Boolean(data) && !error;
  const values = hasData ? data!.sparkline.map((p) => p.rate) : [];

  return (
    <div
      className="oz-rate"
      aria-label={hasData ? `1 тенге = ${formatRate(data!.rate)} вон` : "Курс недоступен"}
    >
      <div className="oz-rate__row">
        <span className="oz-rate__icons">
          <span className="oz-rate__sym">₸</span>
          <DirectionTriangle />
          <span className="oz-rate__sym">₩</span>
        </span>

        {error ? (
          <span className="oz-rate__num oz-rate__num--err">—</span>
        ) : hasData ? (
          <span className="oz-rate__num">
            <span className={`oz-rate__num-inner${pulse ? " oz-rate__num-inner--pulse" : ""}`}>
              {formatRate(data!.rate)}
            </span>
          </span>
        ) : (
          <span
            className="oz-skeleton oz-rate__num-skel"
            aria-hidden
          />
        )}

        {hasData && values.length >= 2 && <RateSparkline values={values} />}
      </div>

      {error && <span className="oz-rate__sub">Курс временно недоступен</span>}
    </div>
  );
}
