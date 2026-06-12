-- =====================================================================
-- Phase 6.1: duplicate-rail detection — the synthetic-identity tripwire.
--
-- The signature of a farm of fake profiles is one real bank rail shared
-- across many accounts: identities are cheap, payout rails are not.
-- This view groups payment_methods by the digits-only normalization of
-- account_number and surfaces any number held by more than one user_id.
--
-- Digits-only normalization is deliberate: upsert_payment_method already
-- stores numbers stripped of separators, but legacy free-text rows may
-- carry spaces/hyphens, KZ IBANs embed letters, and phone rails carry a
-- leading '+'. Comparing digit runs catches the same rail across all of
-- those formats (a KZ IBAN collides on its 18-digit tail, a phone rail
-- on its 11 digits) at the cost of a theoretical false positive between
-- different rail types sharing a digit run — acceptable for a tripwire
-- a human reviews.
--
-- No automated enforcement: read by the admin stats route (service role)
-- and runnable nightly by hand. security_invoker so the view adds no
-- privilege path of its own; anon/authenticated are revoked outright —
-- this surface exists for the operator only.
-- =====================================================================

create view public.duplicate_payout_rails
with (security_invoker = true)
as
select
  regexp_replace(pm.account_number, '[^0-9]', '', 'g') as normalized_number,
  count(distinct pm.user_id)::integer as user_count,
  array_agg(distinct pm.bank_code) filter (where pm.bank_code is not null) as bank_codes,
  jsonb_agg(distinct jsonb_build_object(
    'user_id', pm.user_id,
    'display_name', p.display_name,
    'currency', pm.currency,
    'bank_name', pm.bank_name
  )) as holders
from public.payment_methods pm
join public.profiles p on p.id = pm.user_id
where regexp_replace(pm.account_number, '[^0-9]', '', 'g') <> ''
group by 1
having count(distinct pm.user_id) > 1;

revoke all on public.duplicate_payout_rails from public;
revoke all on public.duplicate_payout_rails from anon;
revoke all on public.duplicate_payout_rails from authenticated;
