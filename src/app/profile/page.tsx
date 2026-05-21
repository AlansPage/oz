import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signAvatar } from "@/lib/avatar-url";
import { BrandMark } from "@/components/BrandMark";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
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

  const avatarUrl = await signAvatar(supabase, profile.avatar_url);

  return (
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
        <div className="justify-self-end" />
      </header>

      <ProfileClient
        userId={user.id}
        profile={profile}
        initialAvatarUrl={avatarUrl}
      />
    </main>
  );
}
