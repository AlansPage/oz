import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { secretsMatch } from "@/lib/secure-compare";

export const dynamic = "force-dynamic";

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Number((numerator / denominator).toFixed(4));
}

export async function GET(req: Request) {
  const expected = process.env.OZ_ADMIN_TOKEN;
  const auth = req.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!secretsMatch(provided, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(
    now.getTime() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const nowIso = now.toISOString();

  const head = { count: "exact" as const, head: true };

  const [
    usersTotal,
    usersActive7d,
    usersWithTelegram,
    listingsActive,
    listingsTotal24h,
    txInProgress,
    txCompleted,
    txDisputed,
    txCancelled,
    notifSent24h,
    notifFailed24h,
    secAuthFailures24h,
    secChatFlagged24h,
  ] = await Promise.all([
    supabaseAdmin.from("profiles").select("*", head),
    supabaseAdmin
      .from("profiles")
      .select("*", head)
      .gt("last_active_at", sevenDaysAgo),
    supabaseAdmin.from("telegram_links").select("*", head),
    supabaseAdmin
      .from("listings")
      .select("*", head)
      .eq("status", "active")
      .gt("expires_at", nowIso),
    supabaseAdmin
      .from("listings")
      .select("*", head)
      .gt("created_at", dayAgo),
    supabaseAdmin
      .from("transactions")
      .select("*", head)
      .not("status", "in", "(completed,cancelled,disputed)"),
    supabaseAdmin
      .from("transactions")
      .select("*", head)
      .eq("status", "completed"),
    supabaseAdmin
      .from("transactions")
      .select("*", head)
      .eq("status", "disputed"),
    supabaseAdmin
      .from("transactions")
      .select("*", head)
      .eq("status", "cancelled"),
    supabaseAdmin
      .from("notification_log")
      .select("*", head)
      .eq("status", "sent")
      .gt("created_at", dayAgo),
    supabaseAdmin
      .from("notification_log")
      .select("*", head)
      .eq("status", "failed")
      .gt("created_at", dayAgo),
    supabaseAdmin
      .from("security_events")
      .select("*", head)
      .in("event_type", [
        "auth_failed",
        "auth_account_needs_migration",
        "auth_rate_limited",
      ])
      .gt("created_at", dayAgo),
    supabaseAdmin
      .from("security_events")
      .select("*", head)
      .eq("event_type", "chat_flagged")
      .gt("created_at", dayAgo),
  ]);

  const n = (r: { count: number | null }) => r.count ?? 0;

  const txCompletedN = n(txCompleted);
  const txCancelledN = n(txCancelled);
  const txDisputedN = n(txDisputed);
  const sent = n(notifSent24h);
  const failed = n(notifFailed24h);

  return NextResponse.json({
    users: {
      total: n(usersTotal),
      active_7d: n(usersActive7d),
      with_telegram: n(usersWithTelegram),
    },
    listings: {
      active: n(listingsActive),
      total_24h: n(listingsTotal24h),
    },
    transactions: {
      in_progress: n(txInProgress),
      completed: txCompletedN,
      disputed: txDisputedN,
      cancelled: txCancelledN,
      completion_rate: rate(
        txCompletedN,
        txCompletedN + txCancelledN + txDisputedN,
      ),
    },
    notifications: {
      sent_24h: sent,
      failed_24h: failed,
      success_rate: rate(sent, sent + failed),
    },
    security: {
      auth_failures_24h: n(secAuthFailures24h),
      chat_flagged_24h: n(secChatFlagged24h),
    },
  });
}
