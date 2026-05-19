-- Slice 4: receipts-as-evidence transaction flow.
--
-- Extends transactions with per-step timestamps and dispute fields, replaces
-- the status check constraint with the 7-state machine, drops the broad
-- user UPDATE policy on transactions (the new SECURITY DEFINER RPCs are
-- the only legal mutation path), creates the receipts table + RLS, two
-- RPCs (advance_transaction, open_dispute), the private storage bucket
-- and its RLS, and adds receipts to the realtime publication.

-- =====================================================================
-- 1. Extend transactions
-- =====================================================================

alter table public.transactions
  add column initiator_paid_at         timestamptz,
  add column counterparty_paid_at      timestamptz,
  add column initiator_confirmed_at    timestamptz,
  add column counterparty_confirmed_at timestamptz,
  add column disputed_at               timestamptz,
  add column disputed_by               uuid references public.profiles(id),
  add column dispute_reason            text,
  add column dispute_description       text;

alter table public.transactions drop constraint transactions_status_check;
alter table public.transactions add constraint transactions_status_check
  check (status in (
    'pending_sender_payment',
    'sender_paid',
    'counterparty_confirmed',
    'counterparty_paid',
    'completed',
    'disputed',
    'cancelled'
  ));

-- =====================================================================
-- 2. Drop the broad user-facing UPDATE policy on transactions.
--    advance_transaction and open_dispute are SECURITY DEFINER, so they
--    bypass RLS — leaving the policy in place would let a misbehaving
--    client `update status='completed'` directly via supabase-js.
-- =====================================================================

drop policy if exists transactions_update_own on public.transactions;

-- =====================================================================
-- 3. Receipts table
-- =====================================================================

create table public.receipts (
  id              uuid primary key default gen_random_uuid(),
  transaction_id  uuid not null references public.transactions(id) on delete restrict,
  uploader_id     uuid not null references public.profiles(id) on delete restrict,
  storage_path    text not null,
  side            text not null check (side in ('initiator', 'counterparty')),
  amount_claimed  numeric(12,2),
  currency        text not null check (currency in ('KZT', 'KRW')),
  created_at      timestamptz not null default now(),
  ocr_status      text check (ocr_status in ('pending', 'parsed', 'failed')) default null,
  ocr_data        jsonb,
  ocr_confidence  numeric(3,2),
  verified        boolean not null default false,
  unique (transaction_id, side)
);

create index receipts_transaction_idx on public.receipts (transaction_id);
create index receipts_uploader_idx    on public.receipts (uploader_id);

-- =====================================================================
-- 4. Receipts RLS
-- =====================================================================

alter table public.receipts enable row level security;

create policy receipts_select_parties on public.receipts
  for select
  to authenticated
  using (
    exists (
      select 1 from public.transactions t
      where t.id = receipts.transaction_id
        and ((select auth.uid()) = t.initiator_id
             or (select auth.uid()) = t.counterparty_id)
    )
  );

create policy receipts_insert_own_side on public.receipts
  for insert
  to authenticated
  with check (
    uploader_id = (select auth.uid())
    and exists (
      select 1 from public.transactions t
      where t.id = receipts.transaction_id
        and (
          (receipts.side = 'initiator'
            and t.initiator_id = (select auth.uid())
            and t.status = 'pending_sender_payment')
          or
          (receipts.side = 'counterparty'
            and t.counterparty_id = (select auth.uid())
            and t.status = 'counterparty_confirmed')
        )
    )
  );

-- No UPDATE / DELETE policies — receipts are immutable from a user POV.

-- =====================================================================
-- 5. advance_transaction(): single SECURITY DEFINER entry point that
--    enforces the state machine.
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

-- =====================================================================
-- 6. open_dispute()
-- =====================================================================

create or replace function public.open_dispute(
  p_transaction_id uuid,
  p_reason text,
  p_description text
)
returns public.transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tx public.transactions;
  v_uid uuid := (select auth.uid());
begin
  select * into v_tx from public.transactions where id = p_transaction_id for update;
  if not found then raise exception 'transaction not found'; end if;

  if v_uid not in (v_tx.initiator_id, v_tx.counterparty_id) then
    raise exception 'not a party';
  end if;
  if v_tx.status in ('completed', 'cancelled', 'disputed') then
    raise exception 'cannot dispute in current state';
  end if;
  if p_reason not in ('not_received', 'wrong_amount', 'wrong_account', 'other') then
    raise exception 'invalid reason';
  end if;

  update public.transactions
     set status = 'disputed',
         disputed_at = now(),
         disputed_by = v_uid,
         dispute_reason = p_reason,
         dispute_description = p_description
   where id = p_transaction_id
   returning * into v_tx;

  return v_tx;
end;
$$;

grant execute on function public.open_dispute(uuid, text, text) to authenticated;

-- =====================================================================
-- 7. Realtime
-- =====================================================================

alter publication supabase_realtime add table public.receipts;

-- =====================================================================
-- 8. Private receipts storage bucket
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,  -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

-- =====================================================================
-- 9. Storage RLS on storage.objects for the receipts bucket.
--    Path convention: {transaction_id}/{initiator|counterparty}_{ts}.{ext}
--    storage.foldername(name)[1] → '{transaction_id}'
--    split_part(name, '/', 2)    → '{side}_{ts}.{ext}'
-- =====================================================================

drop policy if exists receipts_storage_select on storage.objects;
create policy receipts_storage_select on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and exists (
      select 1 from public.transactions t
      where t.id = ((storage.foldername(name))[1])::uuid
        and ((select auth.uid()) = t.initiator_id
             or (select auth.uid()) = t.counterparty_id)
    )
  );

drop policy if exists receipts_storage_insert on storage.objects;
create policy receipts_storage_insert on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and owner = (select auth.uid())
    and exists (
      select 1 from public.transactions t
      where t.id = ((storage.foldername(name))[1])::uuid
        and (
          (split_part(name, '/', 2) like 'initiator_%'
            and t.initiator_id = (select auth.uid())
            and t.status = 'pending_sender_payment')
          or
          (split_part(name, '/', 2) like 'counterparty_%'
            and t.counterparty_id = (select auth.uid())
            and t.status = 'counterparty_confirmed')
        )
    )
  );

-- No UPDATE / DELETE storage policies for receipts; service role retains
-- full access via the default service_role bypass.
