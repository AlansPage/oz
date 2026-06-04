# Telegram OTP — verified-contact binding (design)

Date: 2026-06-04
Status: Approved (Variant A)

## Problem

The Telegram OTP login lets any caller `POST /api/auth/request-code` with **any**
phone number (the endpoint is public). For a phone not yet in `telegram_links`,
this stores a pending `auth_codes` row (`delivered=false`). In Telegram, whoever
then sends `/verify +7<phone>` — or opens the deep link `?start=verify_<phone>` —
receives the OTP **and** permanently binds *their* Telegram account to that phone
(`telegram_links` upsert on conflict `phone`).

### Impact: account takeover of any unregistered phone
An attacker who knows a victim's phone number can:
1. Open the app, type the victim's phone, trigger a pending code.
2. From the attacker's own Telegram, open the bot and receive the OTP.
3. Enter the OTP in the attacker's app session and be signed in as the victim.

The binding is permanent, so all future codes also flow to the attacker. This
also enables **pre-registration**: the first party to verify a phone owns its
account forever.

### Why cheap fixes do not work
The attacker controls **both** the browser (so they choose the victim's phone)
**and** their own Telegram account. A browser-side nonce only proves "same
browser," which the attacker's browser legitimately holds — the binding still
attaches *attacker's Telegram → victim's phone*. The hole can only be closed by
**proving, on the Telegram side, that the account owns the phone it claims.**

## Approach (Variant A)

Use Telegram's verified phone primitive: a bot can present a **"Share my phone
number"** button (`request_contact: true`). Telegram returns the account's
**verified** `phone_number` together with `user_id`. An attacker's Telegram can
only ever share the attacker's own number, so they can never trigger delivery for
a phone they do not own.

Variant A keeps the app's existing "type your phone" step and the typed OTP code.
The OTP is retained deliberately: it binds login completion back to the browser
that initiated it, preventing a login-CSRF where a victim completes an attacker's
pending login.

(Variant B — dropping the phone-entry step and correlating via a session token —
was considered and declined in favor of less code.)

## Flow

### First-time / unlinked phone
1. App: user types phone `X` → `POST /api/auth/request-code`. No `telegram_links`
   row → store `auth_codes` (`delivered=false`) → return `awaiting_link` + deep
   link `https://t.me/<bot>?start=verify` (**no phone in the link**).
2. App polls `GET /api/auth/check-status?phone=X` (unchanged) and shows the OTP
   input.
3. Telegram: user opens the bot → bot replies with a one-button reply keyboard
   `📱 Поделиться номером` (`request_contact: true`).
4. User taps → Telegram sends `message.contact` with the verified `phone_number`
   and `user_id`.
5. Webhook contact handler:
   - Reject unless `contact.user_id === message.from.id` (guards against shared
     third-party contacts).
   - Normalize `phone_number` → `+7XXXXXXXXXX`; validate against `^\+7\d{10}$`.
   - Find the newest pending row for **that verified phone**
     (`used=false, delivered=false, expires_at > now()`, order by `created_at desc`).
     - **Found** → upsert `telegram_links(phone → from.id, username)`,
       set `auth_codes.delivered=true` and `telegram_user_id=from.id`, send the
       OTP, and remove the keyboard.
     - **None** → reply: "У вас нет ожидающего входа для +7…. Запросите код в
       приложении öz для *этого* номера." (no code sent).
6. App poll sees `delivered=true` → user reads the code from Telegram → enters it
   → `POST /api/auth/verify-code` (unchanged) signs in.

### Returning / already-linked phone
`request-code` still proactively sends the code to the bound `telegram_user_id`
(`delivered=true`). Unchanged — the binding is now trustworthy because it could
only have been created via a verified contact share.

### Why this closes the ATO
The bound phone is always the **sharer's** Telegram-verified number. An
attacker's Telegram can only share the attacker's own number, so the bot will
never deliver a code for a phone the sharer does not own — neither for takeover
nor for pre-registration.

## Component changes

### `src/lib/telegram.ts`
- Extend `sendTelegramMessage(chatId, text, replyMarkup?)` with an optional
  `reply_markup` passthrough.
- Add `contactRequestKeyboard()` → a one-time reply keyboard with a single
  `request_contact: true` button (`one_time_keyboard: true`, `resize_keyboard: true`).
- Use `reply_markup: { remove_keyboard: true }` when sending the OTP so the share
  button disappears after success.

### `src/app/api/telegram/webhook/route.ts`
- Extend `TelegramMessage` with `contact?: { phone_number: string; user_id?: number }`.
- **Add** a `message.contact` handler — the only path that creates a
  `telegram_links` binding (logic per step 5 above).
- Convert `/start`, `/start verify…`, and `/verify` to simply present the
  share-contact button (via `START_REPLY` + keyboard). Update copy to instruct
  the "Share my phone number" tap.
- **Delete** the phone-typed binding paths: `/start verify_<phone>` and
  `/verify +7…` (`handleVerifyForPhone` and its routing).
- Keep `/alerts` (`handleListAlerts`) and `/start mute_` (`handleMute`) unchanged
  — they key off `telegram_user_id` / verify ownership and remain valid.
- On a verified-contact mismatch (`contact.user_id !== from.id`), log a
  `webhook_contact_mismatch` security event and reply with an error.

### `src/app/api/auth/request-code/route.ts`
- Flow B response: deep link drops the phone (`?start=verify`). No other change.
  Flow A (linked → proactive send) unchanged.

### `src/app/auth/verify/page.tsx`
- `telegramDeepLink` → `https://t.me/${botUsername}?start=verify`.
- Update `awaiting_link` copy: after Start, tap **"Поделиться номером"**; we send
  the code here.
- Remove the `/verify +7…` manual-fallback copy; the manual fallback becomes
  "open @bot and press Start."

## Migration / legacy bindings

`supabase/migrations/20260533000000_clear_legacy_telegram_links.sql`:
existing `telegram_links` rows were created under the insecure phone-typed flow
and are untrustworthy. Clear them so every user re-binds via a verified contact
share on next login:

```sql
truncate table public.telegram_links;
```

Prod currently has ~2 (test) users, so the disruption is negligible. No schema
change is required — `telegram_links` and `auth_codes` already support this flow.

Applied to the live DB via the Management API query endpoint (see the
`supabase-db-workflow` memory).

## Edge cases
- **App-typed phone ≠ Telegram verified phone** → no pending match → clear bot
  message. Correct behavior: you can only log into the number your Telegram owns.
- **`telegram_user_id` is `UNIQUE`** (one Telegram ↔ one phone). Re-binding the
  same Telegram to a *new* phone would violate the constraint. **Out of scope** —
  pre-existing behavior, relevant only when a user changes phone numbers; the
  upsert (`onConflict: phone`) is unchanged.
- **Contact share with no pending code** → informative reply, no delivery.
- **Webhook auth** (`x-telegram-bot-api-secret-token`) unchanged; all DB access
  remains via the service role.

## Testing
Webhook unit tests:
1. Own-contact happy path → binds, delivers, code sent.
2. `contact.user_id !== from.id` → rejected, no binding, security event logged.
3. Verified phone with no pending code → informative reply, no delivery.
4. Attacker's pending row for victim phone is **never** delivered when the
   attacker shares their own (different) contact.

Manual smoke test (post-deploy, real device): full first-time login via
share-contact, plus a returning-user login.

## Out of scope
- Variant B (no phone entry / session-token correlation).
- Phone-number-change re-binding against the `telegram_user_id` unique constraint.
- Migrating off in-memory IP rate limits.
