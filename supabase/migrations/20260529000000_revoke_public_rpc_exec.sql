-- =====================================================================
-- Defense-in-depth: revoke PUBLIC/anon EXECUTE on the two transaction
-- RPCs that were left world-executable.
--
-- advance_transaction and open_dispute are SECURITY DEFINER functions in
-- the public schema. Postgres grants EXECUTE to PUBLIC by default, and
-- these two (unlike every other RPC in the project) never revoked it, so
-- they are reachable by the `anon` role via /rest/v1/rpc/*. Both have an
-- internal `auth.uid()` party-check that already rejects anonymous callers
-- (auth.uid() is null -> "not a party"), so there is no data exposure --
-- this aligns them with the project convention and clears the two
-- `anon_security_definer_function_executable` advisor warnings.
-- =====================================================================

revoke execute on function public.advance_transaction(uuid, text) from public;
revoke execute on function public.advance_transaction(uuid, text) from anon;

revoke execute on function public.open_dispute(uuid, text, text) from public;
revoke execute on function public.open_dispute(uuid, text, text) from anon;
