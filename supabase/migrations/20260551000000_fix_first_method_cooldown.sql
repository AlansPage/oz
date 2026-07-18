-- =====================================================================
-- Bugfix: the Phase 5 recent-change cooldown blocked 100% of first deals.
--
-- 20260544 introduced payment_methods.details_changed_at with a NOT NULL
-- DEFAULT now(), so a payout method got stamped as "just changed" the
-- instant it was CREATED. create_transaction's freeze
-- (`details_changed_at > now() - 24h`) therefore fired on first-time
-- creation, not just on edits: a brand-new user who added their payout
-- details and immediately tried to transact got "Реквизиты были изменены
-- недавно" and was frozen for 24 hours — blocking their first deal.
--
-- The recent-change cooldown must apply ONLY to edits of an existing
-- method, never to first-time creation. We stop stamping
-- details_changed_at on INSERT (it stays null until a genuine edit) and
-- teach the create_transaction guard to read null as "never edited =
-- not on cooldown".
--
-- Untouched on purpose: the mid-deal swap guard in 20260548
-- (get_counterparty_payment_method: details_changed_at > tx.created_at).
-- A never-edited method has null details_changed_at, and `null > ts` is
-- NULL (not true), so that guard already does the right thing on a
-- pre-deal creation; it still freezes a deal whose rail is edited AFTER
-- the transaction is created, because that edit stamps now() via the
-- 20260544 BEFORE UPDATE trigger. No change needed or made there.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Stop stamping details_changed_at on creation. Drop the DEFAULT so a
--    plain INSERT (the upsert RPC's create path) leaves it null, and drop
--    NOT NULL so null is a legal "never edited since creation" state. The
--    20260544 BEFORE UPDATE trigger still stamps now() on a genuine edit
--    of account_number / recipient_name — that path is unchanged.
-- ---------------------------------------------------------------------
alter table public.payment_methods
  alter column details_changed_at drop default,
  alter column details_changed_at drop not null;

-- ---------------------------------------------------------------------
-- 2. Backfill: null out any method still showing its creation timestamp.
--    Rows inserted under the old default have details_changed_at exactly
--    equal to created_at (now() is constant within a single INSERT txn),
--    as do the rows 20260544 backfilled from created_at. A genuinely
--    edited method has details_changed_at > created_at and is left intact,
--    so its cooldown / mid-deal protection is preserved.
-- ---------------------------------------------------------------------
update public.payment_methods
   set details_changed_at = null
 where details_changed_at = created_at;

-- ---------------------------------------------------------------------
-- 3. create_transaction: identical to 20260550 except the takeover freeze
--    now treats a null details_changed_at as "no recent change". Signature
--    (uuid, numeric, numeric) is unchanged, so OR REPLACE is sufficient.
-- ---------------------------------------------------------------------

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
  -- must have been stable for 24 hours (see 20260544 header comment). A
  -- null details_changed_at means the method has NEVER been edited since
  -- creation — it is not "recently changed" and is never on cooldown, so a
  -- brand-new user's first-time payout method does not freeze their first
  -- deal. The cooldown applies only to a genuine edit, which stamps now().
  if v_pm.details_changed_at is not null
     and v_pm.details_changed_at > now() - interval '24 hours' then
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
