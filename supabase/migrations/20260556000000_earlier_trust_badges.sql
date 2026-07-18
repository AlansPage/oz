-- =====================================================================
-- Cold-launch loosening B: verified_trader thresholds 5/3/14 -> 3/2/7.
--
-- With the 20260542 bar (>= 5 completed deals, >= 3 distinct
-- counterparties, account age >= 14 days, no open disputes) nobody in a
-- young market shows a trust badge for weeks, making the marketplace
-- look emptier than it is. Lowered to >= 3 deals, >= 2 counterparties,
-- >= 7 days (product decision, 2026-07-18). Trust-signal inflation
-- only — no money-movement control depends on the tier. Promotion-only
-- semantics and the no-open-disputes condition are unchanged, as is the
-- completion trigger wiring.
--
-- Backfill re-runs so users who already clear the lower bar get the
-- badge now rather than on their next completed deal.
-- =====================================================================

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

  select count(*)
    into v_open_disputes
    from public.transactions t
   where t.status = 'disputed'
     and (t.initiator_id = p_user_id or t.counterparty_id = p_user_id);

  select p.created_at <= now() - interval '7 days'
    into v_age_ok
    from public.profiles p
   where p.id = p_user_id;

  if v_completed >= 3
     and v_counterparties >= 2
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

revoke execute on function public.recompute_verification_tier(uuid) from public;
revoke execute on function public.recompute_verification_tier(uuid) from anon;
revoke execute on function public.recompute_verification_tier(uuid) from authenticated;

-- Re-evaluate everyone with completed deals under the lower bar.
select public.recompute_verification_tier(u.id)
  from (
    select distinct t.initiator_id as id from public.transactions t where t.status = 'completed'
    union
    select distinct t.counterparty_id from public.transactions t where t.status = 'completed'
  ) u;
