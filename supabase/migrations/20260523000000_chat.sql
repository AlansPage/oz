-- =====================================================================
-- Slice 8: in-app counterparty chat scoped to a transaction.
--
-- Messages live on chat_messages, are readable only by the two parties
-- on the parent transaction, and are written only via send_chat_message
-- (security definer) which enforces party check, active-status check,
-- per-sender rate limit, and a soft fraud flag for patterns commonly
-- used to pull users off-platform.
-- =====================================================================

create table public.chat_messages (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references public.transactions(id) on delete cascade,
  sender_id       uuid not null references public.profiles(id) on delete restrict,
  body            text not null check (length(trim(body)) between 1 and 1000),
  flagged         boolean not null default false,
  flagged_reason  text,
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);

create index chat_messages_transaction_idx
  on public.chat_messages (transaction_id, created_at);
create index chat_messages_unread_idx
  on public.chat_messages (transaction_id, sender_id)
  where read_at is null;

-- =====================================================================
-- RLS: only the two transaction parties can read. Writes go through
-- send_chat_message; updates go through mark_messages_read; no direct
-- INSERT / UPDATE / DELETE policies.
-- =====================================================================

alter table public.chat_messages enable row level security;

drop policy if exists chat_messages_select_parties on public.chat_messages;
create policy chat_messages_select_parties on public.chat_messages
  for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = chat_messages.transaction_id
        and (
          (select auth.uid()) = t.initiator_id
          or (select auth.uid()) = t.counterparty_id
        )
    )
  );

alter publication supabase_realtime add table public.chat_messages;

-- =====================================================================
-- send_chat_message RPC
-- =====================================================================

create or replace function public.send_chat_message(
  p_transaction_id uuid,
  p_body           text
)
returns public.chat_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := (select auth.uid());
  v_tx           public.transactions;
  v_msg          public.chat_messages;
  v_recent_count integer;
  v_body         text := trim(p_body);
  v_flagged      boolean := false;
  v_reason       text := null;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  if v_body is null or length(v_body) < 1 then
    raise exception 'empty_message';
  end if;
  if length(v_body) > 1000 then
    raise exception 'message_too_long';
  end if;

  -- Lock the transaction row to prevent race with state transitions.
  select * into v_tx
    from public.transactions
   where id = p_transaction_id
   for share;
  if not found then
    raise exception 'transaction_not_found';
  end if;

  if v_uid not in (v_tx.initiator_id, v_tx.counterparty_id) then
    raise exception 'not_a_party';
  end if;

  if v_tx.status in ('completed', 'cancelled', 'disputed') then
    raise exception 'transaction_closed';
  end if;

  -- Per-user rate limit: 30 messages per minute per transaction.
  select count(*) into v_recent_count
    from public.chat_messages
   where transaction_id = p_transaction_id
     and sender_id = v_uid
     and created_at > now() - interval '1 minute';
  if v_recent_count >= 30 then
    raise exception 'rate_limited';
  end if;

  -- Soft fraud signal: patterns commonly used to pull users off-platform
  -- or solicit out-of-band payment info. Flagging does NOT block delivery.
  if v_body ~* '(whatsapp|вотсап|ватсап)'
     or v_body ~* '(telegram|телеграм|телега|тг\s*[:.])'
     or v_body ~* '(kakao|какао|каkaо)'
     or v_body ~* '\b\d{12,}\b'
     or v_body ~* '(iban|айбан)' then
    v_flagged := true;
    v_reason  := 'pattern_match';
  end if;

  insert into public.chat_messages
    (transaction_id, sender_id, body, flagged, flagged_reason)
  values
    (p_transaction_id, v_uid, v_body, v_flagged, v_reason)
  returning * into v_msg;

  return v_msg;
end;
$$;

revoke execute on function public.send_chat_message(uuid, text) from public;
revoke execute on function public.send_chat_message(uuid, text) from anon;
grant  execute on function public.send_chat_message(uuid, text) to authenticated;

-- =====================================================================
-- mark_messages_read RPC — caller marks the OTHER party's messages
-- as read for this transaction. Idempotent.
-- =====================================================================

create or replace function public.mark_messages_read(
  p_transaction_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tx  public.transactions;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  select * into v_tx
    from public.transactions
   where id = p_transaction_id;
  if not found then
    raise exception 'transaction_not_found';
  end if;

  if v_uid not in (v_tx.initiator_id, v_tx.counterparty_id) then
    raise exception 'not_a_party';
  end if;

  update public.chat_messages
     set read_at = now()
   where transaction_id = p_transaction_id
     and sender_id <> v_uid
     and read_at is null;
end;
$$;

revoke execute on function public.mark_messages_read(uuid) from public;
revoke execute on function public.mark_messages_read(uuid) from anon;
grant  execute on function public.mark_messages_read(uuid) to authenticated;
