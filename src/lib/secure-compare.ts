import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison for secrets (webhook tokens, admin tokens).
 *
 * A plain `a === b` short-circuits on the first differing byte, leaking the
 * length of the matching prefix through timing. timingSafeEqual compares in
 * constant time, but it throws if the buffers differ in length — so we hash
 * both inputs to fixed-length digests first, which also avoids leaking the
 * secret's length.
 */
export function secretsMatch(
  provided: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  if (!provided || !expected) return false;
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}
