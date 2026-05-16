"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkline } from "./Sparkline";

type RatePayload = {
  rate: number;
  asOf: string;
  sparkline: { date: string; rate: number }[];
};

const REFRESH_MS = 5 * 60 * 1000;
const PULSE_MS = 600;

function formatRate(n: number): string {
  return n.toFixed(2);
}

export function RateWidget() {
  const [data, setData] = useState<RatePayload | null>(null);
  const [error, setError] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevRate = useRef<number | null>(null);
  const pulseTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchRate() {
      try {
        const res = await fetch("/api/rate", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as RatePayload;
        if (cancelled) return;
        setError(false);

        if (prevRate.current !== null && prevRate.current !== json.rate) {
          setPulse(true);
          if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
          pulseTimer.current = window.setTimeout(() => setPulse(false), PULSE_MS);
        }
        prevRate.current = json.rate;
        setData(json);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    fetchRate();
    const id = window.setInterval(fetchRate, REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      if (pulseTimer.current) window.clearTimeout(pulseTimer.current);
    };
  }, []);

  const hasData = data && !error;

  return (
    <div
      className={`oz-rate-pill font-mono${pulse ? " oz-pulse-once" : ""}`}
      aria-label={hasData ? `1 тенге = ${formatRate(data!.rate)} вон` : "Курс недоступен"}
    >
      <span className="oz-rate-pill__sym">₸</span>
      <span className="oz-rate-pill__arrow">→</span>
      <span className="oz-rate-pill__sym">₩</span>
      <span className="oz-rate-pill__rate">
        {hasData ? formatRate(data!.rate) : "—"}
      </span>
      {hasData && data!.sparkline.length >= 2 && (
        <Sparkline values={data!.sparkline.map((p) => p.rate)} variant="pill" />
      )}
    </div>
  );
}
