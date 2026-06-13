"use client";

import Script from "next/script";
import { useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { MiniAppBoot } from "@/components/telegram/MiniAppBoot";

/**
 * Telegram Mini App entry route. The BotFather Web App URL points here
 * (https://oz-flame.vercel.app/tg). We load the official Telegram WebApp SDK,
 * then mount the bootstrap once it's populated `window.Telegram.WebApp` — so
 * MiniAppBoot never reads a missing SDK and mis-detects "not in Telegram".
 *
 * `afterInteractive` (not `beforeInteractive`) keeps this off the root layout;
 * the brief splash below covers the load. App Router restricts
 * `beforeInteractive` to the root layout, which we intentionally leave untouched.
 */
export default function TelegramEntryPage() {
  const [sdkReady, setSdkReady] = useState(false);

  return (
    <>
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
      />
      {sdkReady ? (
        <MiniAppBoot />
      ) : (
        <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-8 bg-bg">
          <BrandMark size={56} />
        </main>
      )}
    </>
  );
}
