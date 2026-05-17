-- öz marketplace: profiles + listings, with RLS, triggers, indexes.

create extension if not exists pgcrypto;

-- =====================================================================
-- profiles
-- =====================================================================

create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  phone              text unique,
  display_name       text,
  avatar_url         text,
  verification_tier  text not null default 'phone'
    check (verification_tier in ('phone', 'phone_id', 'verified_trader')),
  rating_avg         numeric(3,2),
  rating_count       integer not null default 0,
  created_at         timestamptz not null default now(),
  last_active_at     timestamptz not null default now()
);

create index profiles_phone_idx on public.profiles (phone);

-- =====================================================================
-- handle_new_user: auto-create a profile row when an auth user is created
-- security definer + locked search_path so the trigger can write into public
-- without leaking elevated privileges through search_path injection.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (new.id, new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- =====================================================================
-- listings
-- =====================================================================

create table public.listings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles(id) on delete cascade,
  direction         text not null
    check (direction in ('kzt_to_krw', 'krw_to_kzt')),
  amount            numeric(12,2) not null check (amount > 0),
  amount_currency   text not null
    check (amount_currency in ('KZT', 'KRW')),
  rate              numeric(10,6),
  min_match_amount  numeric(12,2),
  status            text not null default 'active'
    check (status in ('active', 'matched', 'completed', 'expired', 'withdrawn')),
  note              text check (note is null or char_length(note) <= 280),
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default (now() + interval '24 hours'),
  boosted_until     timestamptz,
  constraint listings_direction_currency_match check (
    (direction = 'kzt_to_krw' and amount_currency = 'KZT') or
    (direction = 'krw_to_kzt' and amount_currency = 'KRW')
  )
);

create index listings_status_created_at_idx on public.listings (status, created_at desc);
create index listings_direction_status_idx  on public.listings (direction, status);
create index listings_user_id_idx           on public.listings (user_id);

-- =====================================================================
-- listings: block UPDATEs to immutable columns
-- RLS cannot restrict which columns an UPDATE touches, so this trigger
-- enforces it at the row level.
-- =====================================================================

create or replace function public.listings_prevent_immutable_updates()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'listings.user_id is immutable';
  end if;
  if new.created_at is distinct from old.created_at then
    raise exception 'listings.created_at is immutable';
  end if;
  return new;
end;
$$;

create trigger listings_prevent_immutable_updates
  before update on public.listings
  for each row
  execute function public.listings_prevent_immutable_updates();

-- =====================================================================
-- RLS
-- =====================================================================

alter table public.profiles enable row level security;
alter table public.listings enable row level security;

-- profiles: anyone authenticated can read; only the owner can update.
-- No INSERT policy: handle_new_user trigger runs as security definer.
-- No DELETE policy: cascade from auth.users.

create policy profiles_select_authenticated on public.profiles
  for select
  to authenticated
  using (true);

create policy profiles_update_own on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- listings: anyone authenticated sees active+unexpired or their own;
-- only the owner can insert (for themselves) or update.
-- No DELETE policy: use status = 'withdrawn' instead.

create policy listings_select_active_or_own on public.listings
  for select
  to authenticated
  using (
    (status = 'active' and expires_at > now())
    or user_id = auth.uid()
  );

create policy listings_insert_own on public.listings
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy listings_update_own on public.listings
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
