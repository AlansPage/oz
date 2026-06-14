"use client";

import { ContactFounder } from "@/components/ContactFounder";

export default function ErrorBoundary({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 bg-bg">
      <div className="max-w-sm w-full text-center">
        <h1 className="text-[20px] font-bold tracking-tight">
          Что-то пошло не так
        </h1>
        <p className="mt-3 text-[14px] text-text-2">
          Произошла ошибка. Попробуйте ещё раз или вернитесь позже.
        </p>
        <button
          onClick={() => reset()}
          className="oz-btn oz-btn--primary mt-6"
        >
          Попробовать снова
        </button>
        <div className="mt-8">
          <ContactFounder />
        </div>
      </div>
    </main>
  );
}
