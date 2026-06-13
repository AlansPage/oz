/**
 * Thin typed wrapper over the Telegram WebApp JS SDK
 * (https://telegram.org/js/telegram-web-app.js), covering only the subset öz
 * uses. The SDK populates `window.Telegram.WebApp` at runtime; everything here
 * is browser-only and must be guarded by `getWebApp()` (returns null outside
 * Telegram / during SSR).
 *
 * SECURITY: `initData` is the signed string validated server-side
 * (see src/lib/telegram/initdata.ts). `initDataUnsafe` is UNSIGNED — never use
 * it for anything authorization-related; it's only for non-security UI hints
 * like `start_param` deep-link routing.
 */

export type TelegramThemeParams = {
  bg_color?: string;
  text_color?: string;
  hint_color?: string;
  link_color?: string;
  button_color?: string;
  button_text_color?: string;
  secondary_bg_color?: string;
  header_bg_color?: string;
  accent_text_color?: string;
  section_bg_color?: string;
  destructive_text_color?: string;
};

export type SafeAreaInset = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export type TelegramBackButton = {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
};

export type TelegramMainButton = {
  text: string;
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  setText: (text: string) => void;
  onClick: (cb: () => void) => void;
  offClick: (cb: () => void) => void;
  showProgress: (leaveActive?: boolean) => void;
  hideProgress: () => void;
  enable: () => void;
  disable: () => void;
};

export type HapticFeedback = {
  impactOccurred: (
    style: "light" | "medium" | "heavy" | "rigid" | "soft",
  ) => void;
  notificationOccurred: (type: "error" | "success" | "warning") => void;
  selectionChanged: () => void;
};

export type TelegramWebApp = {
  initData: string;
  initDataUnsafe: { start_param?: string; [k: string]: unknown };
  colorScheme: "light" | "dark";
  themeParams: TelegramThemeParams;
  viewportHeight: number;
  viewportStableHeight: number;
  /** Newer clients only — guard before use. */
  safeAreaInset?: SafeAreaInset;
  contentSafeAreaInset?: SafeAreaInset;
  isExpanded: boolean;
  version: string;
  BackButton: TelegramBackButton;
  MainButton: TelegramMainButton;
  HapticFeedback: HapticFeedback;
  ready: () => void;
  expand: () => void;
  close: () => void;
  /** Newer clients only — guard before use. */
  disableVerticalSwipes?: () => void;
  enableVerticalSwipes?: () => void;
  requestContact?: (cb: (granted: boolean) => void) => void;
  openTelegramLink: (url: string) => void;
  onEvent: (event: string, cb: () => void) => void;
  offEvent: (event: string, cb: () => void) => void;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** The live WebApp object, or null outside Telegram / during SSR. */
export function getWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null;
  return window.Telegram?.WebApp ?? null;
}

/**
 * True iff we're running inside a Telegram Mini App. Presence of a non-empty
 * `initData` is the reliable signal (the SDK object can exist in odd contexts,
 * but only a real launch carries signed initData).
 */
export function isMiniApp(): boolean {
  const wa = getWebApp();
  return Boolean(wa && wa.initData);
}

/**
 * Haptic helpers. No-op outside Telegram (getWebApp() is null) and on older
 * clients that lack HapticFeedback, so call sites can fire them unconditionally.
 */
export function hapticImpact(
  style: "light" | "medium" | "heavy" | "rigid" | "soft" = "medium",
): void {
  try {
    getWebApp()?.HapticFeedback?.impactOccurred(style);
  } catch {
    // best-effort polish; never let haptics break an action
  }
}

export function hapticNotification(type: "success" | "warning" | "error"): void {
  try {
    getWebApp()?.HapticFeedback?.notificationOccurred(type);
  } catch {
    // best-effort polish
  }
}
