/**
 * Telegram Mini App auth bridge (Phase 0 — FOUND path).
 *
 * Validates the signed `initData` from the Telegram WebApp, resolves the
 * telegram_user_id to a verified +7 phone via `telegram_links`, and mints the
 * SAME cookie session the OTP flow produces by signing in with the
 * phone-derived password (see src/app/api/auth/verify-code/route.ts and
 * src/lib/auth/password.ts). No new auth primitive — the password is
 * deterministic, so a server holding the pepper can sign a known phone in.
 *
 * A telegram_user_id with no link yet returns `needs_binding: true`; Phase 2
 * adds the in-app phone-binding step. The token validated against is the APP
 * bot's token (the bot that launched the Mini App), distinct from
 * TELEGRAM_BOT_TOKEN (the @ozauth_bot code channel), which is untouched.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient as createSsrClient } from "@/lib/supabase/server";
import { derivePassword } from "@/lib/auth/password";
import { validateInitData } from "@/lib/telegram/initdata";
import { logSecurityEvent } from "@/lib/security-log";
import { canonicalPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const ACCOUNT_NEEDS_MIGRATION_BODY = {
  error: "account_needs_migration",
  message_ru: "Этот номер был зарегистрирован ранее. Свяжитесь с поддержкой.",
} as const;

export async function POST(req: Request) {
  const appBotToken = process.env.TELEGRAM_APP_BOT_TOKEN;
  if (!appBotToken) {
    console.error("[telegram-auth] TELEGRAM_APP_BOT_TOKEN not set");
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  let initData: string | undefined;
  try {
    const body = (await req.json()) as { initData?: unknown };
    if (typeof body.initData === "string") initData = body.initData;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!initData) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const result = validateInitData(initData, appBotToken);
  if (!result.ok) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    void logSecurityEvent({
      event_type: "miniapp_initdata_invalid",
      ip,
      detail: { reason: result.reason },
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const telegramUserId = result.user.id;

  // Resolve the verified phone. The contact-share binding (in the @ozauth_bot
  // webhook) is what populates this; without it the user has no trust anchor.
  const { data: link, error: linkError } = await supabaseAdmin
    .from("telegram_links")
    .select("phone")
    .eq("telegram_user_id", telegramUserId)
    .maybeSingle();
  if (linkError) {
    console.error("[telegram-auth] telegram_links lookup failed", linkError);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  if (!link?.phone) {
    // Phase 2 wires the in-app binding flow off this signal.
    return NextResponse.json({ ok: false, needs_binding: true });
  }

  const phone = link.phone as string;
  const password = derivePassword(phone);

  const ssr = createSsrClient();
  const { data: signInData, error: signInError } =
    await ssr.auth.signInWithPassword({ phone, password });
  if (signInError) {
    const msg = (signInError.message ?? "").toLowerCase();
    const code = (signInError as { code?: string }).code ?? "";
    if (
      code === "invalid_credentials" ||
      msg.includes("invalid login credentials") ||
      msg.includes("invalid_credentials")
    ) {
      // Linked phone with no/mismatched auth.users row. Phase 2 reconciles
      // this (create-or-migrate); for the spike the user already exists.
      void logSecurityEvent({
        event_type: "auth_account_needs_migration",
        phone,
        detail: { reason: "miniapp_signin_no_auth_user" },
      });
      return NextResponse.json(ACCOUNT_NEEDS_MIGRATION_BODY, { status: 409 });
    }
    console.error("[telegram-auth] signInWithPassword failed", signInError);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  await repairProfileIfMissing(signInData.user);

  void logSecurityEvent({
    event_type: "miniapp_signin",
    user_id: signInData.user?.id ?? null,
    phone,
    detail: { telegram_user_id: telegramUserId },
  });

  return NextResponse.json({ ok: true, redirect: "/feed" });
}

// Mirror of verify-code's repair: the profiles row is created by a trigger on
// auth user creation, but stale pre-trigger accounts may lack one.
async function repairProfileIfMissing(
  user: { id: string; phone?: string | null } | null,
) {
  if (!user) return;
  const { data: existing } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (existing) return;
  const phoneE164 = canonicalPhone(user.phone);
  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: user.id, phone: phoneE164 }, { onConflict: "id" });
  if (error) {
    console.error("[telegram-auth] profile repair failed", {
      user_id: user.id,
      error,
    });
  }
}
