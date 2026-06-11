import type { Currency } from "@/lib/types";

// Single registry for the structured bank picker. `code` is the stable
// identifier stored in payment_methods.bank_code; `label` is the canonical
// display name stored in bank_name (the server re-derives it from the code,
// so renaming a label here is safe). A null bank_code in the DB means the
// user picked «Другой банк» and typed a free-text bank name.
export type Bank = {
  code: string;
  label: string;
  currency: Currency;
};

export const BANKS: Bank[] = [
  // KZT
  { code: "kaspi", label: "Kaspi Gold", currency: "KZT" },
  { code: "halyk", label: "Halyk", currency: "KZT" },
  { code: "forte", label: "Forte", currency: "KZT" },
  { code: "jusan", label: "Jusan", currency: "KZT" },
  { code: "bcc", label: "БЦК", currency: "KZT" },
  { code: "freedom", label: "Freedom", currency: "KZT" },
  // KRW
  { code: "toss", label: "Toss", currency: "KRW" },
  { code: "kakaobank", label: "KakaoBank", currency: "KRW" },
  { code: "kookmin", label: "KB Kookmin", currency: "KRW" },
  { code: "shinhan", label: "Shinhan", currency: "KRW" },
  { code: "woori", label: "Woori", currency: "KRW" },
  { code: "hana", label: "Hana", currency: "KRW" },
  { code: "nonghyup", label: "NH Nonghyup", currency: "KRW" },
  { code: "ibk", label: "IBK", currency: "KRW" },
];

export function banksFor(currency: Currency): Bank[] {
  return BANKS.filter((b) => b.currency === currency);
}

export function bankByCode(code: string | null | undefined): Bank | null {
  if (!code) return null;
  return BANKS.find((b) => b.code === code) ?? null;
}
