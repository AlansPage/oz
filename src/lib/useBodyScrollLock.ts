"use client";

import { useEffect } from "react";

// Sheets render through portals, so the page behind them keeps scrolling on
// touch unless the document is locked while any sheet is open. The lock is
// counted because sheets stack (e.g. ProfileGateSheet on top of
// PostListingSheet): scroll is restored only when the last sheet releases.
let lockCount = 0;

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const el = document.documentElement;
    lockCount += 1;
    if (lockCount === 1) el.style.overflow = "hidden";
    return () => {
      lockCount -= 1;
      if (lockCount === 0) el.style.overflow = "";
    };
  }, [active]);
}
