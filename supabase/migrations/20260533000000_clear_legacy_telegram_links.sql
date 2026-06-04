-- =====================================================================
-- Clear legacy telegram_links established under the insecure phone-typed
-- binding flow.
--
-- Before the verified-contact-share fix, a telegram_links row could be
-- created by anyone who sent `/verify +7<phone>` for a pending code — the
-- bound Telegram account was never proven to own the phone. Those rows are
-- therefore untrustworthy. Clearing the table forces every user to re-bind
-- via Telegram's verified "Share my phone number" step on next login.
--
-- No schema change: telegram_links and auth_codes already support the new
-- flow. auth_codes rows are transient (5 min TTL) and are intentionally
-- left alone.
-- =====================================================================

truncate table public.telegram_links;

-- Allow the new security event emitted when a Telegram contact share does not
-- match the sender (contact.user_id !== from.id).
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
    'payment_method_revealed'
  ));
