-- =====================================================================
-- Phase 5.2: completed-deal counts as the public reputation number.
--
-- Ratings averages are gameable; counts of completed transactions are
-- harder to inflate (each one requires a real counterparty and a full
-- state-machine walk). profiles.deals_count denormalizes that count so
-- the feed can render «★ 4.8 · 12 сделок» without an N+1 aggregate.
--
-- Maintained by recompute_verification_tier, which already counts
-- completed transactions for the tier criteria — one function, one
-- source of truth, refreshed by the same completion trigger from 5.1.
--
-- 20260532 switched profiles to column-level SELECT grants, so the new
-- column must be granted explicitly or every PROFILE_COLUMNS select
-- breaks with "permission denied".
-- =====================================================================

alter table public.profiles
  add column deals_count integer not null default 0;

grant select (deals_count) on public.profiles to authenticated, anon;

create or replace function public.recompute_verification_tier(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_completed       integer;
  v_counterparties  integer;
  v_open_disputes   integer;
  v_age_ok          boolean;
begin
  select count(*),
         count(distinct case when t.initiator_id = p_user_id
                             then t.counterparty_id
                             else t.initiator_id end)
    into v_completed, v_counterparties
    from public.transactions t
   where t.status = 'completed'
     and (t.initiator_id = p_user_id or t.counterparty_id = p_user_id);

  update public.profiles
     set deals_count = v_completed
   where id = p_user_id
     and deals_count is distinct from v_completed;

  select count(*)
    into v_open_disputes
    from public.transactions t
   where t.status = 'disputed'
     and (t.initiator_id = p_user_id or t.counterparty_id = p_user_id);

  select p.created_at <= now() - interval '14 days'
    into v_age_ok
    from public.profiles p
   where p.id = p_user_id;

  if v_completed >= 5
     and v_counterparties >= 3
     and coalesce(v_age_ok, false)
     and v_open_disputes = 0
  then
    update public.profiles
       set verification_tier = 'verified_trader'
     where id = p_user_id
       and verification_tier <> 'verified_trader';
  end if;
end;
$$;

-- Backfill every profile that has a completed deal; the rest keep the
-- column default of 0.
select public.recompute_verification_tier(u.id)
  from (
    select distinct t.initiator_id as id from public.transactions t where t.status = 'completed'
    union
    select distinct t.counterparty_id from public.transactions t where t.status = 'completed'
  ) u;
