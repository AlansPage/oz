import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signAvatar } from "@/lib/avatar-url";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import { authPhoneToE164 } from "@/lib/phone";
import { BrandMark } from "@/components/BrandMark";
import { HeaderAvatarMenu } from "@/components/HeaderAvatarMenu";
import { RateWidget } from "@/components/RateWidget";
import { RateProvider } from "@/components/feed/RateContext";
import { ListingDetailClient } from "./ListingDetailClient";
import type { Profile } from "@/lib/types";

export default async function ListingPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .single();

  if (!profileRow) {
    redirect("/");
  }

  // profiles.phone is no longer client-readable; source the owner's own
  // number from the auth session.
  const profile = { ...profileRow, phone: authPhoneToE164(user.phone) };

  const headerAvatarUrl = await signAvatar(supabase, profile.avatar_url);

  return (
    <RateProvider>
      <main className="min-h-[100dvh] flex flex-col bg-bg">
        {/* Mobile (<640px): two rows — brand + avatar, then the rate widget
            full-width. Desktop: the original 3-column grid, with min-w-0
            cells so the fixed-width widget can never force overflow. */}
        <header className="flex flex-wrap items-center justify-between gap-y-3 px-4 py-3 border-b border-border bg-surface sm:grid sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:px-6 sm:py-4">
          <div className="order-1 flex items-center gap-2.5 min-w-0 sm:order-none sm:justify-self-start">
            <Link href="/feed" className="flex items-center gap-2.5">
              <BrandMark size={28} />
              <span className="font-bold text-[16px] tracking-tight">öz</span>
            </Link>
          </div>
          <div className="order-3 w-full flex justify-center min-w-0 sm:order-none sm:w-auto sm:justify-self-center">
            <RateWidget />
          </div>
          <div className="order-2 min-w-0 sm:order-none sm:justify-self-end">
            <HeaderAvatarMenu
              displayName={profile.display_name}
              phone={profile.phone}
              avatarUrl={headerAvatarUrl}
            />
          </div>
        </header>

        <ListingDetailClient
          id={params.id}
          currentUserId={user.id}
          currentProfile={profile as Profile}
        />
      </main>
    </RateProvider>
  );
}
