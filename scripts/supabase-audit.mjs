#!/usr/bin/env node
/**
 * Read-only Supabase health & security audit for öz.
 *
 * SAFE TO RUN ANYTIME — issues only GET advisor calls and SELECT queries via
 * the Management API. No writes, no DDL, no load. Use this as the routine
 * "test the database" check.
 *
 * Usage:
 *   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/supabase-audit.mjs
 *   (optional) SUPABASE_PROJECT_REF=<ref>   # defaults to öz prod ref
 *
 * Exit code is non-zero if a hard failure is found (e.g. a public table with
 * RLS disabled), so it can gate CI.
 */

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || "sdgdeuhligplyemhuirn";
const API = "https://api.supabase.com";

if (!TOKEN) {
  console.error("✖ SUPABASE_ACCESS_TOKEN is required");
  process.exit(2);
}

const H = { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" };
let failures = 0;

async function getJson(path) {
  const res = await fetch(`${API}${path}`, { headers: H });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

async function query(sql) {
  const res = await fetch(`${API}/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json();
  if (!res.ok || (body && body.message)) {
    throw new Error(`query failed: ${body.message || res.status}`);
  }
  return body;
}

function section(title) {
  console.log(`\n── ${title} ${"─".repeat(Math.max(0, 56 - title.length))}`);
}

async function advisors(kind) {
  const j = await getJson(`/v1/projects/${REF}/advisors/${kind}`);
  const lints = Array.isArray(j) ? j : j.lints || [];
  const byLevel = {};
  for (const l of lints) byLevel[l.level] = (byLevel[l.level] || 0) + 1;
  console.log(`${kind} advisors:`, JSON.stringify(byLevel));
  for (const l of lints) {
    const name = (l.metadata && l.metadata.name) || "";
    console.log(`  [${l.level}] ${l.name}${name ? ` :: ${name}` : ""}`);
    if (l.level === "ERROR") failures++;
  }
}

async function rlsCoverage() {
  const rows = await query(
    `select c.relname as tbl, c.relrowsecurity as rls,
       (select count(*) from pg_policies p where p.schemaname='public' and p.tablename=c.relname) as policies
     from pg_class c join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='public' and c.relkind='r' order by c.relname`,
  );
  const off = [];
  for (const r of rows) {
    console.log(`  ${r.rls ? "RLS" : "OFF"}  ${String(r.policies).padStart(2)}p  ${r.tbl}`);
    if (!r.rls) off.push(r.tbl);
  }
  if (off.length) {
    console.log(`✖ RLS DISABLED on: ${off.join(", ")}`);
    failures += off.length;
  } else {
    console.log(`✔ All ${rows.length} public tables have RLS enabled`);
  }
}

async function bindingSchema() {
  // The Mini App binding upsert relies on a PK/unique on telegram_links.phone.
  const rows = await query(
    `select conname, contype, pg_get_constraintdef(oid) as def
     from pg_constraint where conrelid='public.telegram_links'::regclass
     order by contype desc`,
  );
  let hasPhoneKey = false;
  for (const r of rows) {
    console.log(`  ${r.contype}  ${r.def}`);
    if (/\b(PRIMARY KEY|UNIQUE)\b.*\(phone\)/.test(r.def)) hasPhoneKey = true;
  }
  if (hasPhoneKey) {
    console.log("✔ telegram_links.phone has a key — onConflict upsert is valid");
  } else {
    console.log("✖ telegram_links.phone lacks a PK/UNIQUE — binding upsert would fail");
    failures++;
  }
}

async function tableSizes() {
  const rows = await query(
    `select relname as tbl, n_live_tup as rows
     from pg_stat_user_tables where schemaname='public'
     order by n_live_tup desc`,
  );
  for (const r of rows) console.log(`  ${String(r.rows).padStart(8)}  ${r.tbl}`);
}

async function main() {
  console.log(`öz Supabase audit — project ${REF}`);

  section("Security advisors");
  await advisors("security");

  section("Performance advisors");
  await advisors("performance");

  section("RLS coverage (public tables)");
  await rlsCoverage();

  section("Binding schema (telegram_links)");
  await bindingSchema();

  section("Table sizes (live row estimates)");
  await tableSizes();

  section("Result");
  if (failures > 0) {
    console.log(`✖ ${failures} hard finding(s)`);
    process.exit(1);
  }
  console.log("✔ No hard findings (advisor WARN/INFO are reviewed manually)");
}

main().catch((e) => {
  console.error("audit error:", e.message);
  process.exit(2);
});
