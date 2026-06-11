-- =====================================================================
-- Phase 4.2: mismatch recovery path + Telegram notifications.
--
-- 1. resolve_recipient_name_mismatch: the counterparty (the party whose
--    payout details were flagged) signals «исправлено», clearing the
--    freeze set by report_recipient_name_mismatch. Only the NON-reporter
--    may resolve — the reporter's own affordance is cancel.
--
-- 2. find_transaction_event_notifications learns two event types, fired
--    by the existing transactions UPDATE webhook when the edge function
--    sees name_mismatch_at flip:
--      'name_mismatch'          — reporter gets do-not-send confirmation,
--                                 the other party gets fix-your-details
--                                 (reuses the 'disputed' both-parties
--                                 plumbing pattern);
--      'name_mismatch_resolved' — both parties (resolver can ignore,
--                                 same precedent as 'cancelled'), since
--                                 the columns are already cleared by the
--                                 time the webhook fires and the reporter
--                                 is no longer identifiable here.
--    Everything else is identical to 20260536000000.
-- =====================================================================

create or replace function public.resolve_recipient_name_mismatch(
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

  if v_tx.name_mismatch_at is null then
    return v_tx;  -- nothing to resolve; idempotent
  end if;

  -- Only the flagged party can clear the freeze. The reporter froze the
  -- deal to protect themselves; letting them "resolve" without the other
  -- side touching anything would defeat the checkpoint.
  if v_uid = v_tx.name_mismatch_by then
    raise exception 'reporter_cannot_resolve';
  end if;

  update public.transactions
     set name_mismatch_at = null,
         name_mismatch_by = null
   where id = p_transaction_id
  returning * into v_tx;

  insert into public.security_events (event_type, user_id, detail)
  values (
    'recipient_name_mismatch_resolved',
    v_uid,
    jsonb_build_object(
      'transaction_id', p_transaction_id,
      'resolved_by', v_uid
    )
  );

  return v_tx;
end;
$$;

revoke execute on function public.resolve_recipient_name_mismatch(uuid) from public, anon;
grant execute on function public.resolve_recipient_name_mismatch(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Notification routing for the two new events.
-- ---------------------------------------------------------------------

create or replace function public.find_transaction_event_notifications(
  p_transaction_id uuid,
  p_event_type text  -- 'created', 'advanced', 'completed', 'disputed',
                     -- 'cancelled', 'name_mismatch', 'name_mismatch_resolved'
)
returns table(
  user_id uuid,
  telegram_user_id bigint,
  message_text text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_listing public.listings;
  v_initiator_profile public.profiles;
  v_counterparty_profile public.profiles;
  v_initiator_tg bigint;
  v_counterparty_tg bigint;
  v_target_user_id uuid;
  v_target_tg bigint;
  v_other_name text;
  v_amount_text text;
  v_msg text;
begin
  select * into v_tx from public.transactions where id = p_transaction_id;
  if not found then return; end if;

  select * into v_listing from public.listings where id = v_tx.listing_id;
  select * into v_initiator_profile from public.profiles where id = v_tx.initiator_id;
  select * into v_counterparty_profile from public.profiles where id = v_tx.counterparty_id;

  select tl.telegram_user_id into v_initiator_tg
    from public.telegram_links tl where tl.phone = v_initiator_profile.phone;
  select tl.telegram_user_id into v_counterparty_tg
    from public.telegram_links tl where tl.phone = v_counterparty_profile.phone;

  v_amount_text := to_char(v_tx.amount, 'FM999G999G999D99')
                || ' '
                || case v_tx.amount_currency when 'KZT' then '₸' else '₩' end;

  -- Determine WHO needs notification per event type, and what message
  if p_event_type = 'created' then
    -- New transaction: notify the LISTING OWNER (whoever didn't initiate).
    -- The initiator already knows -- they just tapped "Начать обмен".
    if v_tx.initiator_id = v_listing.user_id then
      -- Initiator is the listing owner; counterparty took the listing
      v_target_user_id := v_tx.initiator_id;
      v_target_tg := v_initiator_tg;
      v_other_name := coalesce(v_counterparty_profile.display_name, 'контрагент');
    else
      v_target_user_id := v_tx.counterparty_id;
      v_target_tg := v_counterparty_tg;
      v_other_name := coalesce(v_initiator_profile.display_name, 'контрагент');
    end if;
    v_msg := 'öz: новая сделка' || E'\n\n'
          || v_other_name || ' хочет обменять ' || v_amount_text || E'\n\n'
          || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;

  elsif p_event_type = 'advanced' then
    -- Status changed. Notify whichever party now needs to act.
    -- The party who just acted doesn't need a notification.
    if v_tx.status = 'sender_paid' then
      -- Counterparty needs to confirm receipt of the initiator's transfer
      v_target_user_id := v_tx.counterparty_id;
      v_target_tg := v_counterparty_tg;
      v_other_name := coalesce(v_initiator_profile.display_name, 'контрагент');
      v_msg := 'öz: контрагент отправил перевод' || E'\n\n'
            || v_other_name || ' прислал чек на ' || v_amount_text
            || E'\nПроверьте поступление в банке и подтвердите.' || E'\n\n'
            || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    elsif v_tx.status = 'counterparty_confirmed' then
      -- Counterparty confirmed receipt; now they must send their own leg
      v_target_user_id := v_tx.counterparty_id;
      v_target_tg := v_counterparty_tg;
      v_other_name := coalesce(v_initiator_profile.display_name, 'контрагент');
      v_msg := 'öz: ваша очередь отправить перевод' || E'\n\n'
            || v_other_name || ' подтвердил получение. Теперь отправьте свой перевод и приложите чек.' || E'\n\n'
            || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    elsif v_tx.status = 'counterparty_paid' then
      -- Counterparty sent their leg; initiator must confirm receipt
      v_target_user_id := v_tx.initiator_id;
      v_target_tg := v_initiator_tg;
      v_other_name := coalesce(v_counterparty_profile.display_name, 'контрагент');
      v_msg := 'öz: контрагент отправил перевод' || E'\n\n'
            || v_other_name || ' прислал перевод по сделке. Проверьте поступление и подтвердите.' || E'\n\n'
            || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    else
      return;
    end if;

  elsif p_event_type = 'completed' then
    -- Both parties get a completion notification (null tg id = the edge
    -- function logs a 'no_telegram_link' failure instead of sending)
    return query select
      v_tx.initiator_id,
      v_initiator_tg,
      'öz: сделка завершена' || E'\n\n'
        || 'Обмен с ' || coalesce(v_counterparty_profile.display_name, 'контрагентом')
        || ' завершён.' || E'\n'
        || 'Оцените сделку, чтобы помочь сообществу.' || E'\n\n'
        || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    return query select
      v_tx.counterparty_id,
      v_counterparty_tg,
      'öz: сделка завершена' || E'\n\n'
        || 'Обмен с ' || coalesce(v_initiator_profile.display_name, 'контрагентом')
        || ' завершён.' || E'\n'
        || 'Оцените сделку, чтобы помочь сообществу.' || E'\n\n'
        || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    return;

  elsif p_event_type = 'disputed' then
    -- Both parties get a dispute notification
    return query select
      v_tx.initiator_id,
      v_initiator_tg,
      'öz: открыт спор' || E'\n\n'
        || 'По сделке с ' || coalesce(v_counterparty_profile.display_name, 'контрагентом')
        || ' открыт спор.' || E'\n'
        || 'Команда öz свяжется с обеими сторонами.' || E'\n\n'
        || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    return query select
      v_tx.counterparty_id,
      v_counterparty_tg,
      'öz: открыт спор' || E'\n\n'
        || 'По сделке с ' || coalesce(v_initiator_profile.display_name, 'контрагентом')
        || ' открыт спор.' || E'\n'
        || 'Команда öz свяжется с обеими сторонами.' || E'\n\n'
        || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    return;

  elsif p_event_type = 'cancelled' then
    -- Notify the OTHER party (whoever didn't cancel). For simplicity,
    -- notify both; the canceller can ignore.
    return query select
      v_tx.initiator_id,
      v_initiator_tg,
      'öz: сделка отменена' || E'\n\n'
        || 'Сделка с ' || coalesce(v_counterparty_profile.display_name, 'контрагентом')
        || ' отменена.';
    return query select
      v_tx.counterparty_id,
      v_counterparty_tg,
      'öz: сделка отменена' || E'\n\n'
        || 'Сделка с ' || coalesce(v_initiator_profile.display_name, 'контрагентом')
        || ' отменена.';
    return;

  elsif p_event_type = 'name_mismatch' then
    -- Reporter gets a do-not-send confirmation; the flagged party gets a
    -- fix-your-details prompt. name_mismatch_by is still set here (the
    -- webhook fires on the UPDATE that set it).
    if v_tx.name_mismatch_by is null then return; end if;
    if v_tx.name_mismatch_by = v_tx.initiator_id then
      return query select
        v_tx.initiator_id,
        v_initiator_tg,
        'öz: перевод остановлен' || E'\n\n'
          || 'Не отправляйте деньги. '
          || coalesce(v_counterparty_profile.display_name, 'Контрагент')
          || ' получил уведомление и должен исправить реквизиты. Мы сообщим, когда они обновятся.' || E'\n\n'
          || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
      return query select
        v_tx.counterparty_id,
        v_counterparty_tg,
        'öz: проверьте ваши реквизиты' || E'\n\n'
          || coalesce(v_initiator_profile.display_name, 'Контрагент')
          || ' сообщил, что имя получателя не совпадает с вашими реквизитами. Перевод приостановлен — проверьте и исправьте их в сделке.' || E'\n\n'
          || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    else
      return query select
        v_tx.counterparty_id,
        v_counterparty_tg,
        'öz: перевод остановлен' || E'\n\n'
          || 'Не отправляйте деньги. '
          || coalesce(v_initiator_profile.display_name, 'Контрагент')
          || ' получил уведомление и должен исправить реквизиты. Мы сообщим, когда они обновятся.' || E'\n\n'
          || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
      return query select
        v_tx.initiator_id,
        v_initiator_tg,
        'öz: проверьте ваши реквизиты' || E'\n\n'
          || coalesce(v_counterparty_profile.display_name, 'Контрагент')
          || ' сообщил, что имя получателя не совпадает с вашими реквизитами. Перевод приостановлен — проверьте и исправьте их в сделке.' || E'\n\n'
          || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    end if;
    return;

  elsif p_event_type = 'name_mismatch_resolved' then
    -- Both parties; the resolver can ignore (same precedent as
    -- 'cancelled'). The sender re-verifies the name before sending.
    return query select
      v_tx.initiator_id,
      v_initiator_tg,
      'öz: реквизиты обновлены' || E'\n\n'
        || 'Контрагент подтвердил исправление по сделке. Сверьте имя получателя ещё раз перед отправкой.' || E'\n\n'
        || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    return query select
      v_tx.counterparty_id,
      v_counterparty_tg,
      'öz: реквизиты обновлены' || E'\n\n'
        || 'Контрагент подтвердил исправление по сделке. Сверьте имя получателя ещё раз перед отправкой.' || E'\n\n'
        || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    return;
  end if;

  -- Single-recipient return for 'created' and 'advanced'. Return the
  -- resolved recipient even without a telegram link so the skip is logged.
  if v_target_user_id is not null then
    return query select v_target_user_id, v_target_tg, v_msg;
  end if;
end;
$$;

revoke execute on function public.find_transaction_event_notifications(uuid, text) from public;
revoke execute on function public.find_transaction_event_notifications(uuid, text) from anon;
revoke execute on function public.find_transaction_event_notifications(uuid, text) from authenticated;
-- Service-role only, called from the notify-transaction-event edge function.
