-- =====================================================================
-- Fix: ambiguous column reference in find_transaction_event_notifications
--
-- The RPC introduced in slice 13 (20260527000000_transaction_notifications.sql)
-- declares an output column `telegram_user_id` in its RETURNS TABLE. Inside
-- the body, the two `select telegram_user_id ... from public.telegram_links`
-- statements reference the same unqualified column name, so Postgres raises
-- "column reference \"telegram_user_id\" is ambiguous" and the function never
-- executes.
--
-- This CREATE OR REPLACE keeps the exact same signature, body, and behavior,
-- adding table aliases to disambiguate the telegram_links lookups. No message
-- wording, event type, condition, or URL changes.
-- =====================================================================

create or replace function public.find_transaction_event_notifications(
  p_transaction_id uuid,
  p_event_type text  -- 'created', 'advanced', 'completed', 'disputed', 'cancelled'
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
      -- Counterparty needs to confirm receipt
      v_target_user_id := v_tx.counterparty_id;
      v_target_tg := v_counterparty_tg;
      v_other_name := coalesce(v_initiator_profile.display_name, 'контрагент');
      v_msg := 'öz: контрагент отправил перевод' || E'\n\n'
            || v_other_name || ' прислал чек на ' || v_amount_text
            || E'\nПроверьте поступление в банке и подтвердите.' || E'\n\n'
            || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    else
      return;
    end if;

  elsif p_event_type = 'completed' then
    -- Both parties get a completion notification
    if v_initiator_tg is not null then
      return query select
        v_tx.initiator_id,
        v_initiator_tg,
        'öz: сделка завершена' || E'\n\n'
          || 'Обмен с ' || coalesce(v_counterparty_profile.display_name, 'контрагентом')
          || ' завершён.' || E'\n'
          || 'Оцените сделку, чтобы помочь сообществу.' || E'\n\n'
          || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    end if;
    if v_counterparty_tg is not null then
      return query select
        v_tx.counterparty_id,
        v_counterparty_tg,
        'öz: сделка завершена' || E'\n\n'
          || 'Обмен с ' || coalesce(v_initiator_profile.display_name, 'контрагентом')
          || ' завершён.' || E'\n'
          || 'Оцените сделку, чтобы помочь сообществу.' || E'\n\n'
          || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    end if;
    return;

  elsif p_event_type = 'disputed' then
    -- Both parties get a dispute notification
    if v_initiator_tg is not null then
      return query select
        v_tx.initiator_id,
        v_initiator_tg,
        'öz: открыт спор' || E'\n\n'
          || 'По сделке с ' || coalesce(v_counterparty_profile.display_name, 'контрагентом')
          || ' открыт спор.' || E'\n'
          || 'Команда öz свяжется с обеими сторонами.' || E'\n\n'
          || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    end if;
    if v_counterparty_tg is not null then
      return query select
        v_tx.counterparty_id,
        v_counterparty_tg,
        'öz: открыт спор' || E'\n\n'
          || 'По сделке с ' || coalesce(v_initiator_profile.display_name, 'контрагентом')
          || ' открыт спор.' || E'\n'
          || 'Команда öz свяжется с обеими сторонами.' || E'\n\n'
          || 'Открыть: https://oz-flame.vercel.app/transaction/' || v_tx.id::text;
    end if;
    return;

  elsif p_event_type = 'cancelled' then
    -- Notify the OTHER party (whoever didn't cancel). For simplicity,
    -- notify both; the canceller can ignore.
    if v_initiator_tg is not null then
      return query select
        v_tx.initiator_id,
        v_initiator_tg,
        'öz: сделка отменена' || E'\n\n'
          || 'Сделка с ' || coalesce(v_counterparty_profile.display_name, 'контрагентом')
          || ' отменена.';
    end if;
    if v_counterparty_tg is not null then
      return query select
        v_tx.counterparty_id,
        v_counterparty_tg,
        'öz: сделка отменена' || E'\n\n'
          || 'Сделка с ' || coalesce(v_initiator_profile.display_name, 'контрагентом')
          || ' отменена.';
    end if;
    return;
  end if;

  -- Default single-recipient return for 'created' and 'advanced'
  if v_target_tg is not null then
    return query select v_target_user_id, v_target_tg, v_msg;
  end if;
end;
$$;

revoke execute on function public.find_transaction_event_notifications(uuid, text) from public;
revoke execute on function public.find_transaction_event_notifications(uuid, text) from anon;
revoke execute on function public.find_transaction_event_notifications(uuid, text) from authenticated;
-- Service-role only, called from the notify-transaction-event edge function.
