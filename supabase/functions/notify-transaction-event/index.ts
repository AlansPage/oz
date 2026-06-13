// Slice 13 — notify-transaction-event edge function.
//
// Triggered by two Supabase Database Webhooks on `public.transactions`:
//   - INSERT                              -> event_type 'created'
//   - UPDATE (NEW.status IS DISTINCT FROM OLD.status) -> 'completed' |
//     'disputed' | 'cancelled' | 'advanced'
// Both webhooks send the same shared secret in the
// `x-transaction-event-secret` header (TRANSACTION_EVENT_WEBHOOK_SECRET).
//
// Calls find_transaction_event_notifications (SECURITY DEFINER) via
// service-role to compute recipients + message text, dispatches Telegram
// messages, and records each outcome in notification_log.
//
// Messages embed user display names, so they are sent as PLAIN TEXT
// (no parse_mode) to avoid broken or injected markup.
//
// Always returns 200; per-row failures land in notification_log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type NotifyRow = {
  user_id: string;
  // null = recipient resolved but has no telegram_links row; logged as a
  // 'no_telegram_link' failure instead of silently skipped.
  telegram_user_id: number | null;
  message_text: string;
};

type TxRecord = {
  id?: string;
  listing_id?: string;
  status?: string;
  // Phase 4 name-match checkpoint: set when a sender reports that the
  // recipient name doesn't match, cleared when the counterparty resolves.
  name_mismatch_at?: string | null;
};

type WebhookPayload = {
  type?: "INSERT" | "UPDATE" | "DELETE";
  table?: string;
  record?: TxRecord;
  old_record?: TxRecord;
};

const TG_API = "https://api.telegram.org";

function envOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} not set`);
  return v;
}

// Constant-time secret comparison. A plain `a !== b` short-circuits on the
// first differing byte, leaking the matching-prefix length through timing.
// Hashing to fixed-length digests first also avoids leaking the secret length.
async function secretsMatch(
  provided: string | null,
  expected: string | null,
): Promise<boolean> {
  if (!provided || !expected) return false;
  const enc = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(provided)),
    crypto.subtle.digest("SHA-256", enc.encode(expected)),
  ]);
  const av = new Uint8Array(a);
  const bv = new Uint8Array(b);
  let diff = 0;
  for (let i = 0; i < av.length; i++) diff |= av[i] ^ bv[i];
  return diff === 0;
}

async function sendTelegram(
  token: string,
  chatId: number,
  text: string,
): Promise<{ ok: boolean; messageId?: string; errorDetail?: string }> {
  const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, errorDetail: `HTTP ${res.status}: ${body.slice(0, 500)}` };
  }
  const json = (await res.json().catch(() => null)) as
    | { result?: { message_id?: number } }
    | null;
  const messageId = json?.result?.message_id;
  return { ok: true, messageId: messageId != null ? String(messageId) : undefined };
}

// Send via the app bot first (so the message can deep-link into the Mini App),
// then fall back to @ozauth_bot — which every linked user has started, so it can
// always reach them. A bot CANNOT message a user who never started it, so the
// app bot alone would silently drop notifications for users who haven't opened
// the Mini App yet; the fallback closes that gap. When appToken is null this is
// just the original @ozauth_bot send.
async function dispatch(
  appToken: string | null,
  ozToken: string,
  chatId: number,
  text: string,
): Promise<{ ok: boolean; messageId?: string; channel: string; errorDetail?: string }> {
  if (appToken) {
    const viaApp = await sendTelegram(appToken, chatId, text);
    if (viaApp.ok) return { ...viaApp, channel: "app_bot" };
  }
  const viaOz = await sendTelegram(ozToken, chatId, text);
  return { ...viaOz, channel: "ozauth_bot" };
}

// Map a transactions table change to an event_type. Returns null when the
// change is not notification-worthy (e.g. UPDATE that didn't move status).
function resolveEventType(payload: WebhookPayload): string | null {
  if (payload.type === "INSERT") return "created";
  if (payload.type === "UPDATE") {
    const next = payload.record?.status;
    const prev = payload.old_record?.status;
    if (next === "completed") return "completed";
    if (next === "disputed") return "disputed";
    if (next === "cancelled") return "cancelled";
    if (next && prev && next !== prev) return "advanced";
    // No status movement: check the name-match freeze flag. The report and
    // resolve RPCs never move status in the same UPDATE, so this branch
    // can't shadow a status notification.
    const nextMismatch = payload.record?.name_mismatch_at ?? null;
    const prevMismatch = payload.old_record?.name_mismatch_at ?? null;
    if (nextMismatch && !prevMismatch) return "name_mismatch";
    if (!nextMismatch && prevMismatch) return "name_mismatch_resolved";
  }
  return null;
}

Deno.serve(async (req) => {
  const expected = Deno.env.get("TRANSACTION_EVENT_WEBHOOK_SECRET");
  const provided = req.headers.get("x-transaction-event-secret");
  if (!(await secretsMatch(provided, expected))) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return new Response(JSON.stringify({ ok: true, ignored: "bad_json" }), {
      status: 200,
    });
  }

  if (payload.table !== "transactions" || !payload.record?.id) {
    return new Response(
      JSON.stringify({ ok: true, ignored: "not_transaction_event" }),
      { status: 200 },
    );
  }

  const eventType = resolveEventType(payload);
  if (!eventType) {
    return new Response(
      JSON.stringify({ ok: true, ignored: "no_status_change" }),
      { status: 200 },
    );
  }

  const transactionId = payload.record.id;
  const listingId = payload.record.listing_id ?? null;

  const supabase = createClient(
    envOrThrow("SUPABASE_URL"),
    envOrThrow("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const ozBotToken = envOrThrow("TELEGRAM_BOT_TOKEN");
  // Optional: when set, deal notifications prefer the Mini App's app bot so they
  // can deep-link into the app (falls back to @ozauth_bot — see dispatch()).
  const appBotToken = Deno.env.get("TELEGRAM_APP_BOT_TOKEN") ?? null;
  // Optional: e.g. "https://t.me/oz_app_bot". When set, each message gets a
  // tappable link that opens the Mini App straight on the transaction. Requires
  // the app bot to have a Main Mini App configured in BotFather. Plain text
  // (no parse_mode), so the bare URL is auto-linked and can't inject markup.
  const deeplinkBase = Deno.env.get("MINIAPP_DEEPLINK_BASE") ?? null;
  const deepLink = deeplinkBase
    ? `${deeplinkBase}?startapp=tx_${transactionId}`
    : null;

  const { data, error } = await supabase.rpc(
    "find_transaction_event_notifications",
    { p_transaction_id: transactionId, p_event_type: eventType },
  );

  if (error) {
    console.error("find_transaction_event_notifications failed", error);
    return new Response(
      JSON.stringify({ ok: true, event: eventType, dispatched: 0, failed: 0, rpc_error: error.message }),
      { status: 200 },
    );
  }

  const rows = (data ?? []) as NotifyRow[];
  let dispatched = 0;
  let failed = 0;

  for (const row of rows) {
    if (row.telegram_user_id == null) {
      failed += 1;
      const { error: logErr } = await supabase.from("notification_log").insert({
        user_id: row.user_id,
        listing_id: listingId,
        channel: "telegram",
        status: "failed",
        error_detail: "no_telegram_link",
      });
      if (logErr) console.error("notification_log insert (no_telegram_link) failed", logErr);
      continue;
    }
    const text = deepLink
      ? `${row.message_text}\n\nОткрыть в öz: ${deepLink}`
      : row.message_text;
    const result = await dispatch(appBotToken, ozBotToken, row.telegram_user_id, text);
    if (result.ok) {
      dispatched += 1;
      const { error: logErr } = await supabase.from("notification_log").insert({
        user_id: row.user_id,
        listing_id: listingId,
        channel: "telegram",
        status: "sent",
        external_id: result.messageId ?? null,
      });
      if (logErr) console.error("notification_log insert (sent) failed", logErr);
    } else {
      failed += 1;
      const { error: logErr } = await supabase.from("notification_log").insert({
        user_id: row.user_id,
        listing_id: listingId,
        channel: "telegram",
        status: "failed",
        error_detail: result.errorDetail ?? "unknown_error",
      });
      if (logErr) console.error("notification_log insert (failed) failed", logErr);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, event: eventType, dispatched, failed }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
