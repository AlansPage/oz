-- =====================================================================
-- Slice 12: payment methods.
--
-- Users configure payment methods (bank / holder / account number) per
-- currency. Counterparties never read these directly via RLS; the only
-- cross-user reveal goes through get_counterparty_payment_method(), a
-- SECURITY DEFINER RPC that checks the caller is a party to an active
-- transaction and audit-logs every reveal into security_events.
-- =====================================================================

create table public.payment_methods (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  currency        text not null check (currency in ('KZT', 'KRW')),
  bank_name       text not null check (length(trim(bank_name)) between 1 and 80),
  holder_name     text not null check (length(trim(holder_name)) between 1 and 120),
  account_number  text not null check (length(trim(account_number)) between 4 and 40),
  is_default      boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index payment_methods_user_currency_idx
  on public.payment_methods (user_id, currency)
  where is_default = true;

create index payment_methods_user_idx
  on public.payment_methods (user_id);

-- Enforce one default per (user, currency) via a partial unique index
create unique index payment_methods_one_default_per_currency
  on public.payment_methods (user_id, currency)
  where is_default = true;

-- updated_at trigger
create or replace function public.set_payment_methods_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger payment_methods_updated_at
  before update on public.payment_methods
  for each row execute function public.set_payment_methods_updated_at();

-- =====================================================================
-- RLS: users read/write their own. Counterparties never read another
-- party's rows directly; the get_counterparty_payment_method RPC below
-- is the only cross-user surface.
-- =====================================================================

alter table public.payment_methods enable row level security;

create policy payment_methods_select_own on public.payment_methods
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy payment_methods_insert_own on public.payment_methods
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy payment_methods_update_own on public.payment_methods
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy payment_methods_delete_own on public.payment_methods
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- =====================================================================
-- security_events: register the new event type before the RPC writes it.
-- The check constraint is the inline auto-named one from slice 11.
-- =====================================================================

alter table public.security_events
  drop constraint security_events_event_type_check;

alter table public.security_events
  add constraint security_events_event_type_check
  check (event_type in (
    'auth_failed',
    'auth_account_needs_migration',
    'auth_rate_limited',
    'webhook_auth_failed',
    'rpc_unauthorized',
    'chat_flagged',
    'rate_limited',
    'suspicious_pattern',
    'payment_method_revealed'
  ));

-- =====================================================================
-- get_counterparty_payment_method RPC
-- Returns the counterparty's default payment method for a given
-- transaction, but only if the caller is a party to that transaction
-- and the transaction is in a state where they need it. Every reveal is
-- logged to security_events.
-- =====================================================================

create or replace function public.get_counterparty_payment_method(
  p_transaction_id uuid
)
returns table(
  bank_name      text,
  holder_name    text,
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

  return query
    select pm.bank_name, pm.holder_name, pm.account_number, pm.currency
    from public.payment_methods pm
    where pm.user_id = v_counterparty_id
      and pm.currency = v_currency_needed
      and pm.is_default = true
    limit 1;
end;
$$;

revoke execute on function public.get_counterparty_payment_method(uuid) from public;
revoke execute on function public.get_counterparty_payment_method(uuid) from anon;
grant execute on function public.get_counterparty_payment_method(uuid) to authenticated;
