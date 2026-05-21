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

export const dynamic = "force-dynamic";

const PHONE_RE = /^\+7\d{10}$/;
const CODE_RE = /^\d{6}$/;
const MAX_ATTEMPTS = 5;

const ACCOUNT_NEEDS_MIGRATION_BODY = {
  error: "account_needs_migration",
  message_ru: "Этот номер был зарегистрирован ранее. Свяжитесь с поддержкой.",
} as const;

type RequestBody = { phone?: unknown; code?: unknown };

export async function POST(req: Request) {
  try {
    console.log("[verify-code] step 1: parsing request body");
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
    console.log("[verify-code] step 1 done", {
      phone_len: phone.length,
      code_len: code.length,
      phone_valid: phoneValid,
      code_valid: codeValid,
    });
    if (!phoneValid || !codeValid) {
      console.log("[verify-code] rejecting: regex failed");
      return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
    }

    console.log("[verify-code] step 2: looking up auth_codes row", { phone });
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
    console.log("[verify-code] step 2 done", { found: Boolean(match), match_id: match?.id ?? null });

    if (!match) {
      console.log("[verify-code] no valid code match; incrementing attempts");
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
        console.log("[verify-code] attempts updated", {
          id: latest.id,
          next_attempts: nextAttempts,
          locked: nextAttempts > MAX_ATTEMPTS,
        });
      }
      return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
    }

    console.log("[verify-code] step 3: marking auth_codes row used", { id: match.id });
    const { error: useError } = await supabaseAdmin
      .from("auth_codes")
      .update({ used: true })
      .eq("id", match.id);
    if (useError) {
      console.error("[verify-code] error at step 3 (mark used):", useError);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    console.log("[verify-code] step 3 done", { id: match.id });

    // TODO: REPLACE with phone-indexed lookup once Supabase exposes
    // getUserByPhone or once we maintain our own phone-to-user-id table.
    // listUsers with perPage=1000 is a stopgap that won't scale past ~500
    // users.
    console.log("[verify-code] step 4: looking up existing user in auth.users");
    const phoneNoPlus = phone.replace(/^\+/, "");
    const { data: usersPage, error: listError } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) {
      console.error("[verify-code] error at step 4 (listUsers):", listError);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    const existingAuthUser =
      usersPage?.users.find((u) => u.phone === phoneNoPlus) ??
      usersPage?.users.find((u) => u.phone === phone) ??
      null;
    console.log("[verify-code] step 4 done", {
      total_returned: usersPage?.users.length ?? 0,
      existing: Boolean(existingAuthUser),
      existing_id: existingAuthUser?.id ?? null,
    });

    console.log("[verify-code] step 5: deriving password via HMAC");
    const password = derivePassword(phone);
    console.log("[verify-code] step 5 done", { password_len: password.length });

    if (existingAuthUser) {
      console.log("[verify-code] existing user found in auth.users", {
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
          console.log("[verify-code] password mismatch on existing user — 409");
          console.error("[verify-code] account_needs_migration", {
            phone,
            user_id: existingAuthUser.id,
            auth_error: signInError,
          });
          return NextResponse.json(ACCOUNT_NEEDS_MIGRATION_BODY, { status: 409 });
        }
        console.error(
          "[verify-code] error at step 7 (signInWithPassword existing):",
          signInError,
        );
        return NextResponse.json({ error: "server_error" }, { status: 500 });
      }
      console.log("[verify-code] sign in succeeded for existing user", {
        user_id: signInData.user?.id ?? null,
        has_session: Boolean(signInData.session),
      });
      await repairProfileIfMissing(signInData.user);
      console.log("[verify-code] step 8: returning success response");
      return NextResponse.json({ ok: true, redirect: "/feed" });
    }

    console.log("[verify-code] no existing user, creating new", { phone });
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
        console.log("[verify-code] phone collision during createUser — 409");
        console.error("[verify-code] account_needs_migration (collision)", {
          phone,
          create_error: createError,
        });
        return NextResponse.json(ACCOUNT_NEEDS_MIGRATION_BODY, { status: 409 });
      }
      console.error("[verify-code] error at step 6 (createUser):", createError);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    console.log("[verify-code] step 6 done", {
      user_id: created?.user?.id ?? null,
      user_phone: created?.user?.phone ?? null,
    });

    console.log("[verify-code] step 7: signing in with password");
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
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    console.log("[verify-code] sign in succeeded for new user", {
      user_id: signInData.user?.id ?? null,
      has_session: Boolean(signInData.session),
    });
    // handle_new_user trigger should have created the profile, but be safe.
    await repairProfileIfMissing(signInData.user);

    console.log("[verify-code] step 8: returning success response");
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
    console.log("[verify-code] profile repaired", { user_id: user.id });
  }
}
