// Apply a migration file to the linked Supabase project via the Management
// API query endpoint. No CLI login / DB password in this environment — see
// the project workflow notes. Usage:
//   SUPABASE_ACCESS_TOKEN=... node scripts/apply-migration.mjs supabase/migrations/<file>.sql
import { readFileSync } from "node:fs";

const ref = "sdgdeuhligplyemhuirn";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const file = process.argv[2];
if (!token || !file) {
  console.error("need SUPABASE_ACCESS_TOKEN and a migration file argument");
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
console.log(res.status, body.slice(0, 2000));
process.exit(res.ok ? 0 : 1);
