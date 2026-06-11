-- =====================================================================
-- Phase 3.1: structured bank identity on payment_methods.
--
-- bank_name was free text, so the highest-stakes input in the product
-- (where the counterparty sends real money) had no structure to validate
-- against. bank_code is the stable identifier behind the new bank picker:
-- the client stores a code from a fixed currency-scoped list, and later
-- migrations key per-rail account-number validation off it. NULL means
-- «Другой банк» — the user typed a free-text bank name, so nobody is
-- blocked by an incomplete list.
--
-- The canonical display label still lives in bank_name (derived from the
-- code server-side once upsert_payment_method lands in 3.2), so every
-- existing render site keeps working unchanged.
-- =====================================================================

alter table public.payment_methods
  add column bank_code text
  check (bank_code is null or bank_code in (
    -- KZT
    'kaspi', 'halyk', 'forte', 'jusan', 'bcc', 'freedom',
    -- KRW
    'toss', 'kakaobank', 'kookmin', 'shinhan', 'woori', 'hana',
    'nonghyup', 'ibk'
  ));

-- Backfill: fuzzy-match the old free-text bank names, scoped by currency
-- so a stray latin substring can't cross rails. Unmatched rows stay NULL
-- (treated as «Другой банк»; the free text remains in bank_name).
update public.payment_methods set bank_code =
  case
    when currency = 'KZT' then
      case
        when bank_name ilike '%kaspi%'   or bank_name ilike '%каспи%'   then 'kaspi'
        when bank_name ilike '%halyk%'   or bank_name ilike '%халык%'
          or bank_name ilike '%народн%'                                 then 'halyk'
        when bank_name ilike '%forte%'   or bank_name ilike '%форте%'   then 'forte'
        when bank_name ilike '%jusan%'   or bank_name ilike '%jysan%'
          or bank_name ilike '%жусан%'   or bank_name ilike '%джусан%'  then 'jusan'
        when bank_name ilike '%bcc%'     or bank_name ilike '%бцк%'
          or bank_name ilike '%centercredit%'
          or bank_name ilike '%центркредит%'                            then 'bcc'
        when bank_name ilike '%freedom%' or bank_name ilike '%фридом%'  then 'freedom'
        else null
      end
    when currency = 'KRW' then
      case
        when bank_name ilike '%kakao%'    or bank_name ilike '%какао%'
          or bank_name ilike '%카카오%'                                  then 'kakaobank'
        when bank_name ilike '%toss%'     or bank_name ilike '%тосс%'
          or bank_name ilike '%토스%'                                    then 'toss'
        when bank_name ilike '%kookmin%'  or bank_name ilike '%kb%'
          or bank_name ilike '%국민%'                                    then 'kookmin'
        when bank_name ilike '%shinhan%'  or bank_name ilike '%шинхан%'
          or bank_name ilike '%신한%'                                    then 'shinhan'
        when bank_name ilike '%woori%'    or bank_name ilike '%우리%'    then 'woori'
        when bank_name ilike '%hana%'     or bank_name ilike '%хана%'
          or bank_name ilike '%하나%'                                    then 'hana'
        when bank_name ilike '%nonghyup%' or bank_name ilike '%nh%'
          or bank_name ilike '%농협%'                                    then 'nonghyup'
        when bank_name ilike '%ibk%'      or bank_name ilike '%기업%'    then 'ibk'
        else null
      end
    else null
  end
where bank_code is null;
