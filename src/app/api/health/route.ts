import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error } = await supabaseAdmin
      .from("profiles")
      .select("id", { head: true, count: "exact" })
      .limit(1);
    if (error) {
      return NextResponse.json(
        { ok: false, error: "db_error" },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, ts: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { ok: false, error: "exception" },
      { status: 503 },
    );
  }
}
