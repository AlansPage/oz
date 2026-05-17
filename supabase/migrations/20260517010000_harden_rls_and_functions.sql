-- Hardens the initial marketplace migration after running Supabase's
-- security + performance advisors:
--
-- 1. RLS perf — auth.uid() was being re-evaluated per row. Wrapping it in
--    (select auth.uid()) lets the planner evaluate it once per query.
--    (Database linter rule 0003 — auth_rls_initplan.)
--
-- 2. Lock the listings_prevent_immutable_updates function's search_path
--    so it cannot be influenced by the caller's session search_path.
--
-- 3. Revoke EXECUTE on handle_new_user from PUBLIC/anon/authenticated.
--    It is only meant to fire as an AFTER INSERT trigger on auth.users;
--    leaving it grantable would let any REST client invoke it via
--    /rest/v1/rpc/handle_new_user and create profile rows directly.
--    Triggers run as the function owner regardless of EXECUTE grants.

-- ---------- 1. RLS policy rewrites ----------

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists listings_select_active_or_own on public.listings;
create policy listings_select_active_or_own on public.listings
  for select
  to authenticated
  using (
    (status = 'active' and expires_at > now())
    or user_id = (select auth.uid())
  );

drop policy if exists listings_insert_own on public.listings;
create policy listings_insert_own on public.listings
  for insert
  to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists listings_update_own on public.listings;
create policy listings_update_own on public.listings
  for update
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- 2. Lock trigger function search_path ----------

alter function public.listings_prevent_immutable_updates()
  set search_path = '';

-- ---------- 3. Revoke RPC access on handle_new_user ----------

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
