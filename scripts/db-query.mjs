// Run a read-only SQL file against the linked Supabase project via the
// Management API query endpoint (same transport as apply-migration.mjs).
// Usage: SUPABASE_ACCESS_TOKEN=... node scripts/db-query.mjs <file>.sql
import { readFileSync } from "node:fs";

const ref = "sdgdeuhligplyemhuirn";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const file = process.argv[2];
if (!token || !file) {
  console.error("need SUPABASE_ACCESS_TOKEN and a sql file argument");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql }),
  },
);
const body = await res.text();
console.log(res.status);
console.log(body);
process.exit(res.ok ? 0 : 1);
