-- =====================================================================
-- Phase 3.3: recipient_name as the verification anchor.
--
-- Both rails already verify recipient names for free on their transfer
-- screens (Kaspi shows the registered name; Korean banks show 수취인 조회).
-- The name the sender must verify against is what payment_methods has
-- been storing in holder_name all along — so the column is RENAMED, not
-- duplicated: one source of truth for the SendScreen reveal today and
-- the Phase 4 name-match checkpoint next. The form now explains that the
-- sender's bank will display this name, and the SendScreen renders it as
-- the most prominent element of the payment block.
--
-- Both RPCs touching the column are dropped and recreated (OR REPLACE
-- can't rename OUT columns or parameters); grants re-applied verbatim.
-- =====================================================================

alter table public.payment_methods
  rename column holder_name to recipient_name;

alter table public.payment_methods
  rename constraint payment_methods_holder_name_check
  to payment_methods_recipient_name_check;

-- ---------------------------------------------------------------------
-- get_counterparty_payment_method: same contract as 20260526000000,
-- with the renamed output column.
-- ---------------------------------------------------------------------

drop function public.get_counterparty_payment_method(uuid);

create function public.get_counterparty_payment_method(
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
    select pm.bank_name, pm.recipient_name, pm.account_number, pm.currency
    from public.payment_methods pm
    where pm.user_id = v_counterparty_id
      and pm.currency = v_currency_needed
      and pm.is_default = true
    limit 1;
end;
$$;

revoke execute on function public.get_counterparty_payment_method(uuid) from public, anon;
grant execute on function public.get_counterparty_payment_method(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- upsert_payment_method: same contract as 20260538000000, with the
-- renamed parameter/column and the invalid_recipient_name error code.
-- ---------------------------------------------------------------------

drop function public.upsert_payment_method(text, text, text, text, text);

create function public.upsert_payment_method(
  p_currency text,
  p_bank_code text,
  p_bank_name text,
  p_recipient_name text,
  p_account_number text
)
returns public.payment_methods
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_bank_name text;
  v_recipient text := trim(coalesce(p_recipient_name, ''));
  v_account text := upper(regexp_replace(coalesce(p_account_number, ''), '[\s-]', '', 'g'));
  v_row public.payment_methods;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if p_currency not in ('KZT', 'KRW') then
    raise exception 'invalid_currency';
  end if;

  -- The canonical bank label is derived from the code server-side; the
  -- client's label is never trusted. Free text only for «Другой банк».
  if p_bank_code is not null then
    if p_currency = 'KZT' then
      v_bank_name := case p_bank_code
        when 'kaspi'   then 'Kaspi Gold'
        when 'halyk'   then 'Halyk'
        when 'forte'   then 'Forte'
        when 'jusan'   then 'Jusan'
        when 'bcc'     then 'БЦК'
        when 'freedom' then 'Freedom'
      end;
    else
      v_bank_name := case p_bank_code
        when 'toss'      then 'Toss'
        when 'kakaobank' then 'KakaoBank'
        when 'kookmin'   then 'KB Kookmin'
        when 'shinhan'   then 'Shinhan'
        when 'woori'     then 'Woori'
        when 'hana'      then 'Hana'
        when 'nonghyup'  then 'NH Nonghyup'
        when 'ibk'       then 'IBK'
      end;
    end if;
    if v_bank_name is null then
      raise exception 'invalid_bank_code';
    end if;
  else
    v_bank_name := trim(coalesce(p_bank_name, ''));
    if length(v_bank_name) < 1 or length(v_bank_name) > 80 then
      raise exception 'invalid_bank_name';
    end if;
  end if;

  if length(v_recipient) < 1 or length(v_recipient) > 120 then
    raise exception 'invalid_recipient_name';
  end if;

  -- Structural number validation, mirrored from src/lib/payment-validation.ts.
  if p_currency = 'KZT' then
    -- Any KZT rail: a Luhn-valid 16-digit card or a mod-97-valid KZ IBAN.
    if v_account ~ '^[0-9]{16}$' then
      if not public.luhn_valid(v_account) then
        raise exception 'invalid_account_number';
      end if;
    elsif v_account like 'KZ%' then
      if not public.kz_iban_valid(v_account) then
        raise exception 'invalid_account_number';
      end if;
    else
      raise exception 'invalid_account_number';
    end if;
  else
    -- KRW: digits only, per-bank length/shape.
    if v_account !~ '^[0-9]+$' then
      raise exception 'invalid_account_number';
    end if;
    if p_bank_code = 'kakaobank' then
      if v_account !~ '^3333[0-9]{9}$' then
        raise exception 'invalid_account_number';
      end if;
    elsif p_bank_code = 'toss' then
      if length(v_account) not between 12 and 14 then
        raise exception 'invalid_account_number';
      end if;
    elsif p_bank_code is not null then
      if length(v_account) not between 10 and 14 then
        raise exception 'invalid_account_number';
      end if;
    else
      if length(v_account) not between 10 and 16 then
        raise exception 'invalid_account_number';
      end if;
    end if;
  end if;

  -- One default per (user, currency) is enforced by the partial unique
  -- index, so update-the-default-else-insert is race-safe enough here.
  update public.payment_methods
     set bank_name      = v_bank_name,
         bank_code      = p_bank_code,
         recipient_name = v_recipient,
         account_number = v_account
   where user_id = v_uid
     and currency = p_currency
     and is_default = true
  returning * into v_row;

  if not found then
    insert into public.payment_methods
      (user_id, currency, bank_name, bank_code, recipient_name, account_number, is_default)
    values
      (v_uid, p_currency, v_bank_name, p_bank_code, v_recipient, v_account, true)
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.upsert_payment_method(text, text, text, text, text) from public, anon;
grant execute on function public.upsert_payment_method(text, text, text, text, text) to authenticated;
