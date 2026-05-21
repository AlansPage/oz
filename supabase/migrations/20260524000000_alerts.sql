-- =====================================================================
-- Slice 10: Telegram match notifications.
--
-- Users subscribe to alerts on a (direction, optional amount range,
-- optional rate threshold). When a matching listing is INSERTed,
-- a database webhook fires the notify-matchers edge function, which
-- calls find_alert_matches (SECURITY DEFINER) to compute the targets,
-- applying cooldown, per-user 10/day cap, and own-active-listing
-- silencing. The edge function then dispatches via Telegram and
-- records the outcome in notification_log.
-- =====================================================================

-- =====================================================================
-- 1. Tables
-- =====================================================================

create table public.alert_subscriptions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  direction           text not null check (direction in ('kzt_to_krw', 'krw_to_kzt')),
  amount_min          numeric(12,2),
  amount_max          numeric(12,2),
  rate_better_than    numeric(10,6),
  cooldown_minutes    integer not null default 30 check (cooldown_minutes between 5 and 1440),
  active              boolean not null default true,
  last_notified_at    timestamptz,
  created_at          timestamptz not null default now(),
  check (amount_min is null or amount_max is null or amount_min <= amount_max)
);

create index alert_subscriptions_user_idx
  on public.alert_subscriptions (user_id, active) where active = true;
create index alert_subscriptions_match_idx
  on public.alert_subscriptions (direction, active) where active = true;

create table public.notification_log (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  alert_id        uuid references public.alert_subscriptions(id) on delete set null,
  listing_id      uuid references public.listings(id) on delete set null,
  channel         text not null check (channel in ('telegram', 'sms', 'push')),
  status          text not null check (status in ('queued', 'sent', 'failed', 'capped', 'silenced')),
  external_id     text,
  error_detail    text,
  created_at      timestamptz not null default now()
);

create index notification_log_user_recent_idx
  on public.notification_log (user_id, created_at desc);
create index notification_log_user_sent_recent_idx
  on public.notification_log (user_id, created_at desc)
  where status = 'sent';

-- =====================================================================
-- 2. RLS
-- =====================================================================

alter table public.alert_subscriptions enable row level security;
alter table public.notification_log    enable row level security;

drop policy if exists alerts_select_own on public.alert_subscriptions;
create policy alerts_select_own on public.alert_subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists alerts_insert_own on public.alert_subscriptions;
create policy alerts_insert_own on public.alert_subscriptions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists alerts_update_own on public.alert_subscriptions;
create policy alerts_update_own on public.alert_subscriptions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists alerts_delete_own on public.alert_subscriptions;
create policy alerts_delete_own on public.alert_subscriptions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- notification_log: owner-read only; service role writes from the edge
-- function (bypasses RLS). No INSERT/UPDATE/DELETE policies.
drop policy if exists notif_log_select_own on public.notification_log;
create policy notif_log_select_own on public.notification_log
  for select to authenticated
  using (user_id = (select auth.uid()));

-- =====================================================================
-- 3. find_alert_matches RPC (SECURITY DEFINER, service-role-only call)
-- =====================================================================

create or replace function public.find_alert_matches(
  p_listing_id uuid
)
returns table(
  alert_id          uuid,
  user_id           uuid,
  telegram_user_id  bigint,
  message_text      text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing      public.listings;
  v_alert        record;
  v_today_count  integer;
  v_own_listing  boolean;
  v_msg          text;
  v_amount_text  text;
  v_rate_text    text;
  v_dir_symbol   text;
begin
  select * into v_listing from public.listings where id = p_listing_id;
  if not found then return; end if;
  if v_listing.status <> 'active' then return; end if;

  v_dir_symbol := case v_listing.direction
    when 'kzt_to_krw' then '₸ → ₩'
    else '₩ → ₸'
  end;
  v_amount_text := to_char(v_listing.amount, 'FM999G999G999D99')
                   || ' '
                   || case v_listing.amount_currency when 'KZT' then '₸' else '₩' end;
  v_rate_text := case
    when v_listing.rate is null then 'по рынку'
    else 'курс ' || replace(to_char(v_listing.rate, 'FM999D9999'), '.', ',')
  end;

  for v_alert in
    select a.*, tl.telegram_user_id as tg_id
      from public.alert_subscriptions a
      join public.profiles p on p.id = a.user_id
      left join public.telegram_links tl on tl.phone = p.phone
     where a.active = true
       and a.direction = v_listing.direction
       and a.user_id <> v_listing.user_id
       and (a.amount_min is null or v_listing.amount >= a.amount_min)
       and (a.amount_max is null or v_listing.amount <= a.amount_max)
       and (
         a.rate_better_than is null
         or v_listing.rate is null
         or (a.direction = 'kzt_to_krw' and v_listing.rate >= a.rate_better_than)
         or (a.direction = 'krw_to_kzt' and v_listing.rate <= a.rate_better_than)
       )
       and (
         a.last_notified_at is null
         or a.last_notified_at < now() - (a.cooldown_minutes || ' minutes')::interval
       )
  loop
    -- Daily cap: 10 'sent' notifications per rolling 24h.
    select count(*) into v_today_count
      from public.notification_log
     where user_id = v_alert.user_id
       and status = 'sent'
       and created_at > now() - interval '1 day';
    if v_today_count >= 10 then
      insert into public.notification_log
        (user_id, alert_id, listing_id, channel, status)
      values
        (v_alert.user_id, v_alert.id, p_listing_id, 'telegram', 'capped');
      continue;
    end if;

    -- Silence: user already has an active listing in the same direction.
    select exists(
      select 1 from public.listings
       where user_id = v_alert.user_id
         and status = 'active'
         and direction = v_listing.direction
         and expires_at > now()
    ) into v_own_listing;

    if v_own_listing then
      insert into public.notification_log
        (user_id, alert_id, listing_id, channel, status)
      values
        (v_alert.user_id, v_alert.id, p_listing_id, 'telegram', 'silenced');
      continue;
    end if;

    -- Skip if no Telegram link (phase 2: SMS fallback).
    if v_alert.tg_id is null then
      continue;
    end if;

    v_msg := 'öz: новое объявление' || E'\n\n'
          || v_dir_symbol || ' ' || v_amount_text || E'\n'
          || v_rate_text || E'\n\n'
          || 'Открыть: https://oz.exchange/listing/' || v_listing.id::text || E'\n'
          || 'Отключить это оповещение: https://t.me/ozauth_bot?start=mute_'
          || v_alert.id::text;

    update public.alert_subscriptions
       set last_notified_at = now()
     where id = v_alert.id;

    return query select
      v_alert.id,
      v_alert.user_id,
      v_alert.tg_id,
      v_msg;
  end loop;
end;
$$;

revoke execute on function public.find_alert_matches(uuid) from public;
revoke execute on function public.find_alert_matches(uuid) from anon;
revoke execute on function public.find_alert_matches(uuid) from authenticated;
-- Only service_role (the edge function) may call this.
