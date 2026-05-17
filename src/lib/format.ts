import type { Currency } from "./types";

const CURRENCY_SYMBOL: Record<Currency, string> = {
  KZT: "₸",
  KRW: "₩",
};

const amountFormatter = new Intl.NumberFormat("ru-RU", {
  maximumFractionDigits: 0,
});

const rateFormatter = new Intl.NumberFormat("ru-RU", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

const relativeFormatter = new Intl.RelativeTimeFormat("ru", {
  numeric: "auto",
});

export function formatAmount(n: number, currency: Currency): string {
  return `${amountFormatter.format(Math.round(n))} ${CURRENCY_SYMBOL[currency]}`;
}

export function formatAmountBare(n: number): string {
  return amountFormatter.format(Math.round(n));
}

export function formatAmountInput(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  return amountFormatter.format(Number(digits));
}

export function parseAmount(formatted: string): number {
  const digits = formatted.replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}

export function formatRate(rate: number): string {
  return rateFormatter.format(rate);
}

export function formatPhoneMasked(raw: string | null | undefined): string {
  if (!raw) return "—";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 6) return `+${digits}`;
  // 7 700 XXX XX 47 → first 4 (country + op) + masked middle + last 2
  const country = digits.slice(0, 1);
  const op = digits.slice(1, 4);
  const last2 = digits.slice(-2);
  return `+${country} ${op} *** ** ${last2}`;
}

export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);

  if (abs < 45) return "только что";
  if (abs < 90) return relativeFormatter.format(Math.round(diffSec / 60), "minute");
  if (abs < 60 * 60) return relativeFormatter.format(Math.round(diffSec / 60), "minute");
  if (abs < 60 * 90) return relativeFormatter.format(Math.round(diffSec / 3600), "hour");
  if (abs < 60 * 60 * 24) return relativeFormatter.format(Math.round(diffSec / 3600), "hour");
  if (abs < 60 * 60 * 24 * 7) return relativeFormatter.format(Math.round(diffSec / 86400), "day");
  return relativeFormatter.format(Math.round(diffSec / (86400 * 7)), "week");
}

/**
 * Equivalent amount in the OTHER currency.
 *
 * `rate` is always defined as: 1 KZT = `rate` KRW (the value the rate widget exposes).
 * The listing's `direction` tells us which side `amount` is denominated in,
 * and `offeredRate` overrides the market rate if the lister set one.
 */
export function equivalentAmount(
  amount: number,
  fromCurrency: Currency,
  marketRate: number,
  offeredRate?: number | null,
): number {
  const r = offeredRate ?? marketRate;
  return fromCurrency === "KZT" ? amount * r : amount / r;
}
