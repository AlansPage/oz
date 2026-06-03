-- =====================================================================
-- PII hardening, step 1 of 2 (additive / non-breaking).
--
-- profiles.phone (full E.164) is currently readable by any authenticated
-- user via the broad `profiles_select_authenticated USING(true)` policy +
-- table-level SELECT grant, so phone numbers can be enumerated through the
-- Data API. The app only ever needs:
--   - the signed-in user's OWN phone (available from the auth session), and
--   - a MASKED phone of OTHER users as a fallback display identity.
--
-- This step adds a STORED generated column `phone_masked` that mirrors the
-- client-side formatPhoneMasked() output ("+7 707 *** ** 41"). Being a real
-- column, it can be granted at column level independently of `phone`, and
-- reading it does not require SELECT on `phone`.
--
-- This migration is purely additive: existing `select *` / `profiles(*)`
-- reads keep working. Step 2 (20260532000000) revokes raw `phone` access,
-- and must be applied only AFTER the app code that selects phone_masked is
-- deployed.
-- =====================================================================

alter table public.profiles
  add column if not exists phone_masked text
  generated always as (
    case
      when phone is null then null
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) < 6
        then '+' || regexp_replace(phone, '[^0-9]', '', 'g')
      else '+' || left(regexp_replace(phone, '[^0-9]', '', 'g'), 1)
           || ' ' || substr(regexp_replace(phone, '[^0-9]', '', 'g'), 2, 3)
           || ' *** ** ' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 2)
    end
  ) stored;

-- Explicit (harmless while the table-level SELECT grant still covers it;
-- becomes the operative grant after step 2 revokes the table-level grant).
grant select (phone_masked) on public.profiles to authenticated, anon;
