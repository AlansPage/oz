-- =====================================================================
-- Tidy-up from the 2026-07-18 coherence audit: revoke the default
-- table-level write GRANTs that no RLS policy (and no client code path)
-- actually uses.
--
-- Today these grants are all inert — every one of them is stopped by RLS
-- default-deny (no INSERT/UPDATE/DELETE policy exists on the table for
-- the role), so nothing here changes live behavior. But 20260549 taught
-- us that grants + a later well-meaning policy is exactly how the
-- profiles self-promotion hole appeared: the grant sat dormant until a
-- permissive policy made it reachable. Removing the dead grants makes
-- the GRANT layer state the actual write model instead of relying on
-- policy absence.
--
-- Kept, because a policy AND a client/RPC path rely on them
-- (authenticated only):
--   alert_subscriptions  INSERT/UPDATE/DELETE  (alerts UI writes directly)
--   listings             INSERT/UPDATE         (feed create + withdraw/edit)
--   ratings              INSERT                (RatingCard)
--   receipts             INSERT                (ReceiptUploadSheet)
--   payment_methods      DELETE                (delete-own policy)
--
-- anon keeps no write grants anywhere: the app has no unauthenticated
-- write path (auth_codes/telegram_links/security_events are written by
-- service_role, which these revokes never touch).
-- =====================================================================

-- anon: no write path exists app-wide; strip everything.
revoke insert, update, delete on all tables in schema public from anon;

-- authenticated: tables whose writes flow ONLY through SECURITY DEFINER
-- RPCs or service_role — no policy, no direct client write.
revoke insert, update, delete on public.auth_codes        from authenticated;
revoke insert, update, delete on public.telegram_links    from authenticated;
revoke insert, update, delete on public.security_events   from authenticated;
revoke insert, update, delete on public.chat_messages     from authenticated;
revoke insert, update, delete on public.notification_log  from authenticated;

-- transactions: created via create_transaction, advanced via
-- advance_transaction / open_dispute / the name-mismatch RPCs. Never
-- written directly.
revoke update, delete on public.transactions from authenticated;

-- Partial revokes where only some verbs are policy-backed.
revoke delete         on public.listings from authenticated;  -- withdraw is an UPDATE
revoke update, delete on public.ratings  from authenticated;  -- ratings are immutable
revoke update, delete on public.receipts from authenticated;  -- receipts are immutable
