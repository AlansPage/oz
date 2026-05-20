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
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }

  const phone = typeof body.phone === "string" ? body.phone : "";
  const code = typeof body.code === "string" ? body.code : "";
  if (!PHONE_RE.test(phone) || !CODE_RE.test(code)) {
    return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
  }

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
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  if (!match) {
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
    }
    return NextResponse.json({ error: "invalid_or_expired" }, { status: 400 });
  }

  const { error: useError } = await supabaseAdmin
    .from("auth_codes")
    .update({ used: true })
    .eq("id", match.id);
  if (useError) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const password = derivePassword(phone);

  const { data: existing, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", phone)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  if (!existing) {
    const { error: createError } = await supabaseAdmin.auth.admin.createUser({
      phone,
      password,
      phone_confirm: true,
    });
    if (createError) {
      console.error("createUser failed", createError);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  }

  const ssr = createSsrClient();
  const { error: signInError } = await ssr.auth.signInWithPassword({
    phone,
    password,
  });
  if (signInError) {
    console.error("signInWithPassword failed", signInError);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, redirect: "/feed" });
}
