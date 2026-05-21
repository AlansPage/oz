// Slice 10 — notify-matchers edge function.
//
// Triggered by a Supabase Database Webhook on `listings INSERT` (with
// status='active' condition). Calls find_alert_matches via service-role,
// dispatches Telegram messages, writes notification_log rows.
//
// Auth: a shared secret in the `x-listing-webhook-secret` header (set
// LISTING_INSERT_WEBHOOK_SECRET in function secrets and in the webhook's
// HTTP-headers field).
//
// Always returns 200; per-row failures land in notification_log.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type MatchRow = {
  alert_id: string;
  user_id: string;
  telegram_user_id: number;
  message_text: string;
};

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: { id?: string; status?: string };
};

const TG_API = "https://api.telegram.org";

function envOrThrow(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} not set`);
  return v;
}

async function sendTelegram(
  token: string,
  chatId: number,
  text: string,
): Promise<{ ok: boolean; messageId?: string; errorDetail?: string }> {
  const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
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

Deno.serve(async (req) => {
  const expected = Deno.env.get("LISTING_INSERT_WEBHOOK_SECRET");
  const provided = req.headers.get("x-listing-webhook-secret");
  if (!expected || provided !== expected) {
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

  if (
    payload.type !== "INSERT" ||
    payload.table !== "listings" ||
    !payload.record?.id ||
    payload.record?.status !== "active"
  ) {
    return new Response(
      JSON.stringify({ ok: true, ignored: "not_active_listing_insert" }),
      { status: 200 },
    );
  }

  const supabaseUrl = envOrThrow("SUPABASE_URL");
  const serviceRoleKey = envOrThrow("SUPABASE_SERVICE_ROLE_KEY");
  const botToken = envOrThrow("TELEGRAM_BOT_TOKEN");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc("find_alert_matches", {
    p_listing_id: payload.record.id,
  });

  if (error) {
    console.error("find_alert_matches failed", error);
    return new Response(
      JSON.stringify({ ok: true, dispatched: 0, failed: 0, rpc_error: error.message }),
      { status: 200 },
    );
  }

  const rows = (data ?? []) as MatchRow[];
  let dispatched = 0;
  let failed = 0;

  for (const row of rows) {
    const result = await sendTelegram(botToken, row.telegram_user_id, row.message_text);
    if (result.ok) {
      dispatched += 1;
      const { error: logErr } = await supabase.from("notification_log").insert({
        user_id: row.user_id,
        alert_id: row.alert_id,
        listing_id: payload.record.id,
        channel: "telegram",
        status: "sent",
        external_id: result.messageId ?? null,
      });
      if (logErr) console.error("notification_log insert (sent) failed", logErr);
    } else {
      failed += 1;
      const { error: logErr } = await supabase.from("notification_log").insert({
        user_id: row.user_id,
        alert_id: row.alert_id,
        listing_id: payload.record.id,
        channel: "telegram",
        status: "failed",
        error_detail: result.errorDetail ?? "unknown_error",
      });
      if (logErr) console.error("notification_log insert (failed) failed", logErr);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, dispatched, failed }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
});
