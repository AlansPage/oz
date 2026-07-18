/**
 * Human contact config for the "связаться с создателем" surface.
 *
 * These point at a real person — the founder's operator account — deliberately
 * separate from NEXT_PUBLIC_TELEGRAM_BOT_USERNAME (the auth bot). The honest
 * framing is the design constraint: this audience is wary of fake institutions,
 * so we reach the maker directly rather than a "support team".
 *
 * Read from env with a sensible fallback, mirroring how the auth-bot username is
 * resolved in src/app/auth/verify/page.tsx. Never hardcode the handle in a
 * component — import these instead.
 */

/**
 * Founder's Telegram handle, used to build t.me deep links. A leading "@" and
 * surrounding whitespace are stripped defensively — t.me URLs take the bare
 * handle (https://t.me/handle, not https://t.me/@handle), but it's natural to
 * paste the "@" form into config.
 */
export const OZ_CONTACT_TELEGRAM = (
  process.env.NEXT_PUBLIC_OZ_CONTACT_TELEGRAM || "oz_founder"
)
  .trim()
  .replace(/^@+/, "");

/**
 * Optional founder email. `null` when unset/blank so callers can skip rendering
 * an empty email row — for this audience Telegram is the real channel.
 */
const emailRaw = process.env.NEXT_PUBLIC_OZ_CONTACT_EMAIL;
export const OZ_CONTACT_EMAIL =
  emailRaw && emailRaw.trim().length > 0 ? emailRaw.trim() : null;

/**
 * Build the founder Telegram deep link. When opened from inside a deal, the
 * transaction id rides along as a start param (`?start=help_<txid>`) so the
 * thread arrives with context to pull — mirroring the `?start=verify` pattern.
 */
export function buildContactTelegramUrl(transactionId?: string | null): string {
  const base = `https://t.me/${OZ_CONTACT_TELEGRAM}`;
  return transactionId ? `${base}?start=help_${transactionId}` : base;
}
