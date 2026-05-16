"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { useSupabase } from "@/components/SupabaseProvider";
import { BrandMark } from "@/components/BrandMark";
import {
  digitsOnly,
  formatPhoneMask,
  isComplete,
  toE164,
} from "@/lib/phone";
import { translateAuthError } from "@/lib/auth-errors";

export default function PhonePage() {
  const router = useRouter();
  const { supabase } = useSupabase();
  const [digits, setDigits] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = isComplete(digits) && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);

    const phone = toE164(digits);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    setLoading(false);

    if (otpError) {
      setError(translateAuthError(otpError, "send"));
      return;
    }

    sessionStorage.setItem("oz:auth:phone", phone);
    router.push("/auth/verify");
  }

  return (
    <main className="min-h-[100dvh] flex flex-col px-6 py-8 bg-bg">
      <header className="flex items-center justify-between">
        <Link
          href="/"
          className="text-[14px] text-text-2 hover:text-text"
          aria-label="Назад"
        >
          ← Назад
        </Link>
        <BrandMark size={28} />
      </header>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <h1 className="text-[24px] font-bold leading-tight tracking-tight text-text">
          Введите номер телефона
        </h1>
        <p className="mt-2 text-[14px] text-text-2">
          Мы отправим SMS с кодом для входа.
        </p>

        <form onSubmit={handleSubmit} className="mt-8">
          <label className="block text-[12px] font-medium text-text-2 mb-1.5">
            Номер телефона
          </label>
          <div className="flex gap-2">
            <div
              className="oz-input font-mono"
              style={{
                width: 56,
                display: "grid",
                placeItems: "center",
                color: "var(--text-2)",
                background: "var(--surface-2)",
                cursor: "not-allowed",
              }}
              aria-hidden
            >
              +7
            </div>
            <input
              type="tel"
              inputMode="numeric"
              autoFocus
              autoComplete="tel-national"
              placeholder="(700) 123-45-67"
              className={`oz-input font-mono${error ? " is-error" : ""}`}
              value={formatPhoneMask(digits)}
              onChange={(e) => setDigits(digitsOnly(e.target.value))}
            />
          </div>

          {error && (
            <p
              className="mt-2 text-[12px] flex items-center gap-1.5"
              style={{ color: "var(--error)" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg mt-6"
          >
            {loading ? "Отправляем…" : "Получить код"}
          </button>

          <p className="mt-4 text-center text-[12px] leading-relaxed text-text-3">
            Продолжая, вы соглашаетесь с условиями использования
            и политикой конфиденциальности.
          </p>
        </form>
      </div>
    </main>
  );
}
