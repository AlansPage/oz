-- =====================================================================
-- Listing size ceiling: a listing may not advertise more volume than
-- one party could legally transact in a day.
--
-- The July 2026 regulatory filings (and 20260553) cap each party's
-- same-day aggregate at the equivalent of 2 500 000 KZT — the
-- conservative proxy for the USD 5,000 line of Korean FETR Art. 7-20
-- para. 1 item 6. A listing advertising more than that invites deals
-- the poster cannot lawfully complete in a day, so the ceiling is
-- enforced at posting time too.
--
-- Enforcement point: listings are inserted directly by the client under
-- RLS (no RPC in the path), so a BEFORE INSERT trigger is the narrowest
-- change — no restructuring of the insert path. The KZT equivalence
-- follows the v_fill_kzt convention in create_transaction: KZT amounts
-- count as-is; KRW amounts divide by the listing's rate (rate is
-- defined as 1 KZT = rate KRW).
--
-- Considered decision — rate-null KRW listings are ALLOWED through: a
-- KRW listing with no rate means "по рынку" and cannot be priced
-- against a KZT ceiling at posting time. Blocking it would kill every
-- market-rate KRW listing over an unknowable conversion; letting it
-- through is safe because the same-day aggregate cap in
-- create_transaction bounds every actual fill (an unpriceable fill is
-- rejected there, not waved through).
--
-- Deliberately unchanged: the 2 500 000 constant mirrors c_day_cap_kzt
-- in create_transaction and the client-side constant; if the statutory
-- proxy ever moves, all three move together.
-- =====================================================================

create or replace function public.listings_enforce_size_ceiling()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  c_day_cap_kzt constant numeric := 2500000;
  v_amount_kzt  numeric;
begin
  if new.amount_currency = 'KZT' then
    v_amount_kzt := new.amount;
  elsif new.rate is not null and new.rate > 0 then
    v_amount_kzt := new.amount / new.rate;
  else
    -- Market-rate KRW listing: unpriceable here, bounded per-fill by the
    -- same-day cap in create_transaction (see header).
    v_amount_kzt := null;
  end if;

  if v_amount_kzt is not null and v_amount_kzt > c_day_cap_kzt then
    raise exception 'listing_over_limit';
  end if;

  return new;
end;
$$;

revoke execute on function public.listings_enforce_size_ceiling() from public, anon, authenticated;

create trigger listings_enforce_size_ceiling
  before insert on public.listings
  for each row
  execute function public.listings_enforce_size_ceiling();
