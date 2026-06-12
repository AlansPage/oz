import { createHmac, timingSafeEqual } from "crypto";

// The subset of the Telegram WebApp user object we rely on. `id` is the
// telegram_user_id that bridges to our `telegram_links` table.
export type TelegramUser = {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
};

export type InitDataResult =
  | { ok: true; user: TelegramUser; authDate: number }
  | {
      ok: false;
      reason: "no_hash" | "bad_hash" | "malformed" | "stale" | "no_user";
    };

type Options = {
  /** Reject payloads whose auth_date is older than this. Default 15 min. */
  maxAgeSeconds?: number;
  /** Injectable clock for tests; defaults to wall-clock seconds. */
  nowSeconds?: number;
};

// Validate Telegram Mini App `initData` server-side, per
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// `initDataUnsafe` from the client is never trusted — only this signed string.
export function validateInitData(
  raw: string,
  botToken: string,
  opts: Options = {},
): InitDataResult {
  const maxAge = opts.maxAgeSeconds ?? 900;
  const now = opts.nowSeconds ?? Math.floor(Date.now() / 1000);

  const params = new URLSearchParams(raw);

  const hash = params.get("hash");
  if (!hash) return { ok: false, reason: "no_hash" };

  // data_check_string: every field except `hash`, as `key=value`, sorted by
  // key, joined with newlines — built from the URL-decoded values.
  const pairs: string[] = [];
  for (const [key, value] of params) {
    if (key === "hash") continue;
    pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!constantTimeEqual(computed, hash)) {
    return { ok: false, reason: "bad_hash" };
  }

  const authDate = Number(params.get("auth_date"));
  if (!Number.isFinite(authDate)) return { ok: false, reason: "malformed" };
  if (now - authDate > maxAge) return { ok: false, reason: "stale" };

  const userRaw = params.get("user");
  if (!userRaw) return { ok: false, reason: "no_user" };
  try {
    const parsed = JSON.parse(userRaw) as unknown;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as { id?: unknown }).id !== "number"
    ) {
      return { ok: false, reason: "no_user" };
    }
    return { ok: true, user: parsed as TelegramUser, authDate };
  } catch {
    return { ok: false, reason: "no_user" };
  }
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
