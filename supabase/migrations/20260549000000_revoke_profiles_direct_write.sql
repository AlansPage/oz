-- =====================================================================
-- Trust-integrity hardening: remove direct write access to `profiles`.
--
-- `restrict_profile_phone_select` (20260532) tightened SELECT but left the
-- default table-level INSERT/UPDATE/DELETE grants in place. Combined with the
-- `profiles_update_own` RLS policy (auth.uid() = id), that let any signed-in
-- user UPDATE their OWN row's trust columns straight through the Data API:
--
--   update profiles set verification_tier='verified_trader',
--     rating_avg=5, rating_count=999, deals_count=999 where id = auth.uid();
--
-- i.e. self-promote tiers, forge a 5-star reputation, and inflate deal counts,
-- defeating the verified_trader progression and the first-deal caps. It also
-- allowed spoofing `phone` / `phone_masked`.
--
-- No client code writes `profiles` directly: legitimate edits go through the
-- `update_profile_identity` SECURITY DEFINER RPC, trust columns are written
-- only by SECURITY DEFINER triggers/functions (recompute_verification_tier,
-- refresh_profile_rating, transactions_recompute_tiers), and profile creation
-- /repair runs as service_role (handle_new_user, verify-code). All of those
-- run as the function owner / service_role and are unaffected by this revoke.
-- =====================================================================

revoke insert, update, delete on public.profiles from authenticated, anon;

-- The own-row UPDATE policy is now dead (no underlying grant). Drop it so the
-- access model reads honestly: profiles are read-only to the Data API, mutated
-- only via SECURITY DEFINER RPCs and service_role.
drop policy if exists profiles_update_own on public.profiles;
