-- =====================================================================
-- Slice 11: security audit log.
--
-- Fire-and-forget event log written by the Next.js server (service role)
-- and by an after-insert trigger on chat_messages. RLS denies all reads
-- and writes from the anon / authenticated roles; only service_role
-- bypasses RLS to read and write. No user-facing surface.
-- =====================================================================

create table public.security_events (
  id           uuid primary key default gen_random_uuid(),
  event_type   text not null check (event_type in (
    'auth_failed',
    'auth_account_needs_migration',
    'auth_rate_limited',
    'webhook_auth_failed',
    'rpc_unauthorized',
    'chat_flagged',
    'rate_limited',
    'suspicious_pattern'
  )),
  user_id      uuid references public.profiles(id) on delete set null,
  phone        text,
  ip           text,
  detail       jsonb,
  created_at   timestamptz not null default now()
);

create index security_events_recent_idx
  on public.security_events (created_at desc);
create index security_events_type_recent_idx
  on public.security_events (event_type, created_at desc);
create index security_events_user_idx
  on public.security_events (user_id, created_at desc)
  where user_id is not null;

alter table public.security_events enable row level security;
-- Intentionally no policies — service role only.

-- =====================================================================
-- chat_message_flagged_trigger
-- Mirrors flagged chat messages into security_events without modifying
-- the slice-8 send_chat_message RPC. Also captures any other code path
-- that inserts a flagged row (e.g. service-role tooling).
-- =====================================================================

create or replace function public.log_chat_flagged()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.flagged then
    insert into public.security_events (event_type, user_id, detail)
    values (
      'chat_flagged',
      new.sender_id,
      jsonb_build_object(
        'transaction_id', new.transaction_id,
        'message_id',     new.id,
        'reason',         new.flagged_reason
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists chat_message_flagged_trigger on public.chat_messages;
create trigger chat_message_flagged_trigger
  after insert on public.chat_messages
  for each row
  when (new.flagged)
  execute function public.log_chat_flagged();

-- The function is owned by postgres and not user-callable directly.
-- Trigger executes with definer privileges, so it can write to
-- security_events despite RLS.
revoke execute on function public.log_chat_flagged() from public;
revoke execute on function public.log_chat_flagged() from anon;
revoke execute on function public.log_chat_flagged() from authenticated;
