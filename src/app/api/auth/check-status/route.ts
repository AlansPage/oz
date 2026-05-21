import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { checkInMemoryLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const PHONE_RE = /^\+7\d{10}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const phone = url.searchParams.get("phone") ?? "";
  if (!PHONE_RE.test(phone)) {
    return NextResponse.json({ error: "invalid_phone" }, { status: 400 });
  }

  const limit = checkInMemoryLimit(`checkstatus:${phone}`, 60, 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("auth_codes")
    .select("id")
    .eq("phone", phone)
    .eq("used", false)
    .eq("delivered", true)
    .gt("expires_at", nowIso)
    .limit(1)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ delivered: Boolean(data) });
}
