import { NextResponse } from "next/server";

// The /feed widget hits this on mount + every 5 min. The third-party CDN sees at
// most one request per region per `revalidate` window, regardless of users connected.
export const dynamic = "force-dynamic";

const LATEST_URL =
  "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/kzt.json";

const historyUrl = (date: string) =>
  `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/kzt.json`;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastNDates(n: number): string[] {
  const today = new Date();
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - (n - 1 - i));
    return isoDate(d);
  });
}

type CurrencyApiResponse = {
  date: string;
  kzt?: Record<string, number>;
};

function extractKrwRate(payload: unknown): number | null {
  const p = payload as CurrencyApiResponse | null;
  const kzt = p?.kzt;
  if (!kzt) return null;
  const v = kzt["krw"] ?? kzt["KRW"];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

async function fetchJson(
  url: string,
  revalidate: number,
): Promise<CurrencyApiResponse | null> {
  try {
    const res = await fetch(url, { next: { revalidate } });
    if (!res.ok) return null;
    return (await res.json()) as CurrencyApiResponse;
  } catch {
    return null;
  }
}

export async function GET() {
  const dates = lastNDates(7);

  const [latest, ...historical] = await Promise.all([
    fetchJson(LATEST_URL, 300),
    ...dates.map((d) => fetchJson(historyUrl(d), 86400)),
  ]);

  const rate = extractKrwRate(latest);
  if (rate === null) {
    return NextResponse.json(
      { error: "rate_unavailable" },
      { status: 503 },
    );
  }

  const sparkline = historical
    .map((res, i) => {
      const r = extractKrwRate(res);
      return r === null ? null : { date: dates[i], rate: r };
    })
    .filter((x): x is { date: string; rate: number } => x !== null);

  return NextResponse.json({
    rate,
    asOf: new Date().toISOString(),
    sparkline,
  });
}
