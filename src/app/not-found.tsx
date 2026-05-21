import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-bg">
      <div className="max-w-sm text-center">
        <h1 className="text-[20px] font-bold tracking-tight">
          Страница не найдена
        </h1>
        <p className="mt-3 text-[14px] text-text-2">
          Возможно, вы перешли по устаревшей ссылке.
        </p>
        <Link href="/" className="oz-btn oz-btn--primary mt-6 inline-block">
          На главную
        </Link>
      </div>
    </main>
  );
}
