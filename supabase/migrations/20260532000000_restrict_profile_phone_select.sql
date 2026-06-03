-- =====================================================================
-- PII hardening, step 2 of 2 (BREAKING for old clients).
--
-- Removes raw `phone` readability for the `authenticated` and `anon`
-- roles. Because a column-level REVOKE does NOT subtract from a table-level
-- SELECT grant, we must revoke the table-level SELECT and re-grant SELECT
-- on every column EXCEPT `phone` (phone_masked included).
--
-- After this, `select *` / `profiles(*)` by anon/authenticated FAILS with
-- "permission denied for column phone". The app must already be selecting
-- explicit columns (see src/lib/profile-columns.ts) before this is applied.
-- service_role and postgres retain full access (used by edge functions,
-- the telegram webhook, and verify-code).
-- =====================================================================

revoke select on public.profiles from authenticated, anon;

grant select (
  id,
  display_name,
  avatar_url,
  verification_tier,
  rating_avg,
  rating_count,
  created_at,
  last_active_at,
  phone_masked
) on public.profiles to authenticated, anon;
