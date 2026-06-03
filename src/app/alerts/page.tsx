import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";
import { HeaderAvatarMenu } from "@/components/HeaderAvatarMenu";
import { RateProvider } from "@/components/feed/RateContext";
import { signAvatar } from "@/lib/avatar-url";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import { authPhoneToE164 } from "@/lib/phone";
import type { AlertSubscription, Direction } from "@/lib/types";
import { AlertsClient } from "./AlertsClient";

type SearchParams = {
  direction?: string;
  create?: string;
};

export default async function AlertsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const { data: profileRow } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .single();
  if (!profileRow) redirect("/");

  // profiles.phone is no longer client-readable; source the owner's own
  // number from the auth session.
  const profile = { ...profileRow, phone: authPhoneToE164(user.phone) };

  const { data: alertsData } = await supabase
    .from("alert_subscriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  let hasTelegramLink = false;
  if (profile.phone) {
    const { data: link } = await supabase
      .from("telegram_links")
      .select("phone")
      .eq("phone", profile.phone)
      .maybeSingle();
    hasTelegramLink = Boolean(link);
  }

  const headerAvatarUrl = await signAvatar(supabase, profile.avatar_url);

  const initialDirection: Direction | null =
    searchParams?.direction === "kzt_to_krw" ||
    searchParams?.direction === "krw_to_kzt"
      ? (searchParams.direction as Direction)
      : null;
  const initialCreate = searchParams?.create === "1";

  return (
    <RateProvider>
      <main className="min-h-[100dvh] flex flex-col bg-bg">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 border-b border-border bg-surface">
          <div className="justify-self-start">
            <Link href="/feed" className="oz-listing-back">
              <span className="oz-listing-back__arrow" aria-hidden>
                ←
              </span>
              <span>Лента</span>
            </Link>
          </div>
          <div className="justify-self-center flex items-center gap-2.5">
            <BrandMark size={28} />
            <span className="font-bold text-[16px] tracking-tight">öz</span>
          </div>
          <div className="justify-self-end">
            <HeaderAvatarMenu
              displayName={profile.display_name}
              phone={profile.phone}
              avatarUrl={headerAvatarUrl}
            />
          </div>
        </header>

        <AlertsClient
          userId={user.id}
          initialAlerts={(alertsData ?? []) as AlertSubscription[]}
          hasTelegramLink={hasTelegramLink}
          initialDirection={initialDirection}
          initialCreate={initialCreate}
        />
      </main>
    </RateProvider>
  );
}
