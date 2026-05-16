"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSupabase } from "@/components/SupabaseProvider";
import { BrandMark } from "@/components/BrandMark";
import { OtpInput } from "@/components/OtpInput";
import { translateAuthError } from "@/lib/auth-errors";

const RESEND_SECONDS = 60;

export default function VerifyPage() {
  const router = useRouter();
  const { supabase } = useSupabase();
  const [phone, setPhone] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    const stored = sessionStorage.getItem("oz:auth:phone");
    if (!stored) {
      router.replace("/auth/phone");
      return;
    }
    setPhone(stored);
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function handleVerify(e?: React.FormEvent) {
    e?.preventDefault();
    if (!phone || code.length !== 6 || loading) return;
    setError(null);
    setLoading(true);

    const { error: verifyError } = await supabase.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });
    setLoading(false);

    if (verifyError) {
      setError(translateAuthError(verifyError, "verify"));
      return;
    }

    router.push("/feed");
  }

  async function handleResend() {
    if (!phone || cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    const { error: otpError } = await supabase.auth.signInWithOtp({ phone });
    setResending(false);
    if (otpError) {
      setError(translateAuthError(otpError, "send"));
      return;
    }
    setCooldown(RESEND_SECONDS);
  }

  // Auto-submit once 6 digits are entered
  useEffect(() => {
    if (code.length === 6 && !loading) {
      handleVerify();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  if (!phone) return null;

  return (
    <main className="min-h-[100dvh] flex flex-col px-6 py-8 bg-bg">
      <header className="flex items-center justify-between">
        <Link
          href="/auth/phone"
          className="text-[14px] text-text-2 hover:text-text"
        >
          ← Назад
        </Link>
        <BrandMark size={28} />
      </header>

      <div className="flex-1 flex flex-col justify-center max-w-sm mx-auto w-full">
        <h1 className="text-[24px] font-bold leading-tight tracking-tight text-text">
          Введите код из SMS
        </h1>
        <p className="mt-2 text-[14px] text-text-2">
          Код отправлен на{" "}
          <span className="font-mono text-text">{phone}</span>
        </p>

        <form onSubmit={handleVerify} className="mt-8">
          <OtpInput value={code} onChange={setCode} hasError={!!error} />

          {error && (
            <p
              className="mt-3 text-[12px] text-center"
              style={{ color: "var(--error)" }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={code.length !== 6 || loading}
            className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg mt-6"
          >
            {loading ? "Проверяем…" : "Подтвердить"}
          </button>

          <p className="mt-4 text-center text-[13px] text-text-2">
            Не получили код?{" "}
            {cooldown > 0 ? (
              <span className="text-text-3">
                Отправить повторно через{" "}
                <span className="font-mono">{cooldown}с</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="underline hover:text-text"
              >
                {resending ? "Отправляем…" : "Отправить повторно"}
              </button>
            )}
          </p>
        </form>
      </div>
    </main>
  );
}
