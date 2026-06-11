// INVARIANT: all app-owned tables (profiles, telegram_links, auth_codes)
// store phone numbers as E.164 WITH the '+' prefix (e.g. "+77073350741");
// only auth.users stores it without the '+' (Supabase behavior). Any code
// that writes a phone to, or compares a phone against, an app-owned table
// must route it through canonicalPhone() first. Migration
// 20260535000000_fix_profile_phone_format.sql normalized the historical
// violations of this invariant.
//
// All phone helpers assume +7 (Kazakhstan / Russia) prefix.
// The visible mask is "(XXX) XXX-XX-XX" over a 10-digit national number.

// Canonicalize any phone representation ("+7707...", "7707...",
// "+7 (707) ...") to E.164 with '+': strips non-digits, re-adds '+'.
export function canonicalPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  return `+${digits}`;
}

export function formatPhoneMask(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  const p1 = d.slice(0, 3);
  const p2 = d.slice(3, 6);
  const p3 = d.slice(6, 8);
  const p4 = d.slice(8, 10);

  if (d.length === 0) return "";
  if (d.length <= 3) return `(${p1}`;
  if (d.length <= 6) return `(${p1}) ${p2}`;
  if (d.length <= 8) return `(${p1}) ${p2}-${p3}`;
  return `(${p1}) ${p2}-${p3}-${p4}`;
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "").slice(0, 10);
}

export function toE164(digits: string): string {
  return `+7${digits}`;
}

export function isComplete(digits: string): boolean {
  return digits.length === 10;
}

// Supabase auth.users stores phone without the leading "+" (e.g.
// "77073350741"). Normalize the session phone (user.phone) back to E.164
// for the signed-in user's own display, now that profiles.phone is no
// longer readable by the client.
export function authPhoneToE164(raw: string | null | undefined): string | null {
  return canonicalPhone(raw);
}
