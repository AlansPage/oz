-- =====================================================================
-- Phase 5.4: payout-change alert — the other half of the 24h freeze.
--
-- When a payment method is created or its account_number/recipient_name
-- change, the owner gets an immediate Telegram message. Combined with
-- the 20260544 freeze, an account takeover that swaps the payout rail
-- gives the real owner a 24-hour window in which (a) they are told and
-- (b) the new rail cannot receive a deal.
--
-- Same database-event -> edge-function pattern as transactions, with one
-- deliberate difference: the transactions webhooks were clicked together
-- in the dashboard and exist only where someone clicked them. This
-- trigger ships in the migration and calls net.http_post itself, reading
-- the shared secret from Vault ('payment_method_event_webhook_secret'),
-- so the repo stays secret-free and the wiring can't silently be absent.
-- If the Vault secret is missing, the trigger warns and lets the write
-- through — the alert is best-effort and must never block a user from
-- saving payout details.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Recipient + message resolution, service-role only (the edge function
-- calls this; mirrors find_transaction_event_notifications). Returns the
-- owner even without a telegram link so the edge function can log the
-- skip loudly ('no_telegram_link') instead of silently dropping it.
-- ---------------------------------------------------------------------

create or replace function public.find_payment_method_event_notification(
  p_payment_method_id uuid
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
  v_pm public.payment_methods;
  v_profile public.profiles;
  v_tg bigint;
begin
  select * into v_pm from public.payment_methods where id = p_payment_method_id;
  if not found then return; end if;

  select * into v_profile from public.profiles where id = v_pm.user_id;
  if not found then return; end if;

  select tl.telegram_user_id into v_tg
    from public.telegram_links tl
   where tl.phone = v_profile.phone;

  return query select
    v_pm.user_id,
    v_tg,
    'öz: ваши реквизиты изменены' || E'\n\n'
      || v_pm.bank_name || ' (' || v_pm.currency || '): реквизиты для получения переводов были изменены. '
      || 'Новые сделки с этими реквизитами станут доступны через 24 часа.' || E'\n\n'
      || 'Если это были не вы — ответьте на это сообщение.';
end;
$$;

revoke execute on function public.find_payment_method_event_notification(uuid) from public;
revoke execute on function public.find_payment_method_event_notification(uuid) from anon;
revoke execute on function public.find_payment_method_event_notification(uuid) from authenticated;

-- ---------------------------------------------------------------------
-- The trigger: queue an HTTP call to the edge function. SECURITY DEFINER
-- for vault access; everything wrapped so a notification failure can
-- never fail the payment-method write itself.
-- ---------------------------------------------------------------------

create or replace function public.notify_payment_method_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secret text;
begin
  begin
    select ds.decrypted_secret into v_secret
      from vault.decrypted_secrets ds
     where ds.name = 'payment_method_event_webhook_secret';

    if v_secret is null then
      raise warning 'notify_payment_method_event: vault secret missing, alert skipped for %', new.id;
      return new;
    end if;

    perform net.http_post(
      url := 'https://sdgdeuhligplyemhuirn.supabase.co/functions/v1/notify-payment-method-event',
      body := jsonb_build_object(
        'type', tg_op,
        'table', 'payment_methods',
        'record', jsonb_build_object('id', new.id)
      ),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-payment-method-event-secret', v_secret
      ),
      timeout_milliseconds := 5000
    );
  exception when others then
    raise warning 'notify_payment_method_event: % (alert skipped for %)', sqlerrm, new.id;
  end;
  return new;
end;
$$;

revoke execute on function public.notify_payment_method_event() from public;
revoke execute on function public.notify_payment_method_event() from anon;
revoke execute on function public.notify_payment_method_event() from authenticated;

drop trigger if exists payment_methods_notify_insert on public.payment_methods;
create trigger payment_methods_notify_insert
  after insert on public.payment_methods
  for each row
  execute function public.notify_payment_method_event();

-- Fires only on real detail changes, matching the freeze stamp in
-- 20260544 — a no-op re-save alerts nobody.
drop trigger if exists payment_methods_notify_update on public.payment_methods;
create trigger payment_methods_notify_update
  after update on public.payment_methods
  for each row
  when (new.account_number is distinct from old.account_number
        or new.recipient_name is distinct from old.recipient_name)
  execute function public.notify_payment_method_event();
