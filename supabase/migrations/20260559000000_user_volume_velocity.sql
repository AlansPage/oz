-- =====================================================================
-- Admin rolling-velocity view: business-like volume, seen before a
-- regulator has to ask about it.
--
-- The reporting exemption öz relies on (Korean FETR Art. 7-20 para. 1
-- item 6, cited in the July 2026 consultation filings) holds only for
-- NON-PROFIT-SEEKING resident-to-resident exchange. The per-deal and
-- same-day caps bound each day, but a user running at the cap every day
-- with many counterparties looks like a business, not personal need —
-- and that pattern is only visible over a rolling window. This view
-- gives the operator that window: per user, KZT-equivalent volume over
-- the trailing 7 and 30 days, deal counts, and distinct counterparties,
-- across all inventory-claiming (non-cancelled) transactions, so
-- intervention can precede any regulator question.
--
-- Conventions reused, not reinvented:
--   * transaction_claims_inventory (20260550) decides which statuses
--     count — the same authority create_transaction uses for fills.
--   * KZT equivalence follows the v_fill_kzt convention: KZT amounts
--     as-is, otherwise amount / rate (1 KZT = rate KRW); a rate-less
--     KRW row counts as 0 rather than being invented.
--
-- Access control follows 20260546 (duplicate_payout_rails): read by the
-- admin stats route (service role) only. security_invoker so the view
-- adds no privilege path of its own; anon/authenticated are revoked
-- outright — this surface exists for the operator only.
-- =====================================================================

create view public.user_volume_velocity
with (security_invoker = true)
as
with party_tx as (
  select
    p.user_id,
    p.counterparty_id,
    t.created_at,
    case
      when t.amount_currency = 'KZT' then t.amount
      when t.rate is not null and t.rate > 0 then t.amount / t.rate
      else 0
    end as amount_kzt
  from public.transactions t
  -- Every transaction moves volume for BOTH parties, so each row fans
  -- out into two (user, counterparty) rows before aggregation — the
  -- same both-sides accounting the same-day cap applies.
  cross join lateral (values
    (t.initiator_id, t.counterparty_id),
    (t.counterparty_id, t.initiator_id)
  ) as p(user_id, counterparty_id)
  where public.transaction_claims_inventory(t.status)
    and t.created_at >= now() - interval '30 days'
)
select
  pt.user_id,
  pr.display_name,
  coalesce(sum(pt.amount_kzt) filter
    (where pt.created_at >= now() - interval '7 days'), 0) as volume_kzt_7d,
  coalesce(sum(pt.amount_kzt), 0)                          as volume_kzt_30d,
  (count(*) filter
    (where pt.created_at >= now() - interval '7 days'))::integer as deals_7d,
  count(*)::integer                                             as deals_30d,
  (count(distinct pt.counterparty_id) filter
    (where pt.created_at >= now() - interval '7 days'))::integer as counterparties_7d,
  count(distinct pt.counterparty_id)::integer                    as counterparties_30d
from party_tx pt
join public.profiles pr on pr.id = pt.user_id
group by pt.user_id, pr.display_name;

revoke all on public.user_volume_velocity from public;
revoke all on public.user_volume_velocity from anon;
revoke all on public.user_volume_velocity from authenticated;
