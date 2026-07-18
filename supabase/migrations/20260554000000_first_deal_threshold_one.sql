-- =====================================================================
-- Cold-start friction: first-deal graduation threshold 3 -> 1.
--
-- The 500k KZT first-deal cap applied while EITHER party had fewer than
-- 3 completed deals. In a young marketplace that means every deal is
-- capped and each user needs three deals to graduate — too much friction
-- for the cold start (product decision, 2026-07-18).
--
-- One completed deal already proves what the cap is for: the person is
-- real, their payout rail works, and a counterparty vouched by
-- completing. So the threshold drops to 1: only a party with ZERO
-- completed deals caps the deal at 500k KZT equivalent.
--
-- Deliberately unchanged:
--   * The 500k amount — it sits on the lawyer's conservative "no trades
--     >= USD 1,000" guideline (2026-07-13 consultation), so the first
--     deal keeps its regulatory-friendly ceiling.
--   * The EITHER-party rule — a fresh scammer account transacting with
--     an established victim must stay capped; requiring both parties to
--     be new would uncap exactly the main scam vector.
--   * The same-day 2 500 000 KZT aggregate cap (statutory USD 5,000
--     line, 20260553) — unaffected by graduation.
--
-- Signature (uuid, numeric, numeric) unchanged -> OR REPLACE suffices.
-- Body is 20260553 with only the threshold comparison changed.
-- =====================================================================

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
  v_fill_kzt        numeric;
  v_remaining       numeric;
  c_day_cap_kzt     constant numeric := 2500000;
  v_seoul_day       date;
  v_initiator_day   numeric;
  v_owner_day       numeric;
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

  -- KZT equivalent of THIS fill, shared by the first-deal cap and the
  -- same-day cap. Rate is defined as 1 KZT = v_rate KRW. Null = cannot
  -- be priced (KRW fill with no locked rate anywhere).
  v_rate := coalesce(v_listing.rate, p_rate);
  if v_listing.amount_currency = 'KZT' then
    v_fill_kzt := p_fill_amount;
  elsif v_rate is not null and v_rate > 0 then
    v_fill_kzt := p_fill_amount / v_rate;
  else
    v_fill_kzt := null;
  end if;

  -- First-deal cap: a party with ZERO completed deals limits the deal to
  -- the equivalent of 500 000 KZT (threshold 3 -> 1 in 20260554: one
  -- completed deal graduates a user — see header). The cap evaluates THIS
  -- FILL, not the posted total — a capped new user taking a 100k fill of a
  -- dealer's 500k listing is the most common healthy first deal, and
  -- dealers are the safest counterparties. deals_count is maintained by
  -- the completion trigger (20260543), never written by clients.
  select p.deals_count into v_initiator_deals from public.profiles p where p.id = v_uid;
  select p.deals_count into v_owner_deals     from public.profiles p where p.id = v_listing.user_id;

  if coalesce(v_initiator_deals, 0) < 1 or coalesce(v_owner_deals, 0) < 1 then
    if v_fill_kzt is null or v_fill_kzt > 500000 then
      raise exception 'first_deal_limit_exceeded';
    end if;
  end if;

  -- Same-day aggregate cap (FETR Art. 7-20 para. 1 item 6 — see header):
  -- each party's Seoul-day total across all non-cancelled transactions,
  -- plus this fill, must stay under the conservative USD 5,000 proxy.
  -- An unpriceable fill is rejected, not waved through.
  if v_fill_kzt is null then
    raise exception 'same_day_limit_exceeded';
  end if;

  v_seoul_day := (now() at time zone 'Asia/Seoul')::date;

  select coalesce(sum(case
           when t.amount_currency = 'KZT' then t.amount
           when t.rate is not null and t.rate > 0 then t.amount / t.rate
           else 0
         end), 0)
    into v_initiator_day
    from public.transactions t
   where (t.initiator_id = v_uid or t.counterparty_id = v_uid)
     and public.transaction_claims_inventory(t.status)
     and (t.created_at at time zone 'Asia/Seoul')::date = v_seoul_day;

  select coalesce(sum(case
           when t.amount_currency = 'KZT' then t.amount
           when t.rate is not null and t.rate > 0 then t.amount / t.rate
           else 0
         end), 0)
    into v_owner_day
    from public.transactions t
   where (t.initiator_id = v_listing.user_id or t.counterparty_id = v_listing.user_id)
     and public.transaction_claims_inventory(t.status)
     and (t.created_at at time zone 'Asia/Seoul')::date = v_seoul_day;

  if v_initiator_day + v_fill_kzt > c_day_cap_kzt
     or v_owner_day + v_fill_kzt > c_day_cap_kzt
  then
    raise exception 'same_day_limit_exceeded';
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
