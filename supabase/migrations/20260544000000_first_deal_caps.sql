-- =====================================================================
-- Phase 5.3: risk limits inside create_transaction.
--
-- Two new rejection paths, both server-side so the client cannot bypass
-- them (same contract as the existing exception codes):
--
--   first_deal_limit_exceeded — if the initiator OR the listing owner
--   has fewer than 3 completed deals, the transaction is capped at the
--   equivalent of 500 000 KZT. KRW listings are evaluated through the
--   listing's locked rate (listing.rate, else the caller's locked
--   display rate — the same value create_transaction already stores).
--   A KRW listing with no rate at all cannot be priced and is rejected
--   for capped parties rather than waved through.
--
--   payment_method_too_new — the listing owner's default payout method
--   in the transaction currency (the rail the initiator is about to send
--   real money to) must not have had its number or recipient name
--   changed in the last 24 hours. This is the account-takeover freeze:
--   an attacker who swaps the payout rail can't receive a transfer
--   during the window in which the legitimate owner gets the 5.4 alert.
--   Deliberately unconditional — takeovers target established accounts,
--   so it cannot be scoped to new users. Only the owner's receiving rail
--   is gated: the initiator's own method (often created moments earlier
--   via the gate sheet) receives the second leg and is not a takeover
--   profit vector at creation time.
--
-- payment_methods.details_changed_at backs the freeze: stamped on insert
-- and whenever account_number / recipient_name actually change (a no-op
-- re-save through upsert_payment_method does NOT bump it, unlike
-- updated_at). Existing rows backfill from created_at, not now(), so the
-- migration itself freezes nobody.
-- =====================================================================

alter table public.payment_methods
  add column details_changed_at timestamptz;

update public.payment_methods
   set details_changed_at = created_at;

alter table public.payment_methods
  alter column details_changed_at set not null,
  alter column details_changed_at set default now();

create or replace function public.payment_methods_stamp_details_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.account_number is distinct from old.account_number
     or new.recipient_name is distinct from old.recipient_name
  then
    new.details_changed_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.payment_methods_stamp_details_change() from public;
revoke execute on function public.payment_methods_stamp_details_change() from anon;
revoke execute on function public.payment_methods_stamp_details_change() from authenticated;

drop trigger if exists payment_methods_stamp_details_change on public.payment_methods;
create trigger payment_methods_stamp_details_change
  before update on public.payment_methods
  for each row
  execute function public.payment_methods_stamp_details_change();

-- ---------------------------------------------------------------------
-- create_transaction: identical to 20260534000000 plus the two limits.
-- ---------------------------------------------------------------------

create or replace function public.create_transaction(
  p_listing_id uuid,
  p_rate numeric default null
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
  v_tx      public.transactions;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  -- Lock the listing so two initiators cannot match it concurrently.
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
  -- must have been stable for 24 hours (see header comment).
  if v_pm.details_changed_at > now() - interval '24 hours' then
    raise exception 'payment_method_too_new';
  end if;

  -- First-deal cap: parties with < 3 completed deals are limited to the
  -- equivalent of 500 000 KZT. deals_count is maintained server-side by
  -- the completion trigger (20260543), never written by clients.
  select p.deals_count into v_initiator_deals from public.profiles p where p.id = v_uid;
  select p.deals_count into v_owner_deals     from public.profiles p where p.id = v_listing.user_id;

  if coalesce(v_initiator_deals, 0) < 3 or coalesce(v_owner_deals, 0) < 3 then
    v_rate := coalesce(v_listing.rate, p_rate);
    if v_listing.amount_currency = 'KZT' then
      v_kzt_equivalent := v_listing.amount;
    elsif v_rate is not null and v_rate > 0 then
      -- rate is defined as 1 KZT = v_rate KRW.
      v_kzt_equivalent := v_listing.amount / v_rate;
    else
      v_kzt_equivalent := null;  -- unpriceable KRW listing
    end if;

    if v_kzt_equivalent is null or v_kzt_equivalent > 500000 then
      raise exception 'first_deal_limit_exceeded';
    end if;
  end if;

  -- All money-movement fields come from the listing, never the client. Rate is
  -- the listing's fixed rate when set, otherwise the caller's locked display
  -- rate (informational; both parties see and confirm it).
  insert into public.transactions
    (listing_id, initiator_id, counterparty_id, direction, amount,
     amount_currency, rate)
  values
    (v_listing.id, v_uid, v_listing.user_id, v_listing.direction,
     v_listing.amount, v_currency, coalesce(v_listing.rate, p_rate))
  returning * into v_tx;

  return v_tx;
end;
$$;

revoke execute on function public.create_transaction(uuid, numeric) from public, anon;
grant execute on function public.create_transaction(uuid, numeric) to authenticated;
