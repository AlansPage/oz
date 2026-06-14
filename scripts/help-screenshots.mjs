// Help / contact-surface design-handoff screenshots.
// Captures the static /help page and the in-deal contact fallback (rendered via
// the dev-only /dev/audit harness, since the real transaction route needs auth
// + a tx row) at the three mobile widths the design system targets.
//
// Usage: node scripts/help-screenshots.mjs [baseUrl]
//   (dev server must already be running; defaults to http://localhost:3010)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3010";
const OUT = "design-handoff/help";
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "320", width: 320, height: 720 },
  { name: "375", width: 375, height: 780 },
  { name: "430", width: 430, height: 900 },
];

const SHOTS = [
  { name: "help", path: "/help", wait: ".oz-contact" },
  {
    name: "in-deal-contact-fallback",
    path: "/dev/audit?s=help-fallback",
    wait: ".oz-contact__inline",
  },
];

const browser = await chromium.launch();
let count = 0;
const failures = [];

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });

  for (const shot of SHOTS) {
    const page = await ctx.newPage();
    // /help is static; the audit harness needs no network for this surface.
    await page.route("**/api/rate", (r) =>
      r.fulfill({ json: { rate: 3.42, asOf: "2026-06-01T10:00:00Z", sparkline: [] } }),
    );
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        await page.goto(`${BASE}${shot.path}`, { waitUntil: "load" });
        await page.waitForSelector(shot.wait, { timeout: 5000 });
        await page.waitForTimeout(250);
        await page.screenshot({
          path: `${OUT}/${shot.name}-${vp.name}.png`,
          fullPage: true,
        });
        done = true;
      } catch (e) {
        if (attempt === 3) {
          failures.push(`${shot.name}@${vp.name}: ${e.message?.split("\n")[0]}`);
        } else {
          await page.waitForTimeout(1500);
        }
      }
    }
    await page.close();
    if (done) {
      count++;
      console.log(`${shot.name}-${vp.name}`);
    }
  }
  await ctx.close();
}

await browser.close();
if (failures.length) {
  console.error(`FAILED ${failures.length}:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`DONE ${count} screenshots -> ${OUT}`);
