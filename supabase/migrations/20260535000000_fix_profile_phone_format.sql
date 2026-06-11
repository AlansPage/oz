-- =====================================================================
-- Fix: profiles.phone stored without the leading '+', breaking every
-- phone-equality join against telegram_links.
--
-- handle_new_user (20260517000000_init_marketplace.sql) copies new.phone
-- straight out of auth.users, and Supabase stores auth.users.phone
-- WITHOUT the leading '+' (e.g. '77073350741'). telegram_links.phone is
-- written by the bot webhook WITH the '+' ('+77073350741'). So for every
-- trigger-created profile, the joins in
-- find_transaction_event_notifications and find_alert_matches
-- (`tl.phone = profile.phone`) silently returned zero rows: no recipient
-- resolved, nothing dispatched, nothing logged.
--
-- Invariant going forward: all app-owned tables (profiles,
-- telegram_links, auth_codes) store E.164 WITH the '+' prefix; only
-- auth.users stores it without. See src/lib/phone.ts.
-- =====================================================================

-- 1. Normalize existing rows to E.164.
update public.profiles
   set phone = '+' || phone
 where phone is not null
   and phone not like '+%'
   -- guard: profiles.phone is unique; skip any row whose '+'-prefixed
   -- twin already exists rather than abort the whole migration.
   and not exists (
     select 1 from public.profiles p2 where p2.phone = '+' || profiles.phone
   );

-- 2. Fix the trigger so new users get E.164 from day one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (
    new.id,
    case
      when new.phone is null then null
      when new.phone like '+%' then new.phone
      else '+' || new.phone
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
