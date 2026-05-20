import { createHmac } from "crypto";

// Deterministic per-phone password. The pepper is server-only, so the
// password cannot be derived from the phone number alone. 64 hex chars
// fits well inside Supabase's 72-char password limit.
export function derivePassword(phoneE164: string): string {
  const pepper = process.env.AUTH_PASSWORD_PEPPER;
  if (!pepper) throw new Error("AUTH_PASSWORD_PEPPER not set");
  return createHmac("sha256", pepper).update(phoneE164).digest("hex");
}
