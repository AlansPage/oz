"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { OtpInput } from "@/components/OtpInput";

const RESEND_SECONDS = 60;
const POLL_INTERVAL_MS = 2000;

type Mode = "awaiting_link" | "delivered";

export default function VerifyPage() {
  const router = useRouter();
  const [phone, setPhone] = useState<string | null>(null);
  const [bot, setBot] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  const verifyingRef = useRef(false);

  useEffect(() => {
    const storedPhone = sessionStorage.getItem("oz:auth:phone");
    const storedMode = sessionStorage.getItem("oz:auth:mode") as Mode | null;
    const storedBot = sessionStorage.getItem("oz:auth:bot");
    if (!storedPhone || !storedMode) {
      router.replace("/auth/phone");
      return;
    }
    setPhone(storedPhone);
    setMode(storedMode);
    setBot(storedBot);
  }, [router]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  // Poll for bot delivery while waiting on link
  useEffect(() => {
    if (mode !== "awaiting_link" || !phone) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(
          `/api/auth/check-status?phone=${encodeURIComponent(phone)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { delivered?: boolean };
        if (!cancelled && body.delivered) {
          sessionStorage.setItem("oz:auth:mode", "delivered");
          setMode("delivered");
        }
      } catch {
        // ignore transient network errors
      }
    };
    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    tick();
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [mode, phone]);

  const handleVerify = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      if (!phone || code.length !== 6 || verifyingRef.current) return;
      verifyingRef.current = true;
      setError(null);
      setLoading(true);
      try {
        const res = await fetch("/api/auth/verify-code", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, code }),
        });
        const body = (await res.json().catch(() => null)) as
          | { ok?: boolean; redirect?: string; error?: string; message_ru?: string }
          | null;
        if (!res.ok || !body?.ok) {
          if (res.status === 409 && body?.error === "account_needs_migration") {
            setError(
              body.message_ru ??
                "Этот номер был зарегистрирован ранее. Свяжитесь с поддержкой.",
            );
            setBlocked(true);
            return;
          }
          if (body?.error === "invalid_or_expired") {
            setError("Неверный или истёкший код.");
          } else {
            setError("Не удалось подтвердить код. Попробуйте ещё раз.");
          }
          return;
        }
        router.push(body.redirect ?? "/feed");
      } catch {
        setError("Не удалось подтвердить код. Попробуйте ещё раз.");
      } finally {
        setLoading(false);
        verifyingRef.current = false;
      }
    },
    [code, phone, router],
  );

  async function handleResend() {
    if (!phone || cooldown > 0 || resending) return;
    setResending(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const body = (await res.json().catch(() => null)) as
        | { status?: string; bot_username?: string; error?: string }
        | null;
      if (!res.ok || !body) {
        if (res.status === 429) {
          setError("Слишком много попыток. Подождите немного.");
        } else {
          setError("Не удалось отправить код. Попробуйте ещё раз.");
        }
        return;
      }
      if (body.status === "awaiting_link") {
        // Bot already has a pending code; user still needs to /verify in Telegram.
        if (body.bot_username) {
          sessionStorage.setItem("oz:auth:bot", body.bot_username);
          setBot(body.bot_username);
        }
        sessionStorage.setItem("oz:auth:mode", "awaiting_link");
        setMode("awaiting_link");
      }
      setCooldown(RESEND_SECONDS);
    } catch {
      setError("Не удалось отправить код. Попробуйте ещё раз.");
    } finally {
      setResending(false);
    }
  }

  useEffect(() => {
    if (mode === "delivered" && code.length === 6 && !loading && !blocked) {
      handleVerify();
    }
  }, [code, mode, loading, blocked, handleVerify]);

  if (!phone || !mode) return null;

  const botUsername = bot ?? "oz_auth_bot";
  const verifyCommand = `/verify ${phone}`;

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
        {mode === "awaiting_link" ? (
          <>
            <h1 className="text-[24px] font-bold leading-tight tracking-tight text-text">
              Откройте Telegram-бот
            </h1>
            <p className="mt-2 text-[14px] text-text-2">
              Чтобы получить код, откройте{" "}
              <span className="font-mono text-text">@{botUsername}</span>{" "}
              и отправьте:
            </p>

            <div
              className="mt-4 oz-input font-mono text-center"
              style={{
                background: "var(--surface-2)",
                userSelect: "all",
              }}
            >
              {verifyCommand}
            </div>

            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg mt-6"
            >
              Открыть Telegram
            </a>

            <p className="mt-4 text-center text-[13px] text-text-2 flex items-center justify-center gap-2">
              <span
                aria-hidden
                className="inline-block w-3 h-3 rounded-full border-2 border-text-3 border-t-transparent animate-spin"
              />
              Жду код от бота…
            </p>

            {error && (
              <p
                className="mt-3 text-[12px] text-center"
                style={{ color: "var(--error)" }}
              >
                {error}
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-[24px] font-bold leading-tight tracking-tight text-text">
              Введите код из Telegram
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
                disabled={code.length !== 6 || loading || blocked}
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
          </>
        )}
      </div>
    </main>
  );
}
