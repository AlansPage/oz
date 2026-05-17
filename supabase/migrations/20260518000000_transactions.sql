-- öz transactions: the row created when an initiator taps "Начать сделку".
-- One transaction per match. Status drives the receipt mechanic (next slice).

create table public.transactions (
  id                uuid primary key default gen_random_uuid(),
  listing_id        uuid not null references public.listings(id) on delete restrict,
  initiator_id     uuid not null references public.profiles(id) on delete restrict,
  counterparty_id  uuid not null references public.profiles(id) on delete restrict,
  direction         text not null
    check (direction in ('kzt_to_krw', 'krw_to_kzt')),
  amount            numeric(12,2) not null check (amount > 0),
  amount_currency   text not null
    check (amount_currency in ('KZT', 'KRW')),
  rate              numeric(10,6),
  rate_locked_at    timestamptz not null default now(),
  status            text not null default 'pending_sender_payment'
    check (status in (
      'pending_sender_payment',
      'sender_paid',
      'completed',
      'disputed',
      'cancelled'
    )),
  created_at        timestamptz not null default now(),
  completed_at      timestamptz,
  constraint transactions_parties_distinct check (initiator_id <> counterparty_id),
  constraint transactions_direction_currency_match check (
    (direction = 'kzt_to_krw' and amount_currency = 'KZT') or
    (direction = 'krw_to_kzt' and amount_currency = 'KRW')
  )
);

create index transactions_initiator_status_idx    on public.transactions (initiator_id, status);
create index transactions_counterparty_status_idx on public.transactions (counterparty_id, status);
create index transactions_listing_idx             on public.transactions (listing_id);

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.transactions enable row level security;

create policy transactions_select_own on public.transactions
  for select
  to authenticated
  using (
    (select auth.uid()) = initiator_id
    or (select auth.uid()) = counterparty_id
  );

create policy transactions_insert_as_initiator on public.transactions
  for insert
  to authenticated
  with check ((select auth.uid()) = initiator_id);

create policy transactions_update_own on public.transactions
  for update
  to authenticated
  using (
    (select auth.uid()) = initiator_id
    or (select auth.uid()) = counterparty_id
  )
  with check (
    (select auth.uid()) = initiator_id
    or (select auth.uid()) = counterparty_id
  );

-- =====================================================================
-- lock_listing_on_transaction: when a transaction is created, atomically
-- flip the listing to 'matched' so it disappears from the feed for
-- everyone. The initiator does not have UPDATE permission on listings
-- they don't own, so this runs as security definer with a locked
-- search_path. Conditional on status='active' to avoid clobbering an
-- already-matched/withdrawn listing in a race.
-- =====================================================================

create or replace function public.lock_listing_on_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.listings
     set status = 'matched'
   where id = new.listing_id
     and status = 'active';
  return new;
end;
$$;

create trigger transactions_lock_listing
  after insert on public.transactions
  for each row
  execute function public.lock_listing_on_transaction();

-- Same hardening as handle_new_user: trigger fires regardless of EXECUTE
-- grants, but revoking blocks /rest/v1/rpc invocation by clients.
revoke execute on function public.lock_listing_on_transaction() from public;
revoke execute on function public.lock_listing_on_transaction() from anon;
revoke execute on function public.lock_listing_on_transaction() from authenticated;

-- =====================================================================
-- Realtime publication: Supabase Cloud pre-creates supabase_realtime,
-- but a fresh local `db reset` may not have it yet. Create on demand,
-- then add this table.
-- =====================================================================

do $$
begin
  if not exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) then
    create publication supabase_realtime;
  end if;
end$$;

alter publication supabase_realtime add table public.transactions;
