"use client";

import { useState } from "react";
import { activeHoliday } from "@/lib/holidays";

/**
 * Slim, dismissible holiday greeting for the feed — display-only, additive.
 * Renders nothing outside a holiday window. Dismissal is session-state only
 * (React state, no storage — project convention), so it reappears on the
 * next load, which is fine for a greeting.
 */
export function HolidayBanner() {
  const [dismissed, setDismissed] = useState(false);
  const holiday = activeHoliday(new Date());

  if (!holiday || dismissed) return null;

  return (
    <div className="relative flex items-center justify-center gap-2 px-10 py-2.5 border-b border-border bg-surface">
      <p className="text-[13px] text-text-2 text-center leading-snug">
        {holiday.emoji ? `${holiday.emoji} ` : ""}
        {holiday.greeting}
      </p>
      <button
        type="button"
        aria-label="Скрыть"
        onClick={() => setDismissed(true)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-3 text-[16px] leading-none p-1"
      >
        ×
      </button>
    </div>
  );
}
