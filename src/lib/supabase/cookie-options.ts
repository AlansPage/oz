import type { CookieOptions } from "@supabase/ssr";

/**
 * Make the Supabase session cookies survive an embedded (cross-site iframe)
 * context — specifically Telegram Web, which loads the Mini App in an <iframe>
 * on web.telegram.org. In that third-party context browsers DROP SameSite=Lax
 * cookies (the @supabase/ssr default), so the session never persists and the
 * user is bounced to the login loop.
 *
 * SameSite=None makes the cookie usable cross-site; it REQUIRES Secure. This
 * cleanly OVERWRITES the previous SameSite=Lax cookie (same name/path, both
 * unpartitioned), so existing web users aren't disrupted.
 *
 * NOT using Partitioned (CHIPS) deliberately: a Partitioned cookie is a
 * distinct entry from the old unpartitioned one, so they'd coexist and send
 * duplicates — risky to roll out to live web users. Safari (ITP blocks all
 * third-party cookies) therefore still won't persist in Telegram Web; that
 * needs a separate CHIPS migration. Chromium/Firefox work with None; Secure.
 *
 * Tradeoff: SameSite=None drops the Lax CSRF defense for the web app. Accepted
 * by the product owner to support Telegram Web; Supabase auth still carries the
 * JWT in the Authorization header and cross-origin reads are CORS-blocked.
 *
 * Production only: SameSite=None requires Secure, and Secure cookies are
 * rejected over http://localhost, so dev keeps the Lax defaults.
 */
export function embeddableCookieOptions(
  options: CookieOptions,
  isProd: boolean,
): CookieOptions {
  if (!isProd) return options;
  return {
    ...options,
    sameSite: "none",
    secure: true,
  };
}

/** True in the Vercel/production runtime where cookies are served over HTTPS. */
export const IS_PROD = process.env.NODE_ENV === "production";
