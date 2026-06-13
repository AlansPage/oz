# Supabase database tests

Tooling to test the öz Supabase backend. **Production safety is the rule:** the
audit is read-only and safe anytime; the stress harness refuses the prod ref.

The Management API token (`sbp_...`) is a secret — pass it via the
`SUPABASE_ACCESS_TOKEN` env var, never commit it.

## `npm run db:audit` — read-only health & security audit

Safe to run against production (GET advisors + SELECT only, no writes). Reports:

- Supabase **security advisors** (RLS gaps, exposed SECURITY DEFINER fns, …)
- **performance advisors** (unindexed FKs, unused indexes)
- **RLS coverage** — fails if any `public` table has RLS disabled
- **binding schema** — verifies `telegram_links.phone` has a key (the Mini App
  `onConflict` upsert depends on it)
- **table sizes** (live row estimates)

```bash
SUPABASE_ACCESS_TOKEN=sbp_... npm run db:audit
# optional: SUPABASE_PROJECT_REF=<ref>   (defaults to öz prod)
```

Exit code is non-zero on a hard finding (e.g. RLS disabled), so it can gate CI.

## `npm run db:stress` — load harness (branch/staging ONLY)

Concurrent read-only queries to measure latency under load. **Refuses the prod
ref** and requires an explicit non-prod target — point it at a Supabase
**branch** or a staging clone, never production (load degrades a live money app).

```bash
SUPABASE_ACCESS_TOKEN=sbp_... \
SUPABASE_STRESS_TARGET_REF=<non-prod-ref> \
npm run db:stress -- --concurrency 20 --requests 500
```

Reports throughput and p50/p95/p99 latency. To get a target, create a Supabase
db branch or restore a dump into a scratch project and use its ref.

## Why no write/stress against prod

öz is a live P2P money exchange. Generating write load against production would
pollute `transactions`/`profiles`/trust data, trip rate limits, and degrade
service for real users. Write-path load testing belongs on a disposable branch
with seeded data — out of scope for this read-only tooling.
