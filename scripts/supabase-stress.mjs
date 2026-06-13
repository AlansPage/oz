#!/usr/bin/env node
/**
 * Supabase load/stress harness for öz — for a Supabase BRANCH or STAGING clone,
 * never production.
 *
 * GUARDRAILS:
 *   - Refuses to run against the öz prod ref (sdgdeuhligplyemhuirn).
 *   - Requires SUPABASE_STRESS_TARGET_REF to be set explicitly.
 *   - Issues read-only SELECTs only — no writes. Even so, point it at a branch:
 *     load against prod degrades a live money app.
 *
 * To create a throwaway target, use a Supabase branch (db branching) or a
 * `supabase db dump | restore` into a scratch project, then pass its ref.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... \
 *   SUPABASE_STRESS_TARGET_REF=<non-prod-ref> \
 *   node scripts/supabase-stress.mjs --concurrency 20 --requests 500
 */

const PROD_REF = "sdgdeuhligplyemhuirn";
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_STRESS_TARGET_REF;
const API = "https://api.supabase.com";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? Number(process.argv[i + 1]) : def;
}
const CONCURRENCY = arg("concurrency", 10);
const REQUESTS = arg("requests", 200);

if (!TOKEN) {
  console.error("✖ SUPABASE_ACCESS_TOKEN is required");
  process.exit(2);
}
if (!REF) {
  console.error(
    "✖ SUPABASE_STRESS_TARGET_REF is required (a Supabase BRANCH/staging ref, not prod)",
  );
  process.exit(2);
}
if (REF === PROD_REF) {
  console.error(
    `✖ Refusing to stress the production project (${PROD_REF}). Use a branch/staging clone.`,
  );
  process.exit(3);
}

const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
// Read-only probe touching the indexes/planner without returning bulk data.
const SQL = "select count(*) from public.listings where created_at > now() - interval '30 days'";

async function once() {
  const t = performance.now();
  try {
    const res = await fetch(`${API}/v1/projects/${REF}/database/query`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ query: SQL }),
    });
    await res.text();
    return { ms: performance.now() - t, ok: res.ok };
  } catch {
    return { ms: performance.now() - t, ok: false };
  }
}

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[i]);
}

async function main() {
  console.log(
    `Stress: ${REQUESTS} read queries @ concurrency ${CONCURRENCY} → ${REF}`,
  );
  const lat = [];
  let ok = 0;
  let fail = 0;
  let issued = 0;
  const start = performance.now();

  async function worker() {
    while (issued < REQUESTS) {
      issued++;
      const r = await once();
      lat.push(r.ms);
      if (r.ok) ok++;
      else fail++;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const wall = (performance.now() - start) / 1000;
  lat.sort((a, b) => a - b);
  console.log(`\nwall:       ${wall.toFixed(1)}s`);
  console.log(`throughput: ${(REQUESTS / wall).toFixed(1)} req/s`);
  console.log(`ok / fail:  ${ok} / ${fail}`);
  console.log(`latency ms: p50=${pct(lat, 50)} p95=${pct(lat, 95)} p99=${pct(lat, 99)} max=${Math.round(lat[lat.length - 1] || 0)}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("stress error:", e.message);
  process.exit(2);
});
