import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function PrivacyPage() {
  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 border-b border-border bg-surface">
        <div className="justify-self-start">
          <Link href="/" className="oz-listing-back">
            <span className="oz-listing-back__arrow" aria-hidden>
              ←
            </span>
            <span>Назад</span>
          </Link>
        </div>
        <div className="justify-self-center flex items-center gap-2.5">
          <BrandMark size={28} />
          <span className="font-bold text-[16px] tracking-tight">öz</span>
        </div>
        <div className="justify-self-end" />
      </header>

      <section className="w-full max-w-[640px] mx-auto px-6 py-10 flex flex-col gap-4">
        <h1 className="text-[22px] font-bold tracking-tight">
          Политика конфиденциальности
        </h1>
        <p className="text-[14px] text-text-2 leading-relaxed">
          Этот документ будет обновлён после консультации с юридическим
          консультантом. Если у вас есть вопросы, напишите нам:{" "}
          <a
            href="https://t.me/ozauth_bot"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            @ozauth_bot
          </a>
          .
        </p>
        <p className="text-[12px] text-text-3 mt-4">
          Последнее обновление: 21 мая 2026
        </p>
      </section>
    </main>
  );
}
