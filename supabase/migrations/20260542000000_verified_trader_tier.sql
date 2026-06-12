-- =====================================================================
-- Phase 5.1: activate the verified_trader tier.
--
-- profiles.verification_tier has sat at 'phone' for everyone since init;
-- the gold badge existed in the UI but nothing ever awarded it. This
-- migration makes the tier real and time-based: recompute_verification_tier
-- promotes a user to 'verified_trader' when all four hold:
--   * >= 5 completed transactions (either side),
--   * >= 3 distinct counterparties across them,
--   * account age >= 14 days,
--   * no open disputes (no 'disputed' transaction they are party to).
--
-- Promotion only — the function never demotes. A dispute blocks future
-- promotion but does not strip an earned badge; stripping reputation is
-- an admin decision, not an automatic one.
--
-- Wired into the completion path via an AFTER UPDATE trigger on
-- transactions (status -> 'completed'), so both parties are re-evaluated
-- the moment a deal closes. advance_transaction stays untouched.
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

-- Trigger-only plumbing; not callable from PostgREST.
revoke execute on function public.recompute_verification_tier(uuid) from public;
revoke execute on function public.recompute_verification_tier(uuid) from anon;
revoke execute on function public.recompute_verification_tier(uuid) from authenticated;

create or replace function public.transactions_recompute_tiers()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recompute_verification_tier(new.initiator_id);
  perform public.recompute_verification_tier(new.counterparty_id);
  return new;
end;
$$;

revoke execute on function public.transactions_recompute_tiers() from public;
revoke execute on function public.transactions_recompute_tiers() from anon;
revoke execute on function public.transactions_recompute_tiers() from authenticated;

drop trigger if exists transactions_recompute_tiers on public.transactions;
create trigger transactions_recompute_tiers
  after update on public.transactions
  for each row
  when (new.status = 'completed' and old.status is distinct from new.status)
  execute function public.transactions_recompute_tiers();

-- Backfill: evaluate everyone who has ever completed a deal, so users who
-- already cleared the bar get the badge now rather than on their next deal.
select public.recompute_verification_tier(u.id)
  from (
    select distinct t.initiator_id as id from public.transactions t where t.status = 'completed'
    union
    select distinct t.counterparty_id from public.transactions t where t.status = 'completed'
  ) u;
