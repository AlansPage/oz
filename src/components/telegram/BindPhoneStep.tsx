"use client";

import { useCallback, useRef, useState } from "react";
import { getWebApp } from "@/lib/telegram/webapp";

/**
 * Phase 2 binding step, shown when /api/auth/telegram returns needs_binding.
 *
 * Flow: the user shares their Telegram-verified number via the native
 * `requestContact()` prompt. Telegram delivers that number to the app-bot
 * webhook server-side (the client never sees/sends it), which binds it to
 * telegram_links. We then poll /api/auth/telegram until the link exists and the
 * session is minted, then hand off to onBound().
 */

type Props = {
  /** The signed initData to re-submit once binding completes. */
  initData: string;
  /** Called when the session is minted (route returned ok). */
  onBound: () => void;
};

type Phase =
  | "idle"
  | "waiting" // contact shared; polling for the server-side bind
  | "declined" // user dismissed the share prompt
  | "slow" // bind not visible after the poll window
  | "unsupported" // requestContact not available on this client
  | "error";

const POLL_ATTEMPTS = 12;
const POLL_DELAY_MS = 1200;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function attemptAuth(
  initData: string,
): Promise<"ok" | "needs_binding" | "error"> {
  try {
    const res = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      needs_binding?: boolean;
    };
    if (res.ok && data.ok) return "ok";
    if (res.ok && data.needs_binding) return "needs_binding";
    return "error";
  } catch {
    return "error";
  }
}

export function BindPhoneStep({ initData, onBound }: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const pollingRef = useRef(false);

  const pollUntilBound = useCallback(async () => {
    if (pollingRef.current) return;
    pollingRef.current = true;
    setPhase("waiting");
    try {
      for (let i = 0; i < POLL_ATTEMPTS; i++) {
        const r = await attemptAuth(initData);
        if (r === "ok") {
          getWebApp()?.HapticFeedback?.notificationOccurred("success");
          onBound();
          return;
        }
        await sleep(POLL_DELAY_MS);
      }
      // Webhook hasn't landed yet — let the user retry the poll.
      setPhase("slow");
    } finally {
      pollingRef.current = false;
    }
  }, [initData, onBound]);

  const handleShare = useCallback(() => {
    const wa = getWebApp();
    if (!wa?.requestContact) {
      setPhase("unsupported");
      return;
    }
    wa.requestContact((granted) => {
      if (!granted) {
        setPhase("declined");
        return;
      }
      void pollUntilBound();
    });
  }, [pollUntilBound]);

  const busy = phase === "waiting";

  return (
    <div className="max-w-xs">
      <h1 className="text-[20px] font-bold leading-tight text-text">
        Подтвердите номер
      </h1>
      <p className="mt-2 text-[14px] text-text-2">
        öz — это безопасный обмен между людьми. Чтобы защитить сделки от
        мошенников, мы привязываем аккаунт к казахстанскому номеру +7. Telegram
        подтвердит, что номер действительно ваш.
      </p>

      {phase === "slow" && (
        <p className="mt-4 text-[13px]" style={{ color: "var(--warning)" }}>
          Почти готово — подтверждение ещё обрабатывается. Нажмите «Продолжить».
        </p>
      )}
      {phase === "declined" && (
        <p className="mt-4 text-[13px]" style={{ color: "var(--error)" }}>
          Без номера вход невозможен. Поделитесь номером, чтобы продолжить.
        </p>
      )}
      {phase === "error" && (
        <p className="mt-4 text-[13px]" style={{ color: "var(--error)" }}>
          Что-то пошло не так. Попробуйте ещё раз.
        </p>
      )}
      {phase === "unsupported" && (
        <p className="mt-4 text-[13px]" style={{ color: "var(--error)" }}>
          Ваша версия Telegram не поддерживает быструю привязку. Обновите
          Telegram или войдите через сайт oz.exchange.
        </p>
      )}

      {phase === "slow" ? (
        <button
          type="button"
          onClick={() => void pollUntilBound()}
          className="oz-btn oz-btn--primary oz-btn--full mt-6"
        >
          Продолжить
        </button>
      ) : phase !== "unsupported" ? (
        <button
          type="button"
          onClick={handleShare}
          disabled={busy}
          className="oz-btn oz-btn--primary oz-btn--full mt-6"
        >
          {busy ? "Проверяем…" : "Поделиться номером"}
        </button>
      ) : null}
    </div>
  );
}
