"use client";

import { useEffect, useState } from "react";
import { getWebApp } from "@/lib/telegram/webapp";
import { MiniAppContext, type MiniAppContextValue } from "@/lib/telegram/useIsMiniApp";

/**
 * App-wide Mini-App shell. Mounted in the root layout so theme + safe-area
 * insets apply across every page once a user is inside Telegram — but it
 * STRICTLY NO-OPS for browser users (the effect early-returns when there's no
 * signed initData), so the web app is untouched.
 *
 * It writes:
 *   - `data-tg-theme="light|dark"` on <html> → scopes the dark palette in
 *     globals.css to Telegram dark mode only.
 *   - `--tg-safe-*` CSS vars from Telegram's safe-area + content insets →
 *     so content clears the Telegram header/footer chrome.
 * and re-applies them on Telegram's theme/viewport/safe-area change events.
 */
export function MiniAppProvider({ children }: { children: React.ReactNode }) {
  const [value, setValue] = useState<MiniAppContextValue>({
    isMiniApp: false,
    colorScheme: "light",
  });

  useEffect(() => {
    const wa = getWebApp();
    if (!wa || !wa.initData) return; // browser: no-op, web app unaffected

    const root = document.documentElement;

    const apply = () => {
      const scheme: "light" | "dark" = wa.colorScheme === "dark" ? "dark" : "light";
      root.setAttribute("data-tg-theme", scheme);

      const inset = wa.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
      const content =
        wa.contentSafeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
      root.style.setProperty("--tg-safe-top", `${inset.top + content.top}px`);
      root.style.setProperty(
        "--tg-safe-bottom",
        `${inset.bottom + content.bottom}px`,
      );
      root.style.setProperty("--tg-safe-left", `${inset.left}px`);
      root.style.setProperty("--tg-safe-right", `${inset.right}px`);

      setValue({ isMiniApp: true, colorScheme: scheme });
    };

    apply();
    const events = [
      "themeChanged",
      "safeAreaChanged",
      "contentSafeAreaChanged",
      "viewportChanged",
    ];
    events.forEach((e) => wa.onEvent(e, apply));

    return () => {
      events.forEach((e) => wa.offEvent(e, apply));
      root.removeAttribute("data-tg-theme");
    };
  }, []);

  return (
    <MiniAppContext.Provider value={value}>{children}</MiniAppContext.Provider>
  );
}
