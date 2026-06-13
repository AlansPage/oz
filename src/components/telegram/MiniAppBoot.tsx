"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { getWebApp } from "@/lib/telegram/webapp";
import { resolveStartParam } from "@/lib/telegram/start-param";
import { BindPhoneStep } from "@/components/telegram/BindPhoneStep";

/**
 * Mini App bootstrap (Phase 0). Runs once on the `/tg` entry route inside the
 * Telegram webview:
 *   1. ready()/expand() the WebApp.
 *   2. POST the signed `initData` to /api/auth/telegram, which mints the same
 *      cookie session the OTP flow produces.
 *   3. On success, route to the returned redirect (default /feed).
 *
 * The signed `initData` is the only thing trusted — never `initDataUnsafe`.
 * The `needs_binding` branch is a placeholder here; Phase 2 wires real binding.
 */

type BootState =
  | { kind: "loading" }
  | { kind: "needs_binding" }
  | { kind: "not_telegram" }
  | { kind: "error"; message: string };

export function MiniAppBoot() {
  const router = useRouter();
  const [state, setState] = useState<BootState>({ kind: "loading" });
  const [initData, setInitData] = useState<string | null>(null);
  const ranRef = useRef(false);
  // Deep-link target from ?startapp=tx_<id> (e.g. a deal notification), resolved
  // once and honored after both direct auth and post-binding. Defaults to /feed.
  const landingRef = useRef("/feed");

  useEffect(() => {
    // Guard against double-invocation (React 18 StrictMode dev double-mount).
    if (ranRef.current) return;
    ranRef.current = true;

    const wa = getWebApp();
    if (!wa || !wa.initData) {
      setState({ kind: "not_telegram" });
      return;
    }
    setInitData(wa.initData);
    landingRef.current =
      resolveStartParam(wa.initDataUnsafe?.start_param) ?? "/feed";

    try {
      wa.ready();
      wa.expand();
    } catch {
      // ready/expand are best-effort; auth still proceeds.
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: wa.initData }),
        });

        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          redirect?: string;
          needs_binding?: boolean;
          message_ru?: string;
        };

        if (cancelled) return;

        if (res.ok && data.ok) {
          router.replace(landingRef.current);
          return;
        }
        if (res.ok && data.needs_binding) {
          setState({ kind: "needs_binding" });
          return;
        }
        setState({
          kind: "error",
          message:
            data.message_ru ?? "Не удалось войти. Попробуйте открыть приложение заново.",
        });
      } catch {
        if (!cancelled) {
          setState({
            kind: "error",
            message: "Нет соединения. Проверьте интернет и попробуйте снова.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-8 bg-bg text-center">
      <BrandMark size={56} />

      {state.kind === "loading" && (
        <p className="mt-6 text-[14px] text-text-2">Входим в öz…</p>
      )}

      {state.kind === "needs_binding" && initData && (
        <div className="mt-6">
          <BindPhoneStep
            initData={initData}
            onBound={() => router.replace(landingRef.current)}
          />
        </div>
      )}

      {state.kind === "not_telegram" && (
        <div className="mt-6 max-w-xs">
          <h1 className="text-[18px] font-bold text-text">Откройте через Telegram</h1>
          <p className="mt-2 text-[14px] text-text-2">
            Это приложение запускается внутри Telegram. Откройте бот öz, чтобы
            продолжить.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <p className="mt-6 max-w-xs text-[14px]" style={{ color: "var(--error)" }}>
          {state.message}
        </p>
      )}
    </main>
  );
}
