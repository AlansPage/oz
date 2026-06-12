// Deploy an edge function via the Management API (no CLI login here).
// Usage:
//   SUPABASE_ACCESS_TOKEN=... node scripts/deploy-edge-function.mjs <slug> [verify_jwt]
// verify_jwt defaults to the function's current setting, or false for a
// new function (custom-secret auth, same as the pg_net trigger callers).
import { readFileSync } from "node:fs";

const ref = "sdgdeuhligplyemhuirn";
const token = process.env.SUPABASE_ACCESS_TOKEN;
const slug = process.argv[2];
if (!token || !slug) {
  console.error("need SUPABASE_ACCESS_TOKEN and a function slug");
  process.exit(1);
}

const headers = { Authorization: `Bearer ${token}` };

const listRes = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/functions`,
  { headers },
);
const existing = listRes.ok
  ? (await listRes.json()).find((f) => f.slug === slug)
  : undefined;
const verifyJwt =
  process.argv[3] !== undefined
    ? process.argv[3] === "true"
    : (existing?.verify_jwt ?? false);

const source = readFileSync(`supabase/functions/${slug}/index.ts`, "utf8");
const form = new FormData();
form.append(
  "metadata",
  JSON.stringify({ name: slug, entrypoint_path: "index.ts", verify_jwt: verifyJwt }),
);
form.append(
  "file",
  new Blob([source], { type: "text/typescript" }),
  "index.ts",
);

const res = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/functions/deploy?slug=${slug}`,
  { method: "POST", headers, body: form },
);
const body = await res.text();
console.log(res.status, body.slice(0, 1000));
process.exit(res.ok ? 0 : 1);
