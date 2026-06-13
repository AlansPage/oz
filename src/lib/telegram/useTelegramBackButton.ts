"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getWebApp } from "./webapp";

/**
 * Drive Telegram's native BackButton from a detail screen. No-op for browser
 * users (the web back affordance handles them). Shows the BackButton on mount,
 * routes back on tap, and hides it on unmount so top-level screens stay clean.
 */
export function useTelegramBackButton(enabled: boolean = true): void {
  const router = useRouter();

  useEffect(() => {
    const wa = getWebApp();
    if (!wa || !wa.initData) return; // browser: no-op

    const bb = wa.BackButton;
    if (!enabled) {
      bb.hide();
      return;
    }

    const handler = () => router.back();
    bb.onClick(handler);
    bb.show();

    return () => {
      bb.offClick(handler);
      bb.hide();
    };
  }, [enabled, router]);
}
