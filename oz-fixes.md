# öz: Telegram notification fix + mobile polish prompts

## Part 1. The notification bug

### Root cause: profiles.phone and telegram_links.phone use different formats

`handle_new_user` (20260517000000_init_marketplace.sql) copies `new.phone` straight out of `auth.users`:

```sql
insert into public.profiles (id, phone)
values (new.id, new.phone)
```

Supabase stores `auth.users.phone` **without** the leading `+` (e.g. `77073350741`). Your own comment in `verify-code/route.ts` documents this. But `telegram_links.phone` is written by the bot webhook **with** the `+` (`+77073350741`).

So for every user whose profile was created by the trigger (which is every normal signup, because `repairProfileIfMissing` sees the trigger-created row and returns early without fixing the format), this join in `find_transaction_event_notifications` returns nothing:

```sql
select tl.telegram_user_id into v_counterparty_tg
  from public.telegram_links tl
 where tl.phone = v_counterparty_profile.phone;  -- '+7707...' vs '7707...'
```

`v_target_tg` stays null, the function returns zero rows, the edge function dispatches zero messages and logs nothing. Silent success. The same join pattern exists in `find_alert_matches` (alerts migration, line ~136), so price alerts are broken for the same population.

### Secondary suspect: telegram_links was truncated

Migration `20260533000000_clear_legacy_telegram_links.sql` ran `truncate table public.telegram_links`. Supabase sessions persist, so anyone who logged in under the old `/verify` flow is still signed in but has **no telegram_links row at all** until they log out and re-bind via the contact-share button. If your friend hasn't re-logged-in since that migration, he has no link, regardless of phone format.

### Fix migration

```sql
-- 20260535000000_fix_profile_phone_format.sql
-- =====================================================================
-- profiles.phone was populated by handle_new_user from auth.users.phone,
-- which Supabase stores WITHOUT the leading '+'. telegram_links.phone is
-- stored WITH '+'. Every phone-equality join (transaction notifications,
-- alert matching) silently returned zero rows for trigger-created
-- profiles. Normalize existing rows and fix the trigger.
-- =====================================================================

-- 1. Normalize existing rows to E.164.
update public.profiles
   set phone = '+' || phone
 where phone is not null
   and phone not like '+%'
   -- guard: skip if a '+'-prefixed duplicate already exists (unique constraint)
   and not exists (
     select 1 from public.profiles p2 where p2.phone = '+' || profiles.phone
   );

-- 2. Fix the trigger so new users get E.164 from day one.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, phone)
  values (
    new.id,
    case
      when new.phone is null then null
      when new.phone like '+%' then new.phone
      else '+' || new.phone
    end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
```

### Make the silent failure loud

Right now "no telegram link" is indistinguishable from "nothing happened". Extend the RPC to also return rows where `telegram_user_id is null`, and have the edge function log those to `notification_log` with `status = 'failed'`, `error_detail = 'no_telegram_link'`. One log row per skipped recipient turns every future regression of this class into a queryable fact instead of a mystery.

### Diagnostic checklist (run in Supabase SQL editor, in this order)

```sql
-- 1. Format bug confirmation: any rows here = the bug is live in prod
select id, phone from public.profiles where phone not like '+%' and phone is not null;

-- 2. Does your friend have a telegram link at all? (truncate migration wiped them)
select * from public.telegram_links order by linked_at desc;

-- 3. Replay the actual transaction: does the function find recipients?
select * from public.find_transaction_event_notifications('<real-tx-uuid>', 'created');

-- 4. Did anything reach the log?
select * from public.notification_log order by created_at desc limit 20;
```

Then check infra (not visible in the repo, so verify by hand):

5. Supabase Dashboard → Database → Webhooks: two webhooks on `public.transactions` must exist (INSERT, and UPDATE on status), pointing at the `notify-transaction-event` edge function, sending header `x-transaction-event-secret`.
6. Edge function secrets: `TRANSACTION_EVENT_WEBHOOK_SECRET` and `TELEGRAM_BOT_TOKEN` must be set (`supabase secrets list`). A 401 from the function would show in its logs.
7. The friend must have pressed Start on the bot at some point and not blocked it (a 403 from Telegram would appear in `notification_log` as `failed`, so if the log is empty the failure is upstream of dispatch).

### Product-level flag: the +7 cliff

`PHONE_RE = /^\+7\d{10}$/` everywhere means a user whose **Telegram account is registered to a Korean +82 number** can never bind, and post-truncate, can never log in. Your market is Kazakhstanis in Seoul; a meaningful slice will have Telegram on a Korean SIM. Decide deliberately whether identity = Kazakh phone number is a product constraint or an accident of implementation. If it's a constraint, say so in onboarding copy before the user hits a dead-end error.

---

## Part 2. Mobile polish prompts (paste into Claude Code one at a time)

### Prompt 1: header overflow (the biggest visual offender)

> The app header in `src/app/feed/page.tsx` and `src/app/listing/[id]/page.tsx` uses `grid-cols-[1fr_auto_1fr]` with a fixed-width 360px RateWidget in the center cell plus `px-6` padding. On viewports ≤ 420px the center cell's min-content width forces horizontal overflow and crushes the brand mark and avatar. Fix it mobile-first: below 640px, restructure the header into two rows: row 1 is brand left + avatar right (flex, justify-between), row 2 is the RateWidget centered at full available width with its sparkline hidden below 480px (there's already a `@media (max-width: 479px)` block for `.oz-rate` in globals.css to extend). Also add `min-width: 0` to the grid cells on desktop and `overflow-x: clip` on body as a regression guard. Don't change the desktop layout above 640px.

### Prompt 2: touch targets and iOS input zoom

> Audit all interactive elements for the 44px minimum touch target on mobile. Specifically: `.oz-segmented__btn` (currently ~31px tall), `.oz-sortselect`, `.oz-secondary-btn-sm`, the header avatar button, and card action buttons. Below 640px increase vertical padding so every tap target hits at least 44px including padding. Then fix iOS input zoom: `.oz-input`, `.oz-textarea`, and `.oz-otp-box` are 15px, which triggers Safari's auto-zoom on focus; bump them to 16px on touch devices. Finally, remove `maximumScale: 1` from the viewport export in `src/app/layout.tsx`: it's an accessibility violation (blocks pinch zoom for low-vision users) and is no longer needed once inputs are 16px.

### Prompt 3: FAB and safe areas

> `.oz-fab` is `position: fixed; bottom: 24px` with no safe-area handling, so on iPhones it sits on the home indicator. Change to `bottom: calc(16px + env(safe-area-inset-bottom, 0px))`. Add matching bottom padding to the feed list section in `FeedClient.tsx` (currently `py-4`) so the last listing card is never hidden behind the FAB: something like `pb-[calc(88px+env(safe-area-inset-bottom))]` on mobile. Check `.oz-feed__disclaimer` clears the FAB too.

### Prompt 4: bottom sheets vs the keyboard

> The bottom sheets (`.oz-sheet`, used by PostListingSheet, ProfileGateSheet, ConfirmTransactionSheet, etc.) use `max-height: 90vh`. On mobile Safari, `vh` ignores the dynamic toolbar and the keyboard, so when an input inside PostListingSheet focuses, the field can be hidden. Switch to `max-height: 85dvh`, add `overscroll-behavior: contain`, and lock body scroll while any sheet is open (add/remove `overflow: hidden` on documentElement in a small shared hook, since these sheets are portals). Also add `scroll-padding-bottom` so focused inputs scroll into view above the keyboard.

### Prompt 5: hover states on touch devices

> All `:hover` rules in globals.css and transaction.css (`.oz-btn` variants, `.oz-card`, `.oz-rate`, `.oz-headeravatar__item`, links) fire as sticky hover on touch devices: a tapped button keeps its hover background after the finger lifts. Wrap every pure-hover affordance in `@media (hover: hover) and (pointer: fine) { ... }`. Keep all `:active` rules global since they're the touch feedback. Don't change any visual values, just the media scoping.

### Prompt 6: mobile rhythm pass on the feed

> With the structural fixes done, do a spacing/typography polish pass on mobile feed and listing detail (375px and 390px viewports). Goals: consistent 16px horizontal gutters everywhere (the filter bar uses 16px but the feed section uses px-4 which matches, verify listing detail's `--s-4` padding aligns); card internal hierarchy: the 22px mono amount should be the unambiguous focal point, so consider muting `.oz-card__rateline` and `.oz-card__equivalent` one step on mobile; verify long display names ellipsize next to the verification badge without pushing it off-card; verify the segmented control + sort select fit on 320px without wrapping (if not, let the filter bar horizontally scroll with hidden scrollbar). Take screenshots at 320/375/430 widths before and after if Playwright is available in the project (there's a rendering pipeline from the screenshot work).

---

## Part 3. Code review verdict (brief)

Not over-engineered. The security architecture (SECURITY DEFINER RPCs with revoked public execute, RLS-by-default, server-derived transaction fields, constant-time secret comparison, the contact-share binding that closed the takeover) is proportionate for a product whose whole thesis is trust between strangers moving money. Migration comments explaining *why* are genuinely good practice.

Where the real debt is:

1. **Phone format is the architectural flaw**, not any single bug: three formats live in the system (auth.users without `+`, telegram_links with `+`, profiles mixed). Canonicalize once: one `normalizePhone()` in `src/lib/phone.ts`, one documented invariant ("all app tables store E.164 with +"), and the migration above.
2. **`listUsers({ perPage: 1000 })`** in verify-code is your own flagged TODO and it's a real one: it's O(all users) per login and silently breaks past 1000. Maintain a `phone → user_id` lookup table you control, written at createUser time.
3. **Silent-skip notifications** (fixed above): any "find recipients" function should emit a trace for recipients it *couldn't* notify.
4. Minor: `to_char(amount, 'FM999G999G999D99')` makes the group separator locale-dependent inside the DB; format amounts in the edge function with `Intl.NumberFormat('ru-RU')` instead so Telegram messages match the app.
