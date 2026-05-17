"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type RatePayload = {
  rate: number;
  asOf: string;
  sparkline: { date: string; rate: number }[];
};

type RateState = {
  data: RatePayload | null;
  error: boolean;
  pulse: boolean;
};

const RateContext = createContext<RateState>({ data: null, error: false, pulse: false });

const REFRESH_MS = 5 * 60 * 1000;
const PULSE_MS = 600;

export function RateProvider({ children }: { children: ReactNode }) {
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
    <RateContext.Provider value={{ data, error, pulse }}>
      {children}
    </RateContext.Provider>
  );
}

export function useRate() {
  return useContext(RateContext);
}
