import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";
import { LogoutButton } from "@/components/LogoutButton";
import { RateWidget } from "@/components/RateWidget";

export default async function FeedPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const phone = user.phone ? `+${user.phone}` : "—";

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
        <div className="flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="font-bold text-[16px] tracking-tight">öz</span>
        </div>
        <div className="flex items-center gap-3">
          <RateWidget />
          <LogoutButton />
        </div>
      </header>

      <section className="flex-1 px-6 py-10 max-w-sm mx-auto w-full">
        <div
          className="rounded-lg p-6 bg-surface mt-6"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-[14px] text-text-2">Вы вошли как</p>
          <p className="mt-1 font-mono text-[18px] text-text">{phone}</p>
        </div>

        <p className="mt-8 text-[14px] text-text-3 text-center">
          Лента скоро появится.
        </p>
      </section>
    </main>
  );
}
