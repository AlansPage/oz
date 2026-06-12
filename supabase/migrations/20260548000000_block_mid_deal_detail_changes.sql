-- =====================================================================
-- Phase 5 hardening: block mid-deal payout-detail changes at the reveal.
--
-- get_counterparty_payment_method (20260539) reads the LIVE default
-- payment method at reveal time and nothing snapshots details at deal
-- creation, so details edited mid-flow went straight into the sender's
-- SendScreen. The 24h details_changed_at freeze (20260544) only gates
-- create_transaction — an in-flight deal was unprotected, which is
-- exactly the swap window a hijacked account would use.
--
-- Redefines the function identical to 20260539 except the method row is
-- fetched into a variable and one guard runs before details are
-- returned: if details_changed_at postdates the transaction, raise
-- 'payment_details_changed_mid_deal' instead of revealing. No
-- security_events row here — an insert before a raise rolls back with
-- it, so it could never persist; the durable record of the change
-- itself is the 20260545 payment-change alert. The sender's client
-- renders the error as a freeze state; cancel remains available.
-- =====================================================================

create or replace function public.get_counterparty_payment_method(
  p_transaction_id uuid
)
returns table(
  bank_name      text,
  recipient_name text,
  account_number text,
  currency       text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tx public.transactions;
  v_counterparty_id uuid;
  v_currency_needed text;
  v_pm public.payment_methods;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  select * into v_tx from public.transactions where id = p_transaction_id;
  if not found then
    raise exception 'transaction_not_found';
  end if;

  -- Caller must be a party
  if v_uid not in (v_tx.initiator_id, v_tx.counterparty_id) then
    raise exception 'not_a_party';
  end if;

  -- Only expose during states where the bank details are operationally
  -- relevant. After completion/cancellation/dispute, no more reveals.
  if v_tx.status not in ('pending_sender_payment', 'sender_paid', 'counterparty_confirmed', 'counterparty_paid') then
    raise exception 'transaction_state_not_eligible';
  end if;

  -- Determine which counterparty and which currency.
  -- For the SendScreen (initiator sending to counterparty), we want the
  -- counterparty's payment method in tx.amount_currency. The counterparty
  -- viewing the other leg needs the opposite currency.
  if v_uid = v_tx.initiator_id then
    v_counterparty_id := v_tx.counterparty_id;
    v_currency_needed := v_tx.amount_currency;
  else
    v_counterparty_id := v_tx.initiator_id;
    v_currency_needed := case v_tx.amount_currency
      when 'KZT' then 'KRW'
      else 'KZT'
    end;
  end if;

  -- Audit the reveal before returning the details.
  insert into public.security_events (event_type, user_id, detail)
  values (
    'payment_method_revealed',
    v_uid,
    jsonb_build_object(
      'transaction_id', p_transaction_id,
      'counterparty_id', v_counterparty_id,
      'currency', v_currency_needed
    )
  );

  select * into v_pm
    from public.payment_methods pm
    where pm.user_id = v_counterparty_id
      and pm.currency = v_currency_needed
      and pm.is_default = true
    limit 1;

  -- The mid-deal swap guard: details edited after the deal started never
  -- reach the sender. The change-time alert (20260545) already notified
  -- the owner; the sender sees a freeze state and can cancel.
  if found and v_pm.details_changed_at > v_tx.created_at then
    raise exception 'payment_details_changed_mid_deal';
  end if;

  if found then
    return query
      select v_pm.bank_name, v_pm.recipient_name, v_pm.account_number, v_pm.currency;
  end if;
end;
$$;

revoke execute on function public.get_counterparty_payment_method(uuid) from public, anon;
grant execute on function public.get_counterparty_payment_method(uuid) to authenticated;
