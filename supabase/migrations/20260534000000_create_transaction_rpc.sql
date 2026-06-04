-- =====================================================================
-- Server-side, forgery-proof transaction creation.
--
-- Before this, transactions were created by a direct client INSERT governed
-- only by `transactions_insert_as_initiator` (CHECK initiator_id = auth.uid()).
-- Nothing forced counterparty_id to be the listing owner, the amount to match
-- the listing, or the listing to be active — so a crafted request could forge
-- a transaction (arbitrary counterparty, arbitrary amount, against any/inactive
-- listing), enabling griefing (locking listings, roping in victims) and bogus
-- records.
--
-- create_transaction derives every money-movement field from the listing row
-- (locked FOR UPDATE), so the client cannot forge them. It also requires the
-- counterparty to have a default payout method in the currency the initiator
-- will send, which closes the silent-null SendScreen gap. Direct INSERT is then
-- revoked. Mirrors the SECURITY DEFINER pattern of advance_transaction etc.
-- =====================================================================

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
  if not exists (
    select 1 from public.payment_methods pm
     where pm.user_id = v_listing.user_id
       and pm.currency = v_currency
       and pm.is_default = true
  ) then
    raise exception 'counterparty_no_payment_method';
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

-- Close the forgeable direct-INSERT path now that creation is server-validated.
drop policy if exists transactions_insert_as_initiator on public.transactions;
revoke insert on public.transactions from authenticated, anon;
