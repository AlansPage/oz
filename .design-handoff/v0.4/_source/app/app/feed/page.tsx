import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signAvatar } from "@/lib/avatar-url";
import { BrandMark } from "@/components/BrandMark";
import { HeaderAvatarMenu } from "@/components/HeaderAvatarMenu";
import { RateWidget } from "@/components/RateWidget";
import { RateProvider } from "@/components/feed/RateContext";
import { FeedClient } from "@/components/feed/FeedClient";
import type { Profile } from "@/lib/types";

export default async function FeedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/");
  }

  const headerAvatarUrl = await signAvatar(supabase, profile.avatar_url);

  return (
    <RateProvider>
      <main className="min-h-[100dvh] flex flex-col bg-bg">
        <header className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 border-b border-border bg-surface">
          <div className="flex items-center gap-2.5 justify-self-start">
            <BrandMark size={28} />
            <span className="font-bold text-[16px] tracking-tight">öz</span>
          </div>
          <div className="justify-self-center">
            <RateWidget />
          </div>
          <div className="justify-self-end">
            <HeaderAvatarMenu
              displayName={profile.display_name}
              phone={profile.phone}
              avatarUrl={headerAvatarUrl}
            />
          </div>
        </header>

        <FeedClient
          currentUserId={user.id}
          currentProfile={profile as Profile}
        />
      </main>
    </RateProvider>
  );
}
