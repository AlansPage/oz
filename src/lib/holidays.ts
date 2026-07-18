/**
 * Kazakh holiday table for the feed greeting banner.
 *
 * This is a hardcoded, hand-curated date table — NOT a computed calendar.
 * Islamic holiday dates (Ораза айт / Eid al-Fitr, Құрбан айт / Eid al-Adha)
 * are regionally declared in Kazakhstan and cannot be reliably computed at
 * runtime, so dates are curated by hand per year and MUST be verified by a
 * person before shipping. A wrong date is worse than no banner: leave the
 * clearly-marked "TODO: verify Kazakhstan date" placeholders commented out
 * rather than guessing any eid date.
 *
 * Scope is strictly Kazakh occasions (greeting text in Russian, the app's
 * language). Dates are evaluated in Asia/Seoul local time because users are
 * physically in Korea — the banner should flip on their clock. That timezone
 * choice is only about where the user is standing; this is not a
 * Korean-holiday feature.
 */

export type Holiday = {
  id: string; // e.g. "nauryz-2026"
  startDate: string; // "2026-03-21" (inclusive, Asia/Seoul)
  endDate: string; // "2026-03-22" (inclusive)
  greeting: string; // Russian-language greeting text
  emoji?: string; // optional single leading emoji
};

export const HOLIDAYS: Holiday[] = [
  {
    id: "nauryz-2026",
    startDate: "2026-03-21",
    endDate: "2026-03-22",
    greeting: "С Наурызом!",
    emoji: "🌷",
  },
  {
    id: "nauryz-2027",
    startDate: "2027-03-21",
    endDate: "2027-03-22",
    greeting: "С Наурызом!",
    emoji: "🌷",
  },
  // TODO: verify Kazakhstan date — Ораза айт (Eid al-Fitr). Declared
  // regionally; do not uncomment until a person confirms the official date.
  // {
  //   id: "oraza-ait-2026",
  //   startDate: "TODO: verify Kazakhstan date",
  //   endDate: "TODO: verify Kazakhstan date",
  //   greeting: "С праздником Ораза айт!",
  //   emoji: "🌙",
  // },
  // TODO: verify Kazakhstan date — Құрбан айт (Eid al-Adha). Declared
  // regionally; do not uncomment until a person confirms the official date.
  // {
  //   id: "kurban-ait-2026",
  //   startDate: "TODO: verify Kazakhstan date",
  //   endDate: "TODO: verify Kazakhstan date",
  //   greeting: "С праздником Құрбан айт!",
  //   emoji: "🌙",
  // },
];

/**
 * The holiday active at `now`, evaluated against each entry's inclusive
 * [startDate, endDate] range in Asia/Seoul local time (never the server's
 * local time or naive UTC). Returns the first match, else null.
 */
export function activeHoliday(now: Date): Holiday | null {
  // en-CA formats as YYYY-MM-DD, which compares correctly as a string.
  const seoulDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  for (const h of HOLIDAYS) {
    if (seoulDate >= h.startDate && seoulDate <= h.endDate) {
      return h;
    }
  }
  return null;
}
