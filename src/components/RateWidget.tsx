"use client";

import { useRef } from "react";
import { Sparkline } from "./Sparkline";
import { Sparkler } from "./Sparkler";
import { useRate } from "./feed/RateContext";

function formatRate(n: number): string {
  return n.toFixed(2);
}

export function RateWidget() {
  const { data, error, pulse } = useRate();
  const donutRef = useRef<SVGGElement>(null);

  const hasData = data && !error;

  return (
    <div
      className={`oz-rate-pill${pulse ? " oz-pulse-once" : ""}`}
      aria-label={hasData ? `1 тенге = ${formatRate(data!.rate)} вон` : "Курс недоступен"}
    >
      <span className="oz-rate-pill__sym">₸</span>
      <span className="oz-rate-pill__arrow">→</span>
      <span className="oz-rate-pill__sym">₩</span>
      <span className="oz-rate-pill__rate">
        {hasData ? formatRate(data!.rate) : "—"}
      </span>
      {hasData && data!.sparkline.length >= 2 && (
        <>
          <Sparkline values={data!.sparkline.map((p) => p.rate)} variant="pill" donutRef={donutRef} />
          <Sparkler sourceRef={donutRef} />
        </>
      )}
    </div>
  );
}
