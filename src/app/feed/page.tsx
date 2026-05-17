import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";
import { LogoutButton } from "@/components/LogoutButton";
import { RateWidget } from "@/components/RateWidget";
import { RateProvider } from "@/components/feed/RateContext";
import { FeedClient } from "@/components/feed/FeedClient";

export default async function FeedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

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
            <LogoutButton />
          </div>
        </header>

        <FeedClient currentUserId={user.id} />
      </main>
    </RateProvider>
  );
}
