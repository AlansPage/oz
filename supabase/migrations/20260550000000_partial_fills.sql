-- =====================================================================
-- Partial fills: a listing is INVENTORY that many transactions draw down,
-- not a single all-or-nothable amount. The dealer feature.
--
-- Derived-authority model (the whole point — do not regress to a counter):
--   * listings.amount is the immutable posted total.
--   * Remaining inventory is DERIVED: amount - sum(amount of transactions
--     that currently claim inventory). It is NEVER stored as a decremented
--     counter that cancellation would have to compensate-restore.
--   * listings.remaining_amount is a DISPLAY CACHE only, refreshed by an
--     AFTER trigger. The authority for "can this fill happen" is always a
--     fresh sum() taken inside the create_transaction FOR UPDATE lock.
--
-- Because remaining is derived, cancellation needs ZERO special-case
-- restore logic: a cancelled row drops out of transaction_claims_inventory,
-- so the freed inventory simply reappears in the next sum. That lets us
-- delete the old compensating writes (lock_listing_on_transaction and the
-- advance_transaction cancel-restore) and make ONE trigger the sole
-- authority for listing.status — killing the restore races a mutable
-- counter creates.
--
-- Inventory-claim rule (one place, shared by the sum and any future view):
-- a transaction holds inventory while live (pending_sender_payment,
-- sender_paid, counterparty_confirmed, counterparty_paid) or completed, and
-- while disputed (a dispute may still resolve to completed — releasing it
-- early would over-allocate the listing). Only 'cancelled' releases.
--
-- Untouched on purpose: the transaction state machine, receipts, the
-- name-match checkpoint and the freeze guard. The only downstream change is
-- relocating listing.status bookkeeping into the derived trigger (§6),
-- which is what "zero special-case restore logic" requires.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. The inventory-claim predicate. Immutable so it inlines into the sum
--    and so the rule lives in exactly one place.
-- ---------------------------------------------------------------------
create or replace function public.transaction_claims_inventory(p_status text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in (
    'pending_sender_payment',
    'sender_paid',
    'counterparty_confirmed',
    'counterparty_paid',
    'completed',
    'disputed'
  );
$$;

revoke execute on function public.transaction_claims_inventory(text) from public;
revoke execute on function public.transaction_claims_inventory(text) from anon;
revoke execute on function public.transaction_claims_inventory(text) from authenticated;

-- ---------------------------------------------------------------------
-- 2. Display cache. Nullable: null = "not yet computed", treated as full.
-- ---------------------------------------------------------------------
alter table public.listings
  add column remaining_amount numeric(12,2);

-- ---------------------------------------------------------------------
-- 3. refresh_listing_remaining: recompute the cache AND the derived status
--    from the claiming sum. Single authority for active/matched/completed.
--    SECURITY DEFINER so the trigger can write listings the initiator does
--    not own; never disturbs withdrawn/expired listings.
-- ---------------------------------------------------------------------
create or replace function public.refresh_listing_remaining(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount    numeric;
  v_claimed   numeric;
  v_remaining numeric;
  v_live      boolean;
  v_status    text;
begin
  select l.amount into v_amount
    from public.listings l
   where l.id = p_listing_id;
  if not found then
    return;
  end if;

  -- The derived authority: sum of every transaction still claiming inventory.
  select coalesce(sum(t.amount), 0),
         bool_or(t.status <> 'completed')
    into v_claimed, v_live
    from public.transactions t
   where t.listing_id = p_listing_id
     and public.transaction_claims_inventory(t.status);

  v_remaining := v_amount - v_claimed;

  -- remaining > 0          -> inventory available           -> active
  -- remaining = 0, live    -> fully claimed, deals in flight -> matched
  -- remaining = 0, no live -> fully claimed, all completed   -> completed
  if v_remaining > 0 then
    v_status := 'active';
  elsif coalesce(v_live, false) then
    v_status := 'matched';
  else
    v_status := 'completed';
  end if;

  update public.listings
     set remaining_amount = v_remaining,
         status = v_status
   where id = p_listing_id
     and status in ('active', 'matched', 'completed');
end;
$$;

revoke execute on function public.refresh_listing_remaining(uuid) from public;
revoke execute on function public.refresh_listing_remaining(uuid) from anon;
revoke execute on function public.refresh_listing_remaining(uuid) from authenticated;

-- ---------------------------------------------------------------------
-- 4. Trigger: refresh the listing whenever inventory could have changed.
--    Mirrors transactions_recompute_tiers (20260542). `update of status`
--    fires on every fill INSERT and every state-machine transition (all of
--    which SET status), but NOT on the name-mismatch report/resolve writes
--    (which touch name_mismatch_at only) — those don't move inventory.
-- ---------------------------------------------------------------------
create or replace function public.transactions_refresh_listing_remaining()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.refresh_listing_remaining(new.listing_id);
  return new;
end;
$$;

revoke execute on function public.transactions_refresh_listing_remaining() from public;
revoke execute on function public.transactions_refresh_listing_remaining() from anon;
revoke execute on function public.transactions_refresh_listing_remaining() from authenticated;

drop trigger if exists transactions_refresh_listing_remaining on public.transactions;
create trigger transactions_refresh_listing_remaining
  after insert or update of status on public.transactions
  for each row
  execute function public.transactions_refresh_listing_remaining();

-- ---------------------------------------------------------------------
-- 5. create_transaction: identical to 20260544 plus the partial-fill draw.
--    Signature gains p_fill_amount (default null = full remaining), so the
--    arg list changes and the old 2-arg version must be dropped first.
-- ---------------------------------------------------------------------
drop function if exists public.create_transaction(uuid, numeric);

create or replace function public.create_transaction(
  p_listing_id uuid,
  p_rate numeric default null,
  p_fill_amount numeric default null
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_listing public.listings;
  v_currency text;
  v_pm      public.payment_methods;
  v_initiator_deals integer;
  v_owner_deals     integer;
  v_rate            numeric;
  v_kzt_equivalent  numeric;
  v_remaining       numeric;
  v_tx      public.transactions;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  -- Lock the listing so two initiators cannot draw it down concurrently.
  select * into v_listing
    from public.listings
   where id = p_listing_id
   for update;
  if not found then
    raise exception 'listing_not_found';
  end if;

  if v_listing.status <> 'active' or v_listing.expires_at <= now() then
    raise exception 'listing_not_available';
  end if;

  if v_listing.user_id = v_uid then
    raise exception 'cannot_transact_own_listing';
  end if;

  -- Authority for the fill: a fresh summed read of claiming transactions
  -- UNDER THE LOCK, never the cached remaining_amount column.
  v_remaining := v_listing.amount - coalesce((
    select sum(t.amount)
      from public.transactions t
     where t.listing_id = v_listing.id
       and public.transaction_claims_inventory(t.status)
  ), 0);

  if v_remaining <= 0 then
    raise exception 'listing_not_available';
  end if;

  -- Default a null fill to the whole remaining: full-fill = today's
  -- behavior, so existing callers and full takers are unchanged.
  if p_fill_amount is null then
    p_fill_amount := v_remaining;
  end if;

  if p_fill_amount <= 0 then
    raise exception 'fill_invalid';
  end if;
  if p_fill_amount > v_remaining then
    raise exception 'fill_exceeds_remaining';
  end if;
  -- Honor the dealer's minimum, but always let someone clear the entire
  -- remaining even when that last scrap is below the minimum.
  if v_listing.min_match_amount is not null
     and p_fill_amount < v_listing.min_match_amount
     and p_fill_amount <> v_remaining
  then
    raise exception 'fill_below_minimum';
  end if;

  -- Currency the initiator (sender) will pay in is the listing's "from" side.
  v_currency := case v_listing.direction
    when 'kzt_to_krw' then 'KZT'
    else 'KRW'
  end;

  -- The initiator pays v_currency to the counterparty, so the counterparty
  -- must have a default payout method in that currency (else the SendScreen
  -- reveal would be empty).
  select * into v_pm
    from public.payment_methods pm
   where pm.user_id = v_listing.user_id
     and pm.currency = v_currency
     and pm.is_default = true;
  if not found then
    raise exception 'counterparty_no_payment_method';
  end if;

  -- Account-takeover freeze: the rail the initiator is about to send to
  -- must have been stable for 24 hours (see 20260544 header comment).
  if v_pm.details_changed_at > now() - interval '24 hours' then
    raise exception 'payment_method_too_new';
  end if;

  -- First-deal cap: parties with < 3 completed deals are limited to the
  -- equivalent of 500 000 KZT. The cap evaluates THIS FILL, not the posted
  -- total — a capped new user taking a 100k fill of a dealer's 500k listing
  -- is the most common healthy first deal, and dealers are the safest
  -- counterparties. deals_count is maintained by the completion trigger
  -- (20260543), never written by clients.
  select p.deals_count into v_initiator_deals from public.profiles p where p.id = v_uid;
  select p.deals_count into v_owner_deals     from public.profiles p where p.id = v_listing.user_id;

  if coalesce(v_initiator_deals, 0) < 3 or coalesce(v_owner_deals, 0) < 3 then
    v_rate := coalesce(v_listing.rate, p_rate);
    if v_listing.amount_currency = 'KZT' then
      v_kzt_equivalent := p_fill_amount;
    elsif v_rate is not null and v_rate > 0 then
      -- rate is defined as 1 KZT = v_rate KRW.
      v_kzt_equivalent := p_fill_amount / v_rate;
    else
      v_kzt_equivalent := null;  -- unpriceable KRW listing
    end if;

    if v_kzt_equivalent is null or v_kzt_equivalent > 500000 then
      raise exception 'first_deal_limit_exceeded';
    end if;
  end if;

  -- All money-movement fields come from the listing, never the client, except
  -- the validated fill amount. Rate is the listing's fixed rate when set,
  -- otherwise the caller's locked display rate (informational; both confirm).
  -- The listing's status (matched/active/completed) and remaining_amount are
  -- set by the AFTER INSERT trigger (transactions_refresh_listing_remaining),
  -- the single derived authority — no inline status write here.
  insert into public.transactions
    (listing_id, initiator_id, counterparty_id, direction, amount,
     amount_currency, rate)
  values
    (v_listing.id, v_uid, v_listing.user_id, v_listing.direction,
     p_fill_amount, v_currency, coalesce(v_listing.rate, p_rate))
  returning * into v_tx;

  return v_tx;
end;
$$;

revoke execute on function public.create_transaction(uuid, numeric, numeric) from public, anon;
grant execute on function public.create_transaction(uuid, numeric, numeric) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Relocate listing.status bookkeeping to the derived trigger.
--    (a) Drop lock_listing_on_transaction: it flipped the listing to
--        'matched' on ANY insert, which would wrongly close a partially
--        filled listing. The §4 trigger now derives the status instead.
--    (b) Redefine advance_transaction IDENTICAL to 20260547 minus only the
--        cancel-restore lines — on cancel, the status UPDATE fires §4 and
--        the freed inventory reappears in the sum, returning the listing to
--        'active' with no special-case code. The state machine, the
--        name_mismatch_frozen guard and every *_at stamp are byte-for-byte.
-- ---------------------------------------------------------------------
drop trigger if exists transactions_lock_listing on public.transactions;
drop function if exists public.lock_listing_on_transaction();

create or replace function public.advance_transaction(
  p_transaction_id uuid,
  p_action text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_uid uuid := (select auth.uid());
  v_is_initiator boolean;
  v_is_counterparty boolean;
begin
  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found then raise exception 'transaction not found'; end if;

  v_is_initiator    := (v_uid = v_tx.initiator_id);
  v_is_counterparty := (v_uid = v_tx.counterparty_id);

  if not (v_is_initiator or v_is_counterparty) then
    raise exception 'not a party to this transaction';
  end if;

  -- Server-side half of the Phase 4 freeze: while a recipient-name
  -- mismatch is unresolved, no state can advance. Cancel stays allowed —
  -- walking away is the reporter's legitimate exit.
  if v_tx.name_mismatch_at is not null and p_action <> 'cancel' then
    raise exception 'name_mismatch_frozen';
  end if;

  if p_action = 'initiator_mark_paid' then
    if not v_is_initiator then raise exception 'only initiator can do this'; end if;
    if v_tx.status <> 'pending_sender_payment' then raise exception 'wrong state'; end if;
    update public.transactions
       set status = 'sender_paid', initiator_paid_at = now()
     where id = p_transaction_id
     returning * into v_tx;

  elsif p_action = 'counterparty_confirm' then
    if not v_is_counterparty then raise exception 'only counterparty can do this'; end if;
    if v_tx.status <> 'sender_paid' then raise exception 'wrong state'; end if;
    update public.transactions
       set status = 'counterparty_confirmed', counterparty_confirmed_at = now()
     where id = p_transaction_id
     returning * into v_tx;

  elsif p_action = 'counterparty_mark_paid' then
    if not v_is_counterparty then raise exception 'only counterparty can do this'; end if;
    if v_tx.status <> 'counterparty_confirmed' then raise exception 'wrong state'; end if;
    update public.transactions
       set status = 'counterparty_paid', counterparty_paid_at = now()
     where id = p_transaction_id
     returning * into v_tx;

  elsif p_action = 'initiator_confirm' then
    if not v_is_initiator then raise exception 'only initiator can do this'; end if;
    if v_tx.status <> 'counterparty_paid' then raise exception 'wrong state'; end if;
    update public.transactions
       set status = 'completed',
           initiator_confirmed_at = now(),
           completed_at = now()
     where id = p_transaction_id
     returning * into v_tx;

  elsif p_action = 'cancel' then
    if v_tx.status not in ('pending_sender_payment') then
      raise exception 'can only cancel before any payment';
    end if;
    update public.transactions
       set status = 'cancelled'
     where id = p_transaction_id
     returning * into v_tx;
    -- No listing restore here: the status UPDATE above fires
    -- transactions_refresh_listing_remaining, which drops this cancelled row
    -- from the claiming sum and returns freed inventory to 'active'.

  else
    raise exception 'unknown action: %', p_action;
  end if;

  return v_tx;
end;
$$;

grant execute on function public.advance_transaction(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. Backfill: compute remaining_amount and correct status for every live
--    listing. A listing whose only deal already completed moves from the
--    legacy 'matched' to 'completed' (more correct under the derived model).
-- ---------------------------------------------------------------------
select public.refresh_listing_remaining(l.id)
  from public.listings l
 where l.status in ('active', 'matched');
