import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { BrandMark } from "@/components/BrandMark";
import { LogoutButton } from "@/components/LogoutButton";

export default async function TransactionPlaceholderPage({
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

  const shortId = params.id.slice(0, 8);

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 border-b border-border bg-surface">
        <div className="flex items-center gap-2.5 justify-self-start">
          <Link href="/feed" className="flex items-center gap-2.5">
            <BrandMark size={28} />
            <span className="font-bold text-[16px] tracking-tight">öz</span>
          </Link>
        </div>
        <div />
        <div className="justify-self-end">
          <LogoutButton />
        </div>
      </header>

      <section className="oz-listing-page">
        <div className="oz-listing-empty">
          <div className="oz-listing-empty__title">
            Сделка #{shortId} создана
          </div>
          <div className="oz-listing-empty__copy">
            Экран сделки скоро появится.
          </div>
          <Link href="/feed" className="oz-btn oz-btn--primary">
            Вернуться к ленте
          </Link>
        </div>
      </section>
    </main>
  );
}
