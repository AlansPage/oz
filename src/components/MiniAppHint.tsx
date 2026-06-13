"use client";

import { useIsMiniApp } from "@/lib/telegram/useIsMiniApp";

const APP_BOT_URL = "https://t.me/oz_exchangebot";

/**
 * A deliberately understated "öz is on Telegram too" link. Self-hides when
 * we're already running inside the Mini App (no point telling a Telegram user
 * about the Telegram app). Styled to match the muted footer text, not to stand
 * out — non-obstructive by design.
 */
export function MiniAppHint({ className = "" }: { className?: string }) {
  const { isMiniApp } = useIsMiniApp();
  if (isMiniApp) return null;

  return (
    <a
      href={APP_BOT_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-[12px] text-text-3 hover:text-text-2 transition-colors ${className}`}
    >
      Теперь и в Telegram
      <span aria-hidden>→</span>
    </a>
  );
}
