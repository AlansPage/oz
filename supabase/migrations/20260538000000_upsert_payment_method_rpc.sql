-- =====================================================================
-- Phase 3.2: server-enforced structural validation of payout details.
--
-- The client now validates account/card numbers per rail (Luhn for KZT
-- cards, ISO 7064 mod-97 for KZ IBANs, per-bank length/shape for KRW),
-- but client checks can be bypassed with a direct PostgREST call. This
-- migration mirrors them in a SECURITY DEFINER upsert_payment_method RPC
-- and closes the direct INSERT/UPDATE path on payment_methods, following
-- the create_transaction pattern (20260534000000): the table can no
-- longer be written in a shape the validator never saw.
--
-- The RPC also normalizes account numbers before storing (separators
-- stripped, IBAN uppercased), so equality across rows is meaningful —
-- Phase 6 duplicate-rail detection depends on this.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Pure checksum helpers. SECURITY INVOKER, no table access; standalone so
-- they are testable in isolation and reusable by later checks/views.
-- ---------------------------------------------------------------------

create or replace function public.luhn_valid(p_digits text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_sum int := 0;
  v_double boolean := false;
  v_d int;
  i int;
begin
  if p_digits is null or p_digits !~ '^[0-9]+$' then
    return false;
  end if;
  for i in reverse length(p_digits)..1 loop
    v_d := substr(p_digits, i, 1)::int;
    if v_double then
      v_d := v_d * 2;
      if v_d > 9 then
        v_d := v_d - 9;
      end if;
    end if;
    v_sum := v_sum + v_d;
    v_double := not v_double;
  end loop;
  return v_sum % 10 = 0;
end;
$$;

create or replace function public.kz_iban_valid(p_iban text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_rearranged text;
  v_expanded text := '';
  v_ch text;
  i int;
begin
  -- KZ IBAN: 'KZ' + 2 check digits + 16 alphanumeric BBAN = 20 chars.
  if p_iban is null or p_iban !~ '^KZ[0-9]{2}[0-9A-Z]{16}$' then
    return false;
  end if;
  -- ISO 7064 mod-97: move the first 4 chars to the end, expand letters
  -- (A=10 … Z=35), and the resulting integer must be ≡ 1 (mod 97).
  v_rearranged := substr(p_iban, 5) || substr(p_iban, 1, 4);
  for i in 1..length(v_rearranged) loop
    v_ch := substr(v_rearranged, i, 1);
    if v_ch ~ '[0-9]' then
      v_expanded := v_expanded || v_ch;
    else
      v_expanded := v_expanded || (ascii(v_ch) - 55)::text;
    end if;
  end loop;
  return v_expanded::numeric % 97 = 1;
end;
$$;

revoke execute on function public.luhn_valid(text) from public, anon;
grant execute on function public.luhn_valid(text) to authenticated;
revoke execute on function public.kz_iban_valid(text) from public, anon;
grant execute on function public.kz_iban_valid(text) to authenticated;

-- ---------------------------------------------------------------------
-- upsert_payment_method: the only write path for payout details.
-- Exception codes are surfaced verbatim to the client (same contract as
-- create_transaction): invalid_currency, invalid_bank_code,
-- invalid_bank_name, invalid_holder_name, invalid_account_number.
-- ---------------------------------------------------------------------

create or replace function public.upsert_payment_method(
  p_currency text,
  p_bank_code text,
  p_bank_name text,
  p_holder_name text,
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
  v_holder text := trim(coalesce(p_holder_name, ''));
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

  if length(v_holder) < 1 or length(v_holder) > 120 then
    raise exception 'invalid_holder_name';
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
         holder_name    = v_holder,
         account_number = v_account
   where user_id = v_uid
     and currency = p_currency
     and is_default = true
  returning * into v_row;

  if not found then
    insert into public.payment_methods
      (user_id, currency, bank_name, bank_code, holder_name, account_number, is_default)
    values
      (v_uid, p_currency, v_bank_name, p_bank_code, v_holder, v_account, true)
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.upsert_payment_method(text, text, text, text, text) from public, anon;
grant execute on function public.upsert_payment_method(text, text, text, text, text) to authenticated;

-- Close the unvalidated direct write path now that the RPC exists.
-- SELECT/DELETE own rows stay policy-governed as before.
drop policy if exists payment_methods_insert_own on public.payment_methods;
drop policy if exists payment_methods_update_own on public.payment_methods;
revoke insert, update on public.payment_methods from authenticated, anon;
