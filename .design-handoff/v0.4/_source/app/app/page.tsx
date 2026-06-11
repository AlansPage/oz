import Link from "next/link";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { createClient } from "@/lib/supabase/server";

export default async function LandingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/feed");

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-between px-6 py-12 bg-bg">
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-sm">
        <BrandMark size={72} />
        <h1 className="mt-6 text-[28px] leading-tight font-bold tracking-tight text-text">
          öz
        </h1>
        <p className="mt-3 text-[15px] leading-snug text-text-2">
          Обмен тенге и вон между своими в Корее.
        </p>
      </div>

      <div className="w-full max-w-sm">
        <Link
          href="/auth/phone"
          className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg"
        >
          Войти
        </Link>
        <p className="mt-4 text-center text-[12px] text-text-3">
          Сообщество казахстанцев в Корее
        </p>
      </div>
    </main>
  );
}
