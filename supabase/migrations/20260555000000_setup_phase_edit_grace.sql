-- =====================================================================
-- Cold-launch loosening A: setup-phase edit grace for payout methods.
--
-- The 20260544 BEFORE UPDATE trigger stamps details_changed_at on every
-- genuine account_number / recipient_name edit, which arms the 24h
-- cooldown in create_transaction. That protects rails counterparties
-- might send money to — but it also meant a brand-new user who added
-- their payout details, spotted a typo, and immediately fixed it was
-- frozen out of their first deal for 24 hours. The typo-fix trap is the
-- same cold-start failure 20260551 removed for first-time creation,
-- re-entered through one edit.
--
-- Grace rule: an edit does NOT stamp while the owner has ZERO
-- non-cancelled deals (nothing in flight, nothing completed — the same
-- transaction_claims_inventory set the inventory math uses). In that
-- state there is no counterparty to defraud and no in-flight deal to
-- swap under; an attacker gains nothing they couldn't get by creating
-- the rail correctly in the first place (INSERT has not stamped since
-- 20260551). The moment ANY claiming deal exists, every edit stamps
-- exactly as before — the established-account takeover freeze and the
-- 20260548 mid-deal swap guard are untouched for anyone with history.
--
-- The trigger runs inside upsert_payment_method (SECURITY DEFINER), so
-- it may call transaction_claims_inventory despite that helper's
-- revoked client execute.
-- =====================================================================

create or replace function public.payment_methods_stamp_details_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.account_number is distinct from old.account_number
      or new.recipient_name is distinct from old.recipient_name)
     and exists (
       select 1
         from public.transactions t
        where (t.initiator_id = new.user_id or t.counterparty_id = new.user_id)
          and public.transaction_claims_inventory(t.status)
     )
  then
    new.details_changed_at := now();
  end if;
  return new;
end;
$$;

revoke execute on function public.payment_methods_stamp_details_change() from public;
revoke execute on function public.payment_methods_stamp_details_change() from anon;
revoke execute on function public.payment_methods_stamp_details_change() from authenticated;
