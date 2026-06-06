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
  telegram_user_id: number;
  message_text: string;
};

type TxRecord = { id?: string; listing_id?: string; status?: string };

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
  const botToken = envOrThrow("TELEGRAM_BOT_TOKEN");

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
    const result = await sendTelegram(botToken, row.telegram_user_id, row.message_text);
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
