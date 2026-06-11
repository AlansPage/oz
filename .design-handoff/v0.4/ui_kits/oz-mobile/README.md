# öz — Mobile web UI kit

A click-through prototype of the öz mobile-web app, recreated from the
production codebase (`AlansPage/oz`). Same class names, same CSS variables,
same component anatomy — just stripped of the Supabase + Telegram backend.

## What's in here

| File | What it is |
| --- | --- |
| `index.html` | Entry point. Wraps the app in a mobile-web phone frame. |
| `components.css` | Mirror of the öz repo's `src/app/globals.css`. Every `oz-*` class used in production. Loads after `colors_and_type.css`. |
| `frame.css` | The black phone frame + dark stage background (kit chrome only — NOT part of the design system). |
| `oz-shared.jsx` | Demo data + primitives shared across screens: `BrandMark`, `Avatar`, `VerificationBadge`, `RateWidget`, `RateSparkline`, `ListingCard`, `Phone`, mini `RouterProvider` / `useRouter`. |
| `screens/Landing.jsx` | `/` — brand mark, tagline, Войти CTA. |
| `screens/AuthPhone.jsx` | `/auth/phone` — `+7` locked prefix, masked input. |
| `screens/AuthVerify.jsx` | `/auth/verify` — 6 OTP boxes with auto-advance + paste, cooldown timer. |
| `screens/Feed.jsx` | `/feed` — header + filter bar + rate widget + listing cards + FAB + post-listing bottom sheet. |

## How to use as a starting point for a mock

Copy `index.html` to a new file, then either:

1. **Trim to one screen.** Delete the `<Route />` switch and render just the one
   screen you want (e.g. `<FeedScreen />`). Edit demo data in `oz-shared.jsx`.
2. **Add a new screen.** Drop a new file in `screens/`, expose its component
   on `window`, add a `<script>` tag in `index.html`, and add a case to
   `<Route />`. Re-use the primitives from `oz-shared.jsx`.

## Click-through path

The prototype walks the auth → marketplace happy path:

```
Landing  →  Phone entry  →  OTP verify  →  Feed
   ↓             ↓               ↓           ↓
   Войти   any 10 digits   any 6-digit    Tap ＋ for
                          code ≠ 000000   the post sheet
```

Routes not yet built into the kit (drop into the catch-all "Скоро" screen):
`/listing/:id`, `/transaction/:id`, `/profile`, `/alerts`.
See `_source/app/app/` at the project root for the production code.

## Rules carried over from production

- **Class names are stable.** `oz-card`, `oz-fab`, `oz-vbadge--phone`,
  `oz-rate__num` — these match the production codebase, so markup is
  portable in both directions.
- **No icon set.** The kit ships with the brand `ö` mark, the hollow
  outline triangle in the rate widget, the `+` glyph on the FAB, and
  zero other icons. Don't add a Lucide import "to fill in" — the
  product genuinely doesn't use one.
- **Russian copy.** Every UI string is the Russian original from the
  codebase. If you localize a mock, swap inline; don't refactor through
  an `i18n` shim — this is a prototype.
- **Numbers are JetBrains Mono with tabular-nums** and Russian-style
  thin-space groups (`750 000 ₸`, `3,19`). Helpers live in
  `oz-shared.jsx` (`formatAmount`, `formatRate`).
