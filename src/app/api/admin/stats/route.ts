import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { secretsMatch } from "@/lib/secure-compare";

export const dynamic = "force-dynamic";

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Number((numerator / denominator).toFixed(4));
}

// One row per bank rail (digits-only normalized account number) that
// appears on payment_methods rows of more than one user — the
// synthetic-identity signature. See 20260546000000_duplicate_rails_view.
type DuplicateRail = {
  normalized_number: string;
  user_count: number;
  bank_codes: string[] | null;
  holders: {
    user_id: string;
    display_name: string | null;
    currency: string;
    bank_name: string;
  }[];
};

// One row per user with any non-cancelled transaction in the trailing
// 30 days: KZT-equivalent volume, deal counts and distinct counterparties
// over 7/30 days — operator visibility into business-like velocity under
// the non-profit-seeking condition of FETR Art. 7-20. See
// 20260559000000_user_volume_velocity.
type UserVolumeVelocity = {
  user_id: string;
  display_name: string | null;
  volume_kzt_7d: number;
  volume_kzt_30d: number;
  deals_7d: number;
  deals_30d: number;
  counterparties_7d: number;
  counterparties_30d: number;
};

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
    duplicateRails,
    volumeVelocity,
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
    supabaseAdmin.from("duplicate_payout_rails").select("*"),
    supabaseAdmin
      .from("user_volume_velocity")
      .select("*")
      .order("volume_kzt_30d", { ascending: false }),
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
    duplicate_rails: {
      count: (duplicateRails.data ?? []).length,
      rails: (duplicateRails.data ?? []) as DuplicateRail[],
      error: duplicateRails.error?.message ?? null,
    },
    volume_velocity: {
      count: (volumeVelocity.data ?? []).length,
      users: (volumeVelocity.data ?? []) as UserVolumeVelocity[],
      error: volumeVelocity.error?.message ?? null,
    },
  });
}
