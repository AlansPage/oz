"use client";

import { createContext, useContext } from "react";

export type MiniAppContextValue = {
  /** True only inside a real Telegram Mini App launch (signed initData present). */
  isMiniApp: boolean;
  /** Telegram's light/dark mode; "light" outside Telegram. */
  colorScheme: "light" | "dark";
};

export const MiniAppContext = createContext<MiniAppContextValue>({
  isMiniApp: false,
  colorScheme: "light",
});

/**
 * Branch UI on Mini-App mode. Returns `{ isMiniApp:false }` for browser users,
 * so callers can safely render web-only chrome by default and hide it in Telegram.
 */
export function useIsMiniApp(): MiniAppContextValue {
  return useContext(MiniAppContext);
}
