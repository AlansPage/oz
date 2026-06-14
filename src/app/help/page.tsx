import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { ContactFounder } from "@/components/ContactFounder";

export const metadata = {
  title: "Помощь — öz",
};

export default function HelpPage() {
  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center px-6 py-4 border-b border-border bg-surface">
        <div className="justify-self-start">
          <Link href="/feed" className="oz-listing-back">
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

      <section className="w-full max-w-[560px] mx-auto px-6 py-10 flex flex-col gap-7">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight mb-2">Помощь</h1>
          <p className="text-[14px] text-text-2 leading-relaxed">
            öz — небольшой сервис, который делает один человек, а не компания с
            отделом поддержки. Если что-то не работает или вы не понимаете, как
            быть, — просто напишите мне. Отвечает живой человек.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-[15px] font-bold tracking-tight">
            Проблема по конкретной сделке?
          </h2>
          <p className="text-[14px] text-text-2 leading-relaxed">
            Откройте эту сделку и нажмите «Сообщить о проблеме». Так я сразу вижу
            все детали — сумму, чеки, переписку — и могу разобраться быстрее,
            чем по сообщению в личку.
          </p>
        </div>

        <div className="space-y-3">
          <h2 className="text-[15px] font-bold tracking-tight">
            По всему остальному — напишите создателю
          </h2>
          <ContactFounder />
        </div>
      </section>
    </main>
  );
}
