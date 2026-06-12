// Phase 3-5 visual-consistency audit screenshots.
// Drives the dev-only harness at /dev/audit (src/app/dev/audit/page.tsx),
// stubbing Supabase REST + /api/rate at the network layer so every audited
// state renders deterministically without auth or live data.
//
// Usage: node scripts/audit-screenshots.mjs <before|after> [baseUrl]
//   (dev server must already be running with NEXT_PUBLIC_SUPABASE_URL
//    pointing at https://stub.supabase.co)
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const phase = process.argv[2];
if (!["before", "after"].includes(phase)) {
  console.error("usage: node scripts/audit-screenshots.mjs <before|after> [baseUrl]");
  process.exit(1);
}
const BASE = process.argv[3] ?? "http://localhost:3010";
const OUT = `design-handoff/phase5-audit/${phase}`;
mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { name: "320", width: 320, height: 720 },
  { name: "375", width: 375, height: 780 },
  { name: "430", width: 430, height: 900 },
  { name: "1280", width: 1280, height: 900 },
];

const PM_ROW = [
  {
    bank_name: "Kaspi Gold",
    recipient_name: "Айгерим Нурланова",
    account_number: "4400430212345678",
    currency: "KZT",
  },
];

// Each shot: harness query, optional reveal-RPC stub, optional interactions.
const SHOTS = [
  { name: "pm-form", s: "pm-form" },
  {
    name: "pm-bankpicker",
    s: "pm-form",
    act: async (page) => {
      await page.click("#oz-pm-bank");
      await page.waitForSelector(".oz-banklist");
    },
  },
  {
    name: "pm-form-error",
    s: "pm-form",
    act: async (page) => {
      await page.click("#oz-pm-bank");
      await page.click(".oz-banklist__item"); // first bank (Kaspi)
      await page.fill("#oz-pm-recipient", "Айгерим Нурланова");
      await page.fill("#oz-pm-account", "4400430212345670"); // fails Luhn
      await page.click("text=Сохранить");
      await page.waitForSelector(".oz-field-error, .oz-sheet__error");
    },
  },
  { name: "send-namecheck", s: "send", pm: { body: PM_ROW } },
  {
    name: "send-hold",
    s: "send",
    pm: { body: PM_ROW },
    act: async (page) => {
      await page.click("text=Да, совпадает");
      await page.waitForSelector(".tx-hold");
    },
  },
  { name: "send-frozen", s: "send-frozen", pm: { body: PM_ROW } },
  {
    name: "send-changed",
    s: "send-changed",
    pm: { status: 400, body: { message: "payment_details_changed_mid_deal", code: "P0001" } },
  },
  { name: "send-nopm", s: "send-nopm", pm: { body: [] } },
  { name: "mismatch-panel", s: "mismatch-panel" },
  { name: "cap-button", s: "cap-button" },
  { name: "confirm-sheet", s: "confirm-sheet" },
  {
    name: "confirm-sheet-limit",
    s: "confirm-sheet",
    create: { status: 400, body: { message: "first_deal_limit_exceeded", code: "P0001" } },
    act: async (page) => {
      await page.click("text=Подтвердить");
      await page.waitForSelector(".oz-sheet__error");
    },
  },
  {
    name: "confirm-sheet-toonew",
    s: "confirm-sheet",
    create: { status: 400, body: { message: "payment_method_too_new", code: "P0001" } },
    act: async (page) => {
      await page.click("text=Подтвердить");
      await page.waitForSelector(".oz-sheet__error");
    },
  },
  { name: "listing-card", s: "listing-card" },
  { name: "listing-hero", s: "listing-hero" },
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

    // Catch-all first: Playwright matches routes in reverse registration
    // order, so the specific RPC stubs below must be registered after it.
    await page.route("**/stub.supabase.co/**", (r) => r.fulfill({ json: [] }));

    await page.route("**/api/rate", (r) =>
      r.fulfill({
        json: { rate: 3.42, asOf: "2026-06-01T10:00:00Z", sparkline: [] },
      }),
    );
    await page.route("**/rest/v1/rpc/get_counterparty_payment_method**", (r) =>
      r.fulfill({
        status: shot.pm?.status ?? 200,
        json: shot.pm?.body ?? [],
      }),
    );
    await page.route("**/rest/v1/rpc/create_transaction**", (r) =>
      r.fulfill({
        status: shot.create?.status ?? 400,
        json: shot.create?.body ?? { message: "stub" },
      }),
    );
    await page.route("**/rest/v1/rpc/upsert_payment_method**", (r) =>
      r.fulfill({ status: 400, json: { message: "invalid_account_number", code: "P0001" } }),
    );
    let done = false;
    for (let attempt = 1; attempt <= 3 && !done; attempt++) {
      try {
        await page.goto(`${BASE}/dev/audit?s=${shot.s}`, { waitUntil: "load" });
        await page.waitForTimeout(400); // let stubbed fetches settle
        if (shot.act) await shot.act(page);
        await page.waitForTimeout(250);
        await page.screenshot({
          path: `${OUT}/${shot.name}@${vp.name}.png`,
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
      console.log(`${shot.name}@${vp.name}`);
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
