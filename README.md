# öz

P2P маркетплейс для обмена тенге (KZT) и вон (KRW) между казахстанцами в Корее. Web-first, mobile-web-first responsive.

Phone-OTP auth is wired end to end. The marketplace schema (`profiles`, `listings`) lives in `supabase/migrations/`; UI for listings lands in the next slice.

## Stack

- Next.js 14 (App Router) · TypeScript strict
- Tailwind (design tokens mirrored as theme extensions)
- Supabase Auth via `@supabase/ssr` (modern SSR pattern)
- Inter (UI) + JetBrains Mono (numerics) via `next/font/google`

## Setup

```bash
npm install
cp .env.local.example .env.local   # then paste your anon key
npm run dev
```

`.env.local` requires:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://sdgdeuhligplyemhuirn.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from Supabase dashboard → Project Settings → API) |

### Supabase phone auth

In the Supabase dashboard:

1. **Authentication → Providers → Phone**: enable, configure an SMS provider (Twilio / MessageBird / etc.).
2. **Authentication → URL Configuration**: add your dev (`http://localhost:3000`) and prod URLs.

The app sends phone numbers in E.164 (`+7XXXXXXXXXX`).

## Database

Schema lives in `supabase/migrations/` (timestamped, append-only). Demo data lives in `supabase/seed.sql`.

### Apply migrations to the remote DB

```bash
npx supabase login                                     # one-time, interactive
npx supabase link --project-ref sdgdeuhligplyemhuirn
npx supabase db push                                   # applies pending migrations
```

CLI-free alternative: paste the migration SQL into the Supabase dashboard → SQL editor.

### Seed demo data

`supabase db push` does **not** run `seed.sql` against a remote DB. Apply it manually:

1. Open the Supabase dashboard → SQL editor
2. Paste the contents of `supabase/seed.sql`
3. Run

The seed is idempotent (`on conflict (id) do nothing`), safe to re-run.

### Regenerate TypeScript types

```bash
npm run types        # writes src/lib/supabase/database.types.ts
```

### Verify in the dashboard

After applying the migration + seed:

- Table editor shows `profiles` (4 rows) and `listings` (8 rows)
- Both tables show the RLS lock icon
- As anon role in SQL editor: `insert into public.listings (...) values (...)` → fails
- As authenticated role: `select * from public.listings` returns the 8 active rows

### What's enforced at the DB layer

- `profiles.id` cascades from `auth.users(id)`; a trigger (`on_auth_user_created`) auto-creates a profile on signup
- `listings.user_id` and `listings.created_at` are immutable after insert (BEFORE UPDATE trigger)
- `listings.amount_currency` must match the "from" side of `direction` (check constraint)
- `listings.note` ≤ 280 chars
- RLS: anyone authenticated can read profiles and active listings; users can only insert/update their own listings; no deletes (use `status = 'withdrawn'`)

## Routes

| Path | Description |
| --- | --- |
| `/` | Landing — öz mark, tagline, "Войти" CTA |
| `/auth/phone` | Phone input. `+7` prefix locked, `(XXX) XXX-XX-XX` mask, sends OTP |
| `/auth/verify` | 6-digit OTP input with auto-advance + paste, verifies and redirects to `/feed` |
| `/feed` | Protected. Server-side session check, greeting + logout |

Auth state is shared via a `SupabaseProvider` client component at the root layout. Server-side session checks (e.g. `/feed`) use `@supabase/ssr`'s `createServerClient`. Cookie refresh happens in `src/middleware.ts`.

## Design system

The full system lives in `oz_design_system.html` at the repo root — open it in a browser to browse components. Light-mode tokens are mirrored into:

- `src/app/globals.css` — CSS custom properties (`--bg`, `--primary`, radius/spacing rungs, shadows)
- `tailwind.config.ts` — semantic Tailwind aliases (`bg-bg`, `text-text-2`, `rounded-md`, etc.)

Key constraints:

- Backgrounds use `--bg` (`#F5F0E8` warm off-white), never pure white.
- `--primary` (`#1A7A4A`) is reserved for trust/confirmation actions (the OTP send / verify CTAs). No decorative green.
- Numeric content (phone, OTP digits, eventual amounts) renders in JetBrains Mono.

## Scripts

```bash
npm run dev          # next dev
npm run build        # next build
npm run typecheck    # tsc --noEmit
npm run lint         # next lint
npm run types        # supabase gen types typescript → src/lib/supabase/database.types.ts
npm run gen:types    # alias of `types` (same output)
```

## Deploying to Vercel

1. Import the repo in Vercel.
2. Set the two `NEXT_PUBLIC_SUPABASE_*` env vars in Project Settings → Environment Variables.
3. Add the Vercel preview/production URLs to Supabase URL Configuration so OTP redirects validate.

No `vercel.json` is needed — Vercel auto-detects Next.js 14.
