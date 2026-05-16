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
  return Number(n).toPrecision(4);
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

  return (
    <div>
      <article
        className="rounded-lg p-5 bg-surface flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex-1 min-w-0">
          {error || !data ? (
            <div
              className="font-mono text-[24px] sm:text-[28px] leading-none tracking-tight"
              style={{ color: "var(--text-3)" }}
            >
              {error ? "Курс временно недоступен" : "—"}
            </div>
          ) : (
            <div
              className={`font-mono text-[32px] sm:text-[40px] leading-none tracking-tight text-text${
                pulse ? " oz-pulse-once" : ""
              }`}
            >
              1 ₸ = {formatRate(data.rate)} ₩
            </div>
          )}

          {data && !error && (
            <p className="mt-1.5 text-[12px] text-text-2">
              Средний рыночный курс · обновлён{" "}
              <span className="font-mono">{formatTime(data.asOf)}</span>
            </p>
          )}
        </div>

        {data && !error && data.sparkline.length >= 2 && (
          <div className="sm:flex-shrink-0">
            <Sparkline values={data.sparkline.map((p) => p.rate)} />
          </div>
        )}
      </article>

      <p className="mt-2 px-1 text-[11px] text-text-3">
        Это справочный курс. Ваша сделка может отличаться.
      </p>
    </div>
  );
}
