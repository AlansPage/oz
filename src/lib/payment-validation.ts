import type { Currency } from "@/lib/types";

// Structural validation for payout account/card numbers, keyed off the
// selected bank_code and currency. Mirrored server-side in
// upsert_payment_method (migration 20260538000000) — keep the two in sync.
// No banking API: everything here is shape + checksum, so a typo'd digit is
// caught before money moves toward it.

const KRW_TRADITIONAL = new Set([
  "kookmin",
  "shinhan",
  "woori",
  "hana",
  "nonghyup",
  "ibk",
]);

// Strip the separators people type (spaces, hyphens); uppercase for IBANs.
export function normalizeAccountNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// ISO 7064 mod-97 over the rearranged IBAN (KZ: 2 check digits + 16 BBAN).
export function kzIbanValid(iban: string): boolean {
  if (!/^KZ\d{2}[0-9A-Z]{16}$/.test(iban)) return false;
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let expanded = "";
  for (const ch of rearranged) {
    expanded += /\d/.test(ch) ? ch : String(ch.charCodeAt(0) - 55);
  }
  return BigInt(expanded) % 97n === 1n;
}

// Returns a user-facing Russian error, or null when the number is valid.
export function accountNumberError(
  currency: Currency,
  bankCode: string | null,
  raw: string,
): string | null {
  const value = normalizeAccountNumber(raw);

  if (currency === "KZT") {
    if (/^\d{16}$/.test(value)) {
      return luhnValid(value)
        ? null
        : "Номер карты не проходит проверку. Проверьте цифры.";
    }
    if (value.startsWith("KZ")) {
      return kzIbanValid(value)
        ? null
        : "IBAN не проходит проверку. Проверьте символы.";
    }
    return "Введите 16-значный номер карты или IBAN-счёт (KZ…).";
  }

  // KRW: digits only, per-bank length/shape.
  if (!/^\d+$/.test(value)) {
    return "Номер счёта — только цифры.";
  }
  if (bankCode === "kakaobank") {
    return /^3333\d{9}$/.test(value)
      ? null
      : "Счёт KakaoBank — 13 цифр, начинается с 3333.";
  }
  if (bankCode === "toss") {
    return value.length >= 12 && value.length <= 14
      ? null
      : "Счёт Toss — от 12 до 14 цифр.";
  }
  if (bankCode !== null && KRW_TRADITIONAL.has(bankCode)) {
    return value.length >= 10 && value.length <= 14
      ? null
      : "Номер счёта — от 10 до 14 цифр.";
  }
  // «Другой банк»: keep a loose envelope so the escape hatch stays open.
  return value.length >= 10 && value.length <= 16
    ? null
    : "Номер счёта — от 10 до 16 цифр.";
}
