-- Telegram-based OTP auth: replaces Supabase SMS OTP.
-- A bot we control delivers verification codes to the user's Telegram.
-- Server-side verify exchanges a matched code for a real Supabase session
-- via signInWithPassword using a deterministic per-phone password.

-- =====================================================================
-- telegram_links: permanent phone <-> telegram_user_id binding
-- Established the first time a user successfully /verify's via the bot.
-- =====================================================================

create table public.telegram_links (
  phone               text primary key,
  telegram_user_id    bigint not null unique,
  telegram_username   text,
  linked_at           timestamptz not null default now()
);

-- =====================================================================
-- auth_codes: transient verification codes. TTL 5 min, max 5 attempts,
-- single-use. Rows are kept briefly after use so cleanup can run lazily.
-- =====================================================================

create table public.auth_codes (
  id                  uuid primary key default gen_random_uuid(),
  phone               text not null,
  code                text not null,
  telegram_user_id    bigint,
  delivered           boolean not null default false,
  used                boolean not null default false,
  attempts            smallint not null default 0,
  created_at          timestamptz not null default now(),
  expires_at          timestamptz not null default (now() + interval '5 minutes')
);

create index auth_codes_phone_live_idx
  on public.auth_codes (phone, created_at desc)
  where used = false;

create index auth_codes_pending_delivery_idx
  on public.auth_codes (phone)
  where used = false and delivered = false;

-- =====================================================================
-- RLS: enabled with no policies. Only the service role reaches these
-- tables; anon and authenticated clients get an implicit deny.
-- =====================================================================

alter table public.telegram_links enable row level security;
alter table public.auth_codes enable row level security;

-- =====================================================================
-- cleanup_expired_auth_codes: hygiene helper. Correctness already comes
-- from expires_at / used checks at the application layer; this just
-- keeps the table small. Wire to cron later.
-- =====================================================================

create or replace function public.cleanup_expired_auth_codes()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.auth_codes
   where (expires_at < now() and used = false)
      or (used = true and created_at < now() - interval '1 day');
$$;

revoke execute on function public.cleanup_expired_auth_codes() from public;
revoke execute on function public.cleanup_expired_auth_codes() from anon;
revoke execute on function public.cleanup_expired_auth_codes() from authenticated;
