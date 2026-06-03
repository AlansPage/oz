/**
 * verify-code OTP route
 *
 * Design: we look up by phone in auth.users (source of truth for auth),
 * not profiles (which is a derived table populated by the handle_new_user
 * trigger after createUser). Profiles can be repaired post-sign-in if a
 * row is missing — that's expected for stale pre-Slice-6 auth.users rows
 * that never got a matching profile.
 *
 * Branches:
 *   - User exists in auth.users → skip createUser, sign in.
 *     - Sign-in password mismatch → 409 account_needs_migration
 *       (stale pre-pepper account; manual migration via service role).
 *   - User doesn't exist → createUser, then sign in.
 *     - createUser hits phone_exists → race/pagination edge from
 *       listUsers; also 409 account_needs_migration (logged as a bug).
 *
 * After a successful sign-in (either branch), upsert the profiles row
 * if missing so the rest of the app keeps working.
 */
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient as createSsrClient } from "@/lib/supabase/server";
import { derivePassword } from "@/lib/auth/password";
import { checkAuthCodeAttemptsLimit } from "@/lib/rate-limit";
import { logSecurityEvent } from "@/lib/security-log";

export const dynamic = "force-dynamic";

const PHONE_RE = /^\+7\d{10}$/;
const CODE_RE = /^\d{6}$/;
const MAX_ATTEMPTS = 5;

const DEBUG_VERBOSE =
  process.env.NODE_ENV !== "production" ||
  process.env.OZ_VERBOSE_AUTH === "1";

function vlog(...args: unknown[]) {
  if (DEBUG_VERBOSE) {
    // eslint-disable-next-line no-console
    console.log(...args);
  }
}

const ACCOUNT_NEEDS_MIGRATION_BODY = {
  error: "account_needs_migration",
  message_ru: "Этот номер был зарегистрирован ранее. Свяжитесь с поддержкой.",
} as const;

type RequestBody = { phone?: unknown; code?: unknown };

export async function POST(req: Request) {
  try {
    vlog("[verify-code] step 1: parsing request body");
    let body: RequestBody;
    try {
      body = (await req.json()) as RequestBody;
    } catch (err) {
      console.error("[verify-code] error at step 1 (json parse):", err);
      return NextResponse.json({ error: "bad_request" }, { status: 400 });
    }

    const phone = typeof body.phone === "string" ? body.phone : "";
    const code = typeof body.code === "string" ? body.code : "";
    const phoneValid = PHONE_RE.test(phone);
    const codeValid = CODE_RE.test(code);
    vlog("[verify-code] step 1 done", {
      phone_len: phone.length,
      code_len: code.length,
      phone_valid: phoneValid,
      code_valid: codeValid,
    });
    if (!phoneValid || !codeValid) {
      vlog("[verify-code] rejecting: regex failed");
      return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
    }

    // Per-phone verify-attempt rate limit (slice 11). Sums `attempts`
    // across recent auth_codes rows so each failed verify counts.
    const rateLimit = await checkAuthCodeAttemptsLimit(
      phone,
      5,
      10 * 60 * 1000,
    );
    if (!rateLimit.allowed) {
      void logSecurityEvent({
        event_type: "auth_rate_limited",
        phone,
        detail: { route: "verify-code", attempted: rateLimit.attempted },
      });
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }

    vlog("[verify-code] step 2: looking up auth_codes row", { phone });
    const nowIso = new Date().toISOString();
    const { data: match, error: matchError } = await supabaseAdmin
      .from("auth_codes")
      .select("id")
      .eq("phone", phone)
      .eq("code", code)
      .eq("used", false)
      .gt("expires_at", nowIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (matchError) {
      console.error("[verify-code] error at step 2 (lookup):", matchError);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    vlog("[verify-code] step 2 done", { found: Boolean(match), match_id: match?.id ?? null });

    if (!match) {
      vlog("[verify-code] no valid code match; incrementing attempts");
      const { data: latest } = await supabaseAdmin
        .from("auth_codes")
        .select("id, attempts")
        .eq("phone", phone)
        .eq("used", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (latest) {
        const nextAttempts = (latest.attempts ?? 0) + 1;
        await supabaseAdmin
          .from("auth_codes")
          .update({
            attempts: nextAttempts,
            used: nextAttempts > MAX_ATTEMPTS,
          })
          .eq("id", latest.id);
        vlog("[verify-code] attempts updated", {
          id: latest.id,
          next_attempts: nextAttempts,
          locked: nextAttempts > MAX_ATTEMPTS,
        });
      }
      return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
    }

    vlog("[verify-code] step 3: marking auth_codes row used", { id: match.id });
    const { error: useError } = await supabaseAdmin
      .from("auth_codes")
      .update({ used: true })
      .eq("id", match.id);
    if (useError) {
      console.error("[verify-code] error at step 3 (mark used):", useError);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    vlog("[verify-code] step 3 done", { id: match.id });

    // TODO: REPLACE with phone-indexed lookup once Supabase exposes
    // getUserByPhone or once we maintain our own phone-to-user-id table.
    // listUsers with perPage=1000 is a stopgap that won't scale past ~500
    // users.
    vlog("[verify-code] step 4: looking up existing user in auth.users");
    // auth.users.phone is stored WITHOUT the leading + (e.g. "77073350741"),
    // while our request body and custom tables (auth_codes, profiles,
    // telegram_links) use the + prefix. Strip the + one-way for this lookup
    // only — never change how phones are stored in our own tables.
    const phoneNoPlus = phone.startsWith("+") ? phone.slice(1) : phone;
    const { data: usersPage, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      console.error("[verify-code] error at step 4 (listUsers):", listError);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    vlog("[verify-code] comparing phone formats", {
      request_phone: phone,
      lookup_phone: phoneNoPlus,
      sample_auth_phone: usersPage?.users[0]?.phone ?? null,
    });
    const existingAuthUser =
      usersPage?.users.find((u) => u.phone === phoneNoPlus) ?? null;
    vlog("[verify-code] step 4 done", {
      total_returned: usersPage?.users.length ?? 0,
      existing: Boolean(existingAuthUser),
      existing_id: existingAuthUser?.id ?? null,
    });

    vlog("[verify-code] step 5: deriving password via HMAC");
    const password = derivePassword(phone);
    vlog("[verify-code] step 5 done", { password_len: password.length });

    if (existingAuthUser) {
      vlog("[verify-code] existing user found in auth.users", {
        user_id: existingAuthUser.id,
      });
      const ssr = createSsrClient();
      const { data: signInData, error: signInError } = await ssr.auth.signInWithPassword({
        phone,
        password,
      });
      if (signInError) {
        const errMsg = (signInError.message ?? "").toLowerCase();
        const errCode = (signInError as { code?: string }).code ?? "";
        if (
          errCode === "invalid_credentials" ||
          errMsg.includes("invalid login credentials") ||
          errMsg.includes("invalid_credentials")
        ) {
          vlog("[verify-code] password mismatch on existing user — 409");
          console.error("[verify-code] account_needs_migration", {
            phone,
            user_id: existingAuthUser.id,
            auth_error: signInError,
          });
          void logSecurityEvent({
            event_type: "auth_account_needs_migration",
            phone,
            user_id: existingAuthUser.id,
            detail: { reason: "password_mismatch", error_message: signInError.message ?? null },
          });
          return NextResponse.json(ACCOUNT_NEEDS_MIGRATION_BODY, { status: 409 });
        }
        console.error(
          "[verify-code] error at step 7 (signInWithPassword existing):",
          signInError,
        );
        void logSecurityEvent({
          event_type: "auth_failed",
          phone,
          user_id: existingAuthUser.id,
          detail: { reason: "signin_existing_unhandled", error_message: signInError.message ?? null },
        });
        return NextResponse.json({ error: "server_error" }, { status: 500 });
      }
      vlog("[verify-code] sign in succeeded for existing user", {
        user_id: signInData.user?.id ?? null,
        has_session: Boolean(signInData.session),
      });
      await repairProfileIfMissing(signInData.user);
      vlog("[verify-code] step 8: returning success response");
      return NextResponse.json({ ok: true, redirect: "/feed" });
    }

    vlog("[verify-code] no existing user, creating new", { phone });
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
    });
    if (createError) {
      const errMsg = (createError.message ?? "").toLowerCase();
      const errCode = (createError as { code?: string }).code ?? "";
      if (
        errCode === "phone_exists" ||
        errMsg.includes("phone number already registered") ||
        errMsg.includes("already been registered")
      ) {
        // listUsers lookup missed a real user — race or pagination edge.
        vlog("[verify-code] phone collision during createUser — 409");
        console.error("[verify-code] account_needs_migration (collision)", {
          phone,
          create_error: createError,
        });
        void logSecurityEvent({
          event_type: "auth_account_needs_migration",
          phone,
          detail: { reason: "createuser_phone_collision", error_message: createError.message ?? null },
        });
        return NextResponse.json(ACCOUNT_NEEDS_MIGRATION_BODY, { status: 409 });
      }
      console.error("[verify-code] error at step 6 (createUser):", createError);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    vlog("[verify-code] step 6 done", {
      user_id: created?.user?.id ?? null,
      user_phone: created?.user?.phone ?? null,
    });

    vlog("[verify-code] step 7: signing in with password");
    const ssr = createSsrClient();
    const { data: signInData, error: signInError } = await ssr.auth.signInWithPassword({
      phone,
      password,
    });
    if (signInError) {
      console.error(
        "[verify-code] error at step 7 (signInWithPassword new):",
        signInError,
      );
      void logSecurityEvent({
        event_type: "auth_failed",
        phone,
        user_id: created?.user?.id ?? null,
        detail: { reason: "signin_new_unhandled", error_message: signInError.message ?? null },
      });
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    vlog("[verify-code] sign in succeeded for new user", {
      user_id: signInData.user?.id ?? null,
      has_session: Boolean(signInData.session),
    });
    // handle_new_user trigger should have created the profile, but be safe.
    await repairProfileIfMissing(signInData.user);

    vlog("[verify-code] step 8: returning success response");
    return NextResponse.json({ ok: true, redirect: "/feed" });
  } catch (err) {
    const e = err as Error;
    console.error("[verify-code] uncaught error:", {
      message: e?.message,
      stack: e?.stack,
      error: err,
    });
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

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
  const phoneE164 = user.phone
    ? user.phone.startsWith("+")
      ? user.phone
      : `+${user.phone}`
    : null;
  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: user.id, phone: phoneE164 }, { onConflict: "id" });
  if (error) {
    console.error("[verify-code] profile repair failed", {
      user_id: user.id,
      error,
    });
  } else {
    vlog("[verify-code] profile repaired", { user_id: user.id });
  }
}
