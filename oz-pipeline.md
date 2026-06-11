# öz: full fix + trust-rails pipeline

Execution order matters. Phases 0–2 fix what's broken (notifications, mobile). Phases 3–6 add the trust rails. Each step is either a **[SQL]** block to run in the Supabase SQL editor, a **[CLI]** command, a **[Dashboard]** manual check, or a **[Claude Code]** prompt to paste verbatim. Steps inside a phase are sequential; don't parallelize within a phase. Commit after every green verification step so each change is independently revertable.

---

## Phase 0 — Diagnose before touching anything (~15 min)

Establish which links in the notification chain are actually broken in prod, so you can verify the fix against a known-bad baseline.

### 0.1 [SQL] Confirm the phone-format bug is live

```sql
select id, phone from public.profiles
 where phone is not null and phone not like '+%';
```

Any rows returned = the format bug affects prod. Note the count.

### 0.2 [SQL] Check whether your friend has a Telegram link at all

```sql
select * from public.telegram_links order by linked_at desc;
```

The 20260533 migration truncated this table. If your friend logged in before the contact-share flow and never re-logged-in, he has no row here and cannot receive anything regardless of the format fix.

### 0.3 [SQL] Replay the real failed transaction

```sql
select * from public.find_transaction_event_notifications(
  '<the-actual-transaction-uuid>', 'created'
);
```

Zero rows = recipient resolution is the failure point (expected). One row = resolution works and the failure is downstream (webhook/edge/Telegram).

### 0.4 [SQL] Check the notification log

```sql
select * from public.notification_log order by created_at desc limit 20;
```

Empty for the transaction's timeframe = nothing was even attempted (upstream failure). `failed` rows = read `error_detail`.

### 0.5 [Dashboard] Verify webhook wiring

Supabase Dashboard → Database → Webhooks. Two webhooks on `public.transactions` must exist:
- INSERT → `notify-transaction-event` edge function
- UPDATE → same function
- Both sending header `x-transaction-event-secret: <secret>`

If missing, create them now. This is dashboard config, not in migrations, so it silently doesn't exist in any environment where you didn't click it.

### 0.6 [CLI] Verify edge function secrets

```bash
supabase secrets list
```

Must include `TRANSACTION_EVENT_WEBHOOK_SECRET` and `TELEGRAM_BOT_TOKEN`. Then check the function's logs (Dashboard → Edge Functions → notify-transaction-event → Logs) for 401s or `rpc_error` entries around your test transaction's timestamp.

**Exit criteria:** you can name the exact broken link(s). Almost certainly 0.1 and possibly 0.2.

---

## Phase 1 — Fix notifications (~1–2 hrs)

### 1.1 [Claude Code] The phone canonicalization migration

> Create a new Supabase migration `20260535000000_fix_profile_phone_format.sql`. Context: `handle_new_user` (in 20260517000000_init_marketplace.sql) copies `new.phone` from auth.users, which Supabase stores WITHOUT the leading '+' (e.g. '77073350741'), while telegram_links.phone is stored WITH '+'. Every join on `telegram_links.phone = profiles.phone` (in find_transaction_event_notifications and find_alert_matches) silently returns zero rows for trigger-created profiles. The migration must: (1) update existing profiles rows to add the '+' prefix where missing, guarded against the unique constraint by skipping any row whose '+'-prefixed twin already exists; (2) CREATE OR REPLACE handle_new_user so it inserts the phone as E.164 ('+' || new.phone when new.phone doesn't already start with '+', null stays null), keeping security definer and the existing search_path setting. Add a header comment block in the same style as the other migrations explaining the root cause.

### 1.2 [Claude Code] Make silent skips loud

> Modify `find_transaction_event_notifications` (latest definition is in 20260530000000_notification_gap_mid_flow.sql) via a new migration: when a target recipient is resolved but has no telegram_links row, return the row anyway with telegram_user_id as NULL instead of returning nothing. Then update `supabase/functions/notify-transaction-event/index.ts`: for rows where telegram_user_id is null, skip the Telegram send and insert a notification_log row with status 'failed' and error_detail 'no_telegram_link'. Keep the function's always-200 contract. This turns the silent-skip failure mode into a queryable fact.

### 1.3 [Claude Code] Single source of truth for phone format

> In `src/lib/phone.ts`, add a `canonicalPhone(raw: string | null | undefined): string | null` function that returns E.164 with '+' (strips non-digits, re-adds '+'), document the invariant at the top of the file: "all app-owned tables (profiles, telegram_links, auth_codes) store E.164 WITH the '+' prefix; only auth.users stores it without." Then grep the codebase for every place a phone is written to or compared against a table (telegram webhook route, verify-code, request-code, repairProfileIfMissing) and route them through this function. Don't change auth.users handling.

### 1.4 [CLI] Deploy

```bash
supabase db push
supabase functions deploy notify-transaction-event
```

### 1.5 Verify end-to-end

- Re-run query 0.1: must return zero rows.
- Have your friend log out, log back in via the contact-share flow (this recreates his telegram_links row post-truncate).
- Tap Связаться → Начать сделку on his listing from your account.
- He receives the Telegram message within seconds; `notification_log` shows a `sent` row.
- Also create a test price alert and post a matching listing: alerts use the same join and should now fire too.

### 1.6 [Claude Code] The +82 cliff (decide, then implement)

Decision first: is "identity = Kazakh +7 number on Telegram" a product constraint or an accident? If constraint, ship copy. If accident, that's a bigger auth redesign for later. For now, ship the copy:

> On the phone-entry screen (`src/app/auth/phone/page.tsx`) and in the bot's unsupported-number reply in `src/app/api/telegram/webhook/route.ts`, add clear Russian copy explaining that login requires a Telegram account registered to a Kazakhstani +7 number, shown BEFORE the user hits the dead-end. Keep it to one sentence, matter-of-fact, no apology.

---

## Phase 2 — Mobile polish (~1 day)

Run prompts in this order; 2.1 is the dominant visual offender, the rest are independent.

### 2.1 [Claude Code] Header overflow

> The app header in `src/app/feed/page.tsx` and `src/app/listing/[id]/page.tsx` uses `grid-cols-[1fr_auto_1fr]` with a fixed-width 360px RateWidget in the center cell plus `px-6` padding. On viewports ≤ 420px the center cell's min-content width forces horizontal overflow and crushes the brand mark and avatar. Fix mobile-first: below 640px, restructure into two rows: row 1 brand left + avatar right (flex, justify-between), row 2 the RateWidget centered at full available width with the sparkline hidden below 480px (extend the existing `@media (max-width: 479px)` block for `.oz-rate` in globals.css). Add `min-width: 0` to grid cells on desktop and `overflow-x: clip` on body as a regression guard. Desktop layout above 640px unchanged.

### 2.2 [Claude Code] Touch targets + iOS zoom

> Audit interactive elements for the 44px minimum touch target on mobile: `.oz-segmented__btn` (~31px now), `.oz-sortselect`, `.oz-secondary-btn-sm`, header avatar button, card action buttons. Below 640px, increase vertical padding so every target reaches 44px. Then fix iOS input zoom: `.oz-input`, `.oz-textarea`, `.oz-otp-box` are 15px which triggers Safari auto-zoom on focus; make them 16px on touch devices. Remove `maximumScale: 1` from the viewport export in `src/app/layout.tsx` (accessibility violation, unnecessary once inputs are 16px).

### 2.3 [Claude Code] FAB + safe areas

> `.oz-fab` is `position: fixed; bottom: 24px` with no safe-area handling, so it sits on the iPhone home indicator. Change to `bottom: calc(16px + env(safe-area-inset-bottom, 0px))`. Add bottom padding to the feed list section in `FeedClient.tsx` (currently `py-4`) so the last card is never hidden behind the FAB: `pb-[calc(88px+env(safe-area-inset-bottom))]` on mobile. Verify `.oz-feed__disclaimer` clears the FAB.

### 2.4 [Claude Code] Sheets vs the keyboard

> Bottom sheets (`.oz-sheet`: PostListingSheet, ProfileGateSheet, ConfirmTransactionSheet, etc.) use `max-height: 90vh`; on mobile Safari vh ignores the dynamic toolbar and keyboard so focused inputs can be hidden. Switch to `max-height: 85dvh`, add `overscroll-behavior: contain`, and lock body scroll while any sheet is open via a small shared hook (these are portals, so toggle `overflow: hidden` on documentElement). Add `scroll-padding-bottom` so focused inputs scroll above the keyboard.

### 2.5 [Claude Code] Hover scoping

> All `:hover` rules in globals.css and transaction.css (`.oz-btn` variants, `.oz-card`, `.oz-rate`, `.oz-headeravatar__item`, links) cause sticky hover on touch. Wrap every pure-hover affordance in `@media (hover: hover) and (pointer: fine) { ... }`. Keep all `:active` rules global (they're the touch feedback). No visual value changes, only media scoping.

### 2.6 [Claude Code + Design] Rhythm pass

> With structure fixed, do a spacing/typography polish pass on mobile feed and listing detail at 320/375/390/430px. Goals: consistent 16px gutters everywhere; the 22px mono amount as the unambiguous focal point of each card (consider muting `.oz-card__rateline` and `.oz-card__equivalent` one step on mobile); long display names ellipsize cleanly next to the verification badge; segmented control + sort select fit at 320px without wrapping (if not, horizontal-scroll the filter bar with hidden scrollbar). Use the existing Playwright pipeline to capture before/after screenshots at each width.

### 2.7 Verify

Real devices, not just devtools: your phone and one other. Walk feed → listing → confirm sheet → transaction flow. No horizontal scroll anywhere, no input hidden by keyboard, FAB clear of the home indicator.

---

## Phase 3 — Payout details: structure over free text (~1–2 days)

The highest-stakes input in the product gets rails first. No banking API needed; everything here is structural validation.

### 3.1 [Claude Code] Bank picker

> Replace the free-text bank name field in `src/components/profile/PaymentMethodForm.tsx` with a structured picker. Two currency-scoped lists: KZT side: Kaspi Gold, Halyk, Forte, Jusan, BCC, Freedom; KRW side: Toss, KakaoBank, KB Kookmin, Shinhan, Woori, Hana, NH Nonghyup, IBK. Store a stable bank code (e.g. 'kaspi', 'kakaobank') in a new `bank_code` column on payment_methods (migration included, backfill existing rows by fuzzy-matching the old free-text bank name where possible, else null). Render the picker as a sheet-based list with the bank name; keep an 'Другой банк' escape hatch that falls back to a text input so nobody is blocked. Show the structured bank name everywhere payment details render (SendScreen reveal, profile).

### 3.2 [Claude Code] Format validation per rail

> Add client-side structural validation to the account/card number field in PaymentMethodForm, keyed off the selected bank_code and currency. KZT: 16-digit card numbers must pass Luhn (implement the standard check); KZ IBANs (KZ + 18 alphanumerics) must pass the ISO 7064 mod-97 check. KRW: validate per-bank account number length/shape (KakaoBank 13 digits starting 3333, Toss 12–14, traditional banks 10–14 digits, hyphens stripped before validation). Show inline errors in the existing `.oz-input.is-error` style with specific Russian copy ('Номер карты не проходит проверку. Проверьте цифры.'). Mirror the same checks server-side in the payment_methods insert path so the client can't be bypassed: add a CHECK-friendly validation in a SECURITY DEFINER `upsert_payment_method` RPC and revoke direct INSERT/UPDATE on payment_methods, following the same pattern as create_transaction in 20260534000000.

### 3.3 [Claude Code] Recipient name field with display discipline

> Add a `recipient_name` column to payment_methods (the name as registered at the bank, e.g. 'Алан А.' / '김유진'). Require it in the form with helper copy explaining the sender's bank will display this name on transfer. On the SendScreen reveal, render recipient_name as the most prominent element of the payment block, above bank and number, since it's what the sender will verify against their banking app's confirmation screen.

### 3.4 Verify

Try to save garbage in every field (wrong Luhn digit, 9-digit Kakao account, empty name) on both client and via direct RPC call with the anon key. All paths rejected. Existing payment methods still render.

---

## Phase 4 — The name-match checkpoint (~1 day)

Both banking systems already verify recipient names on their transfer screens (Kaspi shows the registered name when transferring by phone/card; Korean banks show 수취인 조회). Capture that free verification.

### 4.1 [Claude Code] SendScreen confirmation step

> Redesign the confirmation moment in `src/app/transaction/[id]/screens/SendScreen.tsx`. After the payment details reveal and before the user can mark the transfer as sent (the existing press-and-hold / slide affordance), insert an explicit name-check step: 'В приложении банка перед отправкой вы увидите имя получателя. Оно совпадает с: **{recipient_name}**?' with two actions: 'Да, совпадает' (proceeds to the existing confirm affordance) and 'Имя не совпадает' (opens a mismatch path). The mismatch path: freeze the action area, show calm copy telling the user NOT to send, and fire a new security_event type 'recipient_name_mismatch' (add it to the security_events check constraint via migration) with the transaction id in detail. Also surface a banner on the transaction for the counterparty. Keep the visual language of the existing tx-* layer.

### 4.2 [Claude Code] Mismatch handling for the counterparty

> When a 'recipient_name_mismatch' security_event exists for a transaction, the counterparty's transaction view should show a warning state prompting them to check their payment details, with a one-tap path to edit the payment method and a way to signal 'исправлено' which clears the freeze for the sender. Extend the transaction notification function to send both parties a Telegram message on mismatch (reuse the 'disputed' message plumbing pattern from find_transaction_event_notifications).

### 4.3 Verify

Run a full test deal with a deliberately wrong recipient_name; confirm the freeze, the security_event row, both Telegram messages, and the recovery path.

---

## Phase 5 — Trust ladder + limits (~2 days)

Your schema already has verification tiers; make them real and time-based.

### 5.1 [Claude Code] Activate verified_trader

> Implement automatic tier progression in a migration. profiles.verification_tier currently sits at 'phone' for everyone. Add a SECURITY DEFINER function `recompute_verification_tier(p_user_id uuid)` that promotes to 'verified_trader' when: ≥5 completed transactions AND ≥3 distinct counterparties AND account age ≥14 days AND no open disputes. Call it from the existing transaction completion path (advance_transaction or a trigger on transactions status → completed). The existing VerificationBadge component already renders the tier with the gold shimmer; verify the listing card and listing hero show it.

### 5.2 [Claude Code] Show deal counts, not just stars

> Ratings averages are gameable; counts are harder to inflate. Everywhere reputation renders (`.oz-card__rating`, listing hero rating, AboutUser), change the format from '★ 4.8 · 12' to '★ 4.8 · 12 сделок' using proper Russian pluralization (сделка/сделки/сделок), and for users with zero completed deals show 'Новый · 0 сделок' so newness is explicit rather than ambiguous.

### 5.3 [Claude Code] First-deal caps

> Add risk limits inside create_transaction (new migration replacing the function): if the initiator OR the listing owner has fewer than 3 completed transactions, cap the transaction amount at the equivalent of 500,000 KZT (use the listing's locked rate to evaluate KRW listings). If the relevant party's default payment method in the transaction currency was created less than 24 hours ago, reject with a new exception code 'payment_method_too_new'. Map both new error codes to Russian copy in ConfirmTransactionSheet's createErrorMessage ('Для новых участников лимит первой сделки — 500 000 ₸' / 'Реквизиты были изменены недавно. Сделки возможны через 24 часа после изменения.'). Surface the cap proactively in the UI: when a capped user views a listing above their limit, show the limit on the Начать сделку button state instead of letting them hit the error.

### 5.4 [Claude Code] Payout-change freeze + alert

> Account-takeover defense: when a payment_method is created or its number/recipient_name changes, (1) send the owner a Telegram notification immediately ('öz: ваши реквизиты изменены. Если это были не вы — ответьте на это сообщение.') via the existing notification infrastructure, and (2) the 24h freeze from 5.3 makes the change unusable for new deals during the window. Implement the notification with the same database-webhook → edge-function pattern as transactions (webhook on payment_methods INSERT/UPDATE), reusing notify-transaction-event or a sibling function, whichever is cleaner.

### 5.5 Verify

New test account: confirm cap applies, tier stays 'phone', payment-method change triggers the Telegram alert and the 24h block, and that a 5-deal/3-counterparty account flips to verified_trader.

---

## Phase 6 — Admin signal: duplicate-rail detection (~half day)

The synthetic-identity signature: one bank rail across many profiles.

### 6.1 [Claude Code] Duplicate detection query + admin surface

> Add to the existing admin stats route (`src/app/api/admin/stats/route.ts`) a 'duplicate_rails' section: account/card numbers (normalized: digits only) appearing on payment_methods rows belonging to more than one user_id, returning the number, the bank_code, and the list of user ids with display names. Also add a nightly-runnable SQL view for the same. No automated enforcement yet; this is an admin tripwire. Protect the route with the existing admin auth pattern.

### 6.2 [SQL] Baseline check

Run the view once on prod data. Expect zero rows today; any hit is worth a personal look.

---

## Deliberately NOT in this pipeline

- **Document/ID verification (KYC-proper):** wrong friction at this scale. The Kakao community vouch is a stronger and cheaper trust source; consider invite codes from power users as the next trust feature instead.
- **Escrow / holding funds:** changes your regulatory position entirely. The disclaimer ('платформа не участвует в передаче средств') is currently true; keep it true.
- **Korean +82 auth support:** real issue (flagged in 1.6) but an auth redesign, not a patch. Decide after watching how many users actually hit the cliff (the security_events / bot logs will tell you).

## Suggested commit cadence

One commit per numbered step, message format `fix(notifications): canonicalize profiles.phone to E.164` etc. Tag the repo before Phase 3 (`v0.4-stable`) since Phases 3–5 touch the money path and you want a clean rollback point.
