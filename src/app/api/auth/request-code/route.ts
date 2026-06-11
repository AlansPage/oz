import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { generateOtp, sendTelegramMessage } from "@/lib/telegram";
import { checkAuthCodeRequestLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";
import { canonicalPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const PHONE_RE = /^\+7\d{10}$/;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

type RequestBody = { phone?: unknown };

export async function POST(req: Request) {
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const phone =
    canonicalPhone(typeof body.phone === "string" ? body.phone : null) ?? "";
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const limit = await checkAuthCodeRequestLimit(
    phone,
    RATE_LIMIT_MAX,
    RATE_LIMIT_WINDOW_MS,
  );
  if (!limit.allowed) {
    void logSecurityEvent({
      event_type: "auth_rate_limited",
      phone,
      detail: { route: "request-code", recent: limit.recent },
    });
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const code = generateOtp();

  const { data: link, error: linkError } = await supabaseAdmin
    .from("telegram_links")
    .select("telegram_user_id")
    .eq("phone", phone)
    .maybeSingle();
  if (linkError) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  if (link) {
    const { error: insertError } = await supabaseAdmin
      .from("auth_codes")
      .insert({
        phone,
        code,
        telegram_user_id: link.telegram_user_id,
        delivered: true,
      });
    if (insertError) {
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    try {
      await sendTelegramMessage(
        link.telegram_user_id,
        `öz: ваш код для входа: <b>${code}</b>\n\nКод действителен 5 минут.`,
      );
    } catch {
      return NextResponse.json({ error: "telegram_send_failed" }, { status: 502 });
    }
    return NextResponse.json({ status: "delivered_via_telegram" });
  }

  const { error: insertError } = await supabaseAdmin.from("auth_codes").insert({
    phone,
    code,
    telegram_user_id: null,
    delivered: false,
  });
  if (insertError) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({
    status: "awaiting_link",
    bot_username: process.env.TELEGRAM_BOT_USERNAME ?? "ozauth_bot",
  });
}
