-- =====================================================================
-- Phase 4.1: the name-match checkpoint (sender side).
--
-- Both banking systems show the recipient's registered name on their own
-- transfer screens (Kaspi when transferring by phone/card; Korean banks
-- via the recipient lookup). The SendScreen now makes the sender confirm
-- that name against payment_methods.recipient_name BEFORE the press-and-
-- hold confirm is reachable. A mismatch is the strongest pre-send fraud
-- signal we can capture without a banking API.
--
-- Mismatch state lives on the transactions row (name_mismatch_at/_by) so
-- both parties' views update through the existing realtime UPDATE
-- subscription and the existing transactions UPDATE webhook can carry
-- the event to Telegram. security_events keeps the durable audit trail.
-- The freeze is cleared by the counterparty via
-- resolve_recipient_name_mismatch (Phase 4.2, next migration).
-- =====================================================================

alter table public.transactions
  add column name_mismatch_at timestamptz,
  add column name_mismatch_by uuid references public.profiles(id);

alter table public.security_events
  drop constraint if exists security_events_event_type_check;

alter table public.security_events
  add constraint security_events_event_type_check
  check (event_type in (
    'auth_failed',
    'auth_account_needs_migration',
    'auth_rate_limited',
    'webhook_auth_failed',
    'webhook_contact_mismatch',
    'rpc_unauthorized',
    'chat_flagged',
    'rate_limited',
    'suspicious_pattern',
    'payment_method_revealed',
    'recipient_name_mismatch',
    'recipient_name_mismatch_resolved'
  ));

-- ---------------------------------------------------------------------
-- report_recipient_name_mismatch: the sender's "Имя не совпадает" action.
-- Freezes the transaction's send affordance (client renders the frozen
-- state from name_mismatch_at) and audit-logs the event. Idempotent: a
-- second report while frozen is a no-op.
-- ---------------------------------------------------------------------

create or replace function public.report_recipient_name_mismatch(
  p_transaction_id uuid
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_tx public.transactions;
begin
  if v_uid is null then
    raise exception 'unauthorized';
  end if;

  select * into v_tx
    from public.transactions
   where id = p_transaction_id
   for update;
  if not found then
    raise exception 'transaction_not_found';
  end if;

  if v_uid not in (v_tx.initiator_id, v_tx.counterparty_id) then
    raise exception 'not_a_party';
  end if;

  -- Only while bank details are operationally live (same states as
  -- get_counterparty_payment_method): a mismatch can only be observed
  -- while someone is about to send.
  if v_tx.status not in ('pending_sender_payment', 'sender_paid', 'counterparty_confirmed', 'counterparty_paid') then
    raise exception 'transaction_state_not_eligible';
  end if;

  if v_tx.name_mismatch_at is not null then
    return v_tx;
  end if;

  update public.transactions
     set name_mismatch_at = now(),
         name_mismatch_by = v_uid
   where id = p_transaction_id
  returning * into v_tx;

  insert into public.security_events (event_type, user_id, detail)
  values (
    'recipient_name_mismatch',
    v_uid,
    jsonb_build_object(
      'transaction_id', p_transaction_id,
      'reported_by', v_uid,
      'counterparty_id', case when v_uid = v_tx.initiator_id
                              then v_tx.counterparty_id
                              else v_tx.initiator_id end,
      'status', v_tx.status
    )
  );

  return v_tx;
end;
$$;

revoke execute on function public.report_recipient_name_mismatch(uuid) from public, anon;
grant execute on function public.report_recipient_name_mismatch(uuid) to authenticated;
