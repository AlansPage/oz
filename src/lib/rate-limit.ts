// Rate-limit helpers.
//
// Phone-keyed limits: count rows in auth_codes (a row exists per OTP
// request, and `attempts` tracks failed verify counts on that row).
// We sum attempts across recent rows for verify-code; we count rows
// for request-code.
//
// IP-keyed and check-status limits: in-memory Map. Acceptable for
// Phase 1 — cold starts reset the map but the limit windows are short
// (≤ 1 min) and a serverless reset costs at worst one extra burst.
// Move to Redis when traffic warrants it.

import { supabaseAdmin } from "@/lib/supabase/admin";

export async function checkAuthCodeRequestLimit(
  phone: string,
  max: number,
  windowMs: number,
): Promise<{ allowed: boolean; recent: number }> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count, error } = await supabaseAdmin
    .from("auth_codes")
    .select("id", { count: "exact", head: true })
    .eq("phone", phone)
    .gt("created_at", since);
  if (error) {
    // Fail open on DB errors so a transient outage doesn't lock users out.
    console.error("checkAuthCodeRequestLimit failed", error);
    return { allowed: true, recent: 0 };
  }
  const recent = count ?? 0;
  return { allowed: recent < max, recent };
}

export async function checkAuthCodeAttemptsLimit(
  phone: string,
  max: number,
  windowMs: number,
): Promise<{ allowed: boolean; attempted: number }> {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { data, error } = await supabaseAdmin
    .from("auth_codes")
    .select("attempts")
    .eq("phone", phone)
    .gt("created_at", since);
  if (error) {
    console.error("checkAuthCodeAttemptsLimit failed", error);
    return { allowed: true, attempted: 0 };
  }
  const attempted = (data ?? []).reduce(
    (acc, row) => acc + (row.attempts ?? 0),
    0,
  );
  return { allowed: attempted < max, attempted };
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkInMemoryLimit(
  key: string,
  max: number,
  windowMs: number,
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: max - 1 };
  }
  if (existing.count >= max) {
    return { allowed: false, remaining: 0 };
  }
  existing.count += 1;
  return { allowed: true, remaining: max - existing.count };
}
