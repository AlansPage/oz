import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createClient as createSsrClient } from "@/lib/supabase/server";
import { derivePassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

const PHONE_RE = /^\+7\d{10}$/;
const CODE_RE = /^\d{6}$/;
const MAX_ATTEMPTS = 5;

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

    console.log("[verify-code] step 4: looking up existing profile by phone");
    const { data: existing, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (profileError) {
      console.error("[verify-code] error at step 4 (profile lookup):", profileError);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    console.log("[verify-code] step 4 done", {
      existing: Boolean(existing),
      existing_id: existing?.id ?? null,
    });

    console.log("[verify-code] step 5: deriving password via HMAC");
    const password = derivePassword(phone);
    console.log("[verify-code] step 5 done", { password_len: password.length });

    if (!existing) {
      console.log("[verify-code] step 6: creating supabase auth user", { phone });
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        phone,
        password,
        phone_confirm: true,
      });
      if (createError) {
        console.error("[verify-code] error at step 6 (createUser):", createError);
        return NextResponse.json({ error: "server_error" }, { status: 500 });
      }
      console.log("[verify-code] step 6 done", {
        user_id: created?.user?.id ?? null,
        user_phone: created?.user?.phone ?? null,
      });
    } else {
      console.log("[verify-code] step 6 skipped: profile already exists");
    }

    console.log("[verify-code] step 7: signing in with password");
    const ssr = createSsrClient();
    const { data: signInData, error: signInError } = await ssr.auth.signInWithPassword({
      phone,
      password,
    });
    if (signInError) {
      console.error("[verify-code] error at step 7 (signInWithPassword):", signInError);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    console.log("[verify-code] step 7 done", {
      user_id: signInData?.user?.id ?? null,
      user_phone: signInData?.user?.phone ?? null,
      has_session: Boolean(signInData?.session),
    });

    console.log("[verify-code] step 8: returning success response");
    const response = NextResponse.json({ ok: true, redirect: "/feed" });
    console.log("[verify-code] step 8 done");
    return response;
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
