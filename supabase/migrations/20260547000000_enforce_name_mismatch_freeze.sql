-- =====================================================================
-- Phase 4 hardening: enforce the name-mismatch freeze server-side.
--
-- report_recipient_name_mismatch (20260540) sets transactions.
-- name_mismatch_at and the client renders the frozen state, but
-- advance_transaction never checked it — the freeze was client-side
-- only. A direct RPC call (e.g. advance_transaction('initiator_mark_
-- paid') via /rest/v1/rpc) advanced the state machine while frozen,
-- defeating the strongest pre-send fraud signal we capture.
--
-- Redefines advance_transaction identical to 20260519 except one new
-- guard after the party check: while name_mismatch_at is set, every
-- action except 'cancel' raises 'name_mismatch_frozen'. Cancel stays
-- allowed because walking away is the reporter's legitimate exit; the
-- freeze itself is cleared by the counterparty via
-- resolve_recipient_name_mismatch (20260541).
-- =====================================================================

create or replace function public.advance_transaction(
  p_transaction_id uuid,
  p_action text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_uid uuid := (select auth.uid());
  v_is_initiator boolean;
  v_is_counterparty boolean;
begin
  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found then raise exception 'transaction not found'; end if;

  v_is_initiator    := (v_uid = v_tx.initiator_id);
  v_is_counterparty := (v_uid = v_tx.counterparty_id);

  if not (v_is_initiator or v_is_counterparty) then
    raise exception 'not a party to this transaction';
  end if;

  -- Server-side half of the Phase 4 freeze: while a recipient-name
  -- mismatch is unresolved, no state can advance. Cancel stays allowed —
  -- walking away is the reporter's legitimate exit.
  if v_tx.name_mismatch_at is not null and p_action <> 'cancel' then
    raise exception 'name_mismatch_frozen';
  end if;

  if p_action = 'initiator_mark_paid' then
    if not v_is_initiator then raise exception 'only initiator can do this'; end if;
    if v_tx.status <> 'pending_sender_payment' then raise exception 'wrong state'; end if;
    update public.transactions
       set status = 'sender_paid', initiator_paid_at = now()
     where id = p_transaction_id
     returning * into v_tx;

  elsif p_action = 'counterparty_confirm' then
    if not v_is_counterparty then raise exception 'only counterparty can do this'; end if;
    if v_tx.status <> 'sender_paid' then raise exception 'wrong state'; end if;
    update public.transactions
       set status = 'counterparty_confirmed', counterparty_confirmed_at = now()
     where id = p_transaction_id
     returning * into v_tx;

  elsif p_action = 'counterparty_mark_paid' then
    if not v_is_counterparty then raise exception 'only counterparty can do this'; end if;
    if v_tx.status <> 'counterparty_confirmed' then raise exception 'wrong state'; end if;
    update public.transactions
       set status = 'counterparty_paid', counterparty_paid_at = now()
     where id = p_transaction_id
     returning * into v_tx;

  elsif p_action = 'initiator_confirm' then
    if not v_is_initiator then raise exception 'only initiator can do this'; end if;
    if v_tx.status <> 'counterparty_paid' then raise exception 'wrong state'; end if;
    update public.transactions
       set status = 'completed',
           initiator_confirmed_at = now(),
           completed_at = now()
     where id = p_transaction_id
     returning * into v_tx;

  elsif p_action = 'cancel' then
    if v_tx.status not in ('pending_sender_payment') then
      raise exception 'can only cancel before any payment';
    end if;
    update public.transactions
       set status = 'cancelled'
     where id = p_transaction_id
     returning * into v_tx;

    update public.listings set status = 'active'
     where id = v_tx.listing_id and status = 'matched';

  else
    raise exception 'unknown action: %', p_action;
  end if;

  return v_tx;
end;
$$;

grant execute on function public.advance_transaction(uuid, text) to authenticated;
