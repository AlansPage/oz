# öz — Design System

> P2P маркетплейс для обмена тенге (₸) и вон (₩) между казахстанцами в Корее.
> A peer-to-peer marketplace where Kazakhstanis living in Korea exchange
> KZT ↔ KRW directly with each other, bank-to-bank. Mobile-web-first, Russian UI.

This folder is the design system for **öz**. It is the source of truth for
colors, type, spacing, components, copy tone, and iconography for any new
surface — production, prototype, slide, or static mock — that needs to feel
like öz.

---

## What öz actually is

öz is **not an exchange and not a wallet.** The platform never holds funds.
Two users post listings ("I want to swap ₸ for ₩ at this rate"), match in
the feed, transfer money directly through their own bank apps (Kaspi,
KakaoBank, etc.), and upload **screenshots of the bank receipt** as
evidence. The counterparty visually verifies the receipt against their own
bank app, then confirms — and the second leg happens the same way.

> "The platform takes custody of receipt screenshots, not funds."
> — `docs/decisions/receipt-as-evidence.md`

The product has a calm, **status-indicator** energy on purpose. Money is a
serious context. The UI should feel patient and competent. No urgency, no
playfulness, no celebratory dopamine — green is reserved for the moments
where trust is actually being conferred (send the code, verify the code,
confirm the receipt).

### Surface area

A single product. One mobile-first web app, with these top-level routes:

| Route | What it is |
| --- | --- |
| `/` | Landing — ö mark, tagline, "Войти" CTA |
| `/auth/phone` | Phone-number entry, `+7` locked, masked input |
| `/auth/verify` | OTP screen — code arrives via Telegram bot, not SMS |
| `/feed` | The marketplace feed. Listings + rate widget + post FAB |
| `/listing/[id]` | Listing detail / edit / open-transaction |
| `/transaction/[id]` | Active deal: status banner, receipts, chat, rating |
| `/alerts` | Rate alerts subscribed to via Telegram bot |
| `/profile` | Display name, avatar, verification, logout |
| `/terms`, `/privacy` | Legal |

---

## Sources

This design system was reverse-engineered from the production codebase and
a redesign spec. The reader is encouraged to explore further:

- **Codebase** (full app, Next.js 14 + Supabase + Tailwind):
  <https://github.com/AlansPage/oz>
  Key files for design context:
  - `src/app/globals.css` — every CSS variable + every component class
  - `tailwind.config.ts` — the same tokens exposed as Tailwind aliases
  - `oz_design_system.html` — a single-file living styleguide at repo root
  - `src/components/RateWidget.tsx`, `src/components/feed/ListingCard.tsx`
  - `docs/decisions/receipt-as-evidence.md` — the trust-mechanic ADR

- **Rate widget v2 spec** (the calm redesign of the top-of-feed widget):
  `rate-widget-v2/SPEC.md` (mounted folder)
  Copied into this DS as `assets/rate-widget-rest.png` and `.svg`.

- **Component scaffolds extracted into this DS:** `_source/` mirrors the
  relevant slices of `src/app` and `src/components` for offline reference.
  Production lives in the GitHub repo; `_source/` is a frozen snapshot.

---

## Index

```
README.md                  ← you are here
SKILL.md                   ← cross-compatible with Agent Skills
colors_and_type.css        ← all CSS variables + type recipes
assets/
  oz-icon.svg              ← the ö app icon (#1A7A4A square + lowercase ö)
  rate-widget-rest.png     ← reference image of the v2 rate widget
  rate-widget-rest.svg
preview/                   ← Design-System-tab cards (≈700×N each)
  type-*.html
  color-*.html
  spacing-*.html
  components-*.html
  brand-*.html
ui_kits/
  oz-mobile/
    README.md
    index.html             ← clickable prototype
    *.jsx                  ← React components
_source/                   ← frozen snapshot of relevant repo files
```

---

## CONTENT FUNDAMENTALS

**Language.** UI is in **Russian**. This is the product language. Russian
typographic norms apply: a comma is the decimal separator (`3,19`, not
`3.19`), thin spaces appear as digit-group separators in long amounts
(`750 000 ₸`), quotation marks default to «ёлочки» when used in long-form
copy. The design system documentation (this file) is in English; product
strings in components stay Russian.

**Tone.** Calm. Competent. A little dry. Never effusive. The product is
moving money between strangers — copy should sound like a steady operator,
not a hype man. No exclamation marks in the UI. No emoji. No
celebratory micro-copy ("Done!" "Yay!"). Confirmation is a quiet, complete
sentence.

**Person.** Mostly **"вы"** (formal you) implicit in the verb form, not
explicit. The user is doing actions; the system describes their state in
present-continuous or perfective past. Examples from the codebase:

- `Вы отправляете первым` — "You are the one who sends first." (status)
- `Контрагент подтвердил получение` — "The counterparty confirmed
  receipt." (status)
- `Чек отправлен` — "Receipt sent." (status — no subject; result-state)
- `Ожидаем отправки от контрагента` — "We are waiting for the
  counterparty's send." (system speaking as 'we', sparingly)
- `Сделка завершена` — "Deal completed." (terse, perfective)

**Casing.** Russian sentence case throughout. **No All Caps** except the
single eyebrow label on the listing-detail "About" section (`О ПОЛЬЗОВАТЕЛЕ`).
Never SHOUTING for emphasis.

**Casing for buttons.** Russian sentence case. Buttons are **verbs in the
imperative**, single-word where possible: `Войти`, `Отправить`,
`Подтвердить`, `Опубликовать`, `Связаться`, `Выйти`. Past-tense
declarations for already-done actions: `Чек отправлен`.

**Helper text.** Short, factual, low-stakes. Examples:
- `Оставьте пустым для рыночного курса` ("Leave empty for market rate")
- `Сообщество казахстанцев в Корее` ("Community of Kazakhstanis in Korea")
- `öz — сообщество для прямого обмена. Платформа не участвует в передаче
  средств.` ("öz is a community for direct exchange. The platform does
  not participate in fund transfers.") — this disclaimer footer at
  `/feed` is the single most important sentence of copy in the product.

**Errors.** Specific, blame-free, never code-y:
- `Неверный или истёкший код.` ("Invalid or expired code.")
- `Не удалось загрузить фото. Попробуйте ещё раз.` ("Couldn't upload
  photo. Try again.")
- `Курс временно недоступен` ("Rate temporarily unavailable") — appears
  below the rate widget when fetch fails.

**Loading states use the present continuous gerund-ish form** with a
trailing ellipsis: `Загружаем…`, `Проверяем…`, `Публикация…`, `Выходим…`,
`Отправляем…`. Always the ellipsis character `…`, not three dots.

**Numerics.** Currency symbols `₸` and `₩` always precede or follow the
number per the design context they appear in:
- Currency symbol on its own as a glyph in the rate widget: `₸ ▷ ₩ 3,19`
- Trailing the number in amount fields: `750 000 ₸`
- The direction indicator between two currencies is `→` (en-arrow), not
  `↔`. Direction is always specified: `₸ → ₩` or `₩ → ₸`.

**Empty + new user copy.** Treats the user as competent. The new-user
rating is the literal word `Новый` ("New") — not "0 reviews," not "★ —".

---

## VISUAL FOUNDATIONS

### The single most important rule

> **The canvas is `#F5F0E8`. Never pure white.**

Every öz screen sits on a warm off-white. White (`#FFFFFF`) only appears
as a surface *on top of* the canvas — cards, inputs, sheets — and it
reads as "elevated." If you find yourself reaching for `#FFFFFF` as a
page background, stop. You're outside the system.

### Color

**Three layers of warmth.** The canvas (`--bg #F5F0E8`), an in-between
surface (`--surface-2 #FAF6EE`, used for the note callout inside cards
and for hover/sunken states that should still feel warm), and elevated
white (`--surface #FFFFFF`) for the primary surface. A fourth, darker
warm tone (`--surface-sunken #EDE6D8`) sits *below* the canvas — it's
the track of the segmented control and the fill of skeletons.

**Green is special.** `--primary #1A7A4A` is the only chromatic color
that appears at full saturation in the UI. It earns its place by
appearing only at moments of trust: primary CTAs (send code, verify,
publish, confirm receipt), the OTP focus ring, the success states, the
FAB (which posts a listing — an act of commitment), and the icon mark.
It also appears at **8% opacity** as the tinted rate-widget surface,
and at **soft-tint** (`--primary-soft #E3F1E8`) as the background of
the phone-verified badge, the own-message chat bubble, and focus rings.
There is **no decorative green** anywhere in the product. If green
appears in a place that is not about confirming something, it's a bug.

**Status colors are warm.** Warning (`#B45309`), error (`#B42318`),
gold (`#B98A3A`). All three are warmer than typical UI palettes —
they sit comfortably on the beige canvas. Cool blue (`#0B5FB8`) exists
as `--info` but is rarely used; this product does not "inform" — it
states.

### Type

**Two families, no exceptions.**
- **Inter** for all UI text — labels, headings, body, helper, button labels.
- **JetBrains Mono** for everything numeric — rates, amounts, phone
  numbers, OTP digits, the verify-command literal, timestamps in chat,
  the `+7 (XXX)` mask, even the `3,19` in the rate widget. Always with
  `font-variant-numeric: tabular-nums` for column alignment.

Weight scale is tight: 400 (body), 500 (labels), 600 (emphasis, button
labels, headings), 700 (display + brand mark). No 300, no 800. No
italic except the one note-callout inside listing detail.

The numeric scale tops out at **36px** (`.oz-num-xl`, used for the
listing-hero amount and the rate-widget number). Never bigger. This
product does not have a number that earns "hero-sized" treatment.

### Spacing

4px base. The scale is named: `--s-1 4px` through `--s-16 64px`. In
practice you'll mostly use `--s-2`, `--s-3`, `--s-4`, `--s-5`.
Card padding is `--s-4 16px`; the listing-hero card stretches to
`--s-5 20px`. The bottom sheet sits at `24px 20px`. There is no `2px`
or `6px` token — half-step values appear inline only when avatars need
visual centering.

### Radii

`--r-sm 8px` for chips and menu rows, `--r-md 12px` for inputs and
buttons, `--r-lg 16px` for cards, `--r-xl 24px` for sheets-on-mobile
and the rate widget, `--r-full 9999px` for pills, segmented controls,
avatars. The rate widget intentionally goes one step bigger than cards
(24 vs 16) — that 8px difference is what makes it read as "status
ambient" instead of "another card." When in doubt, **never** invent a
new radius.

### Backgrounds

No images. No patterns. No gradients on the canvas. The single use of
gradient in the entire product is a **soft horizontal fade-out** on the
left edge of the sparkline so the line "emerges" rather than starting
abruptly. That's it. Everything else is flat color on flat color.

A faint dot-grid token exists (`--bg-grid: rgba(17,24,39,0.04)`) but is
unused in the current product. If you reach for it, it's because you're
building a non-product surface (a marketing slide, a print) — that's
fine, just keep it whisper-quiet.

### Borders

Hairline 1px in `--border #E5DDCB` on the canvas; bump to
`--border-strong #D5C9AF` for inputs and outline buttons. Borders are
warm-beige, never grey. Focus state is a 3px ring of `--primary-soft`
under the border-color change to primary — exactly the
`box-shadow: 0 0 0 3px var(--primary-soft)` recipe.

### Shadows

**Two shadow recipes, both warm.** `--shadow-card` for resting cards,
`--shadow-pop` for sheets and menus. The y-offsets are gentle (1–4px
tight + 8–24px wide); the color is `rgba(60, 40, 10, ...)` — a brown
shadow tone that reads as warm against the beige canvas. Cool/grey
shadows would betray the warmth. The verified-trader badge has its own
shimmer animation but no extra shadow.

### Animation

**Patient, never bouncy.** The whole product uses ~150–200ms ease-out
transitions on color/border changes, and a single longer 800ms ease-out
for the sparkline draw-in on mount. Specific motion vocabulary:

- **Tap response on buttons:** `transform: translateY(1px)` for 50ms.
  That subtle push-down — no scale, no ripple, no overshoot.
- **Card press:** identical 1px push.
- **Hover on the rate widget:** `transform: scale(1.01)`. One percent.
  Imperceptible until you compare. Read-only widget — minimal affordance.
- **Sheet entry on mobile:** slide up from bottom with a
  `cubic-bezier(0.2, 0.8, 0.2, 1)` over 200ms. Scrim fades in over 150ms.
- **Sheet entry on desktop (≥1024px):** fade + translate-from -45%, 150ms.
- **Rate-change pulse:** the number scales 1 → 1.08 → 1 over 600ms,
  ease-in-out, **only when the value actually changed.** No idle pulses.
- **Sparkline draw:** `stroke-dasharray` from 1 to 0 over 800ms ease-out
  on mount. The open-circle marker fades in at the 800ms mark over an
  additional 300ms. On rate update the path morphs (`transition: d`)
  over 400ms.
- **Verification-badge shimmer:** the ID and trader badges have a
  `linear-gradient` shimmer sliding across at 1.6s ease-in-out infinite.
  The plain phone badge does NOT shimmer — only the higher tiers do.
- **Skeleton:** 1.2s ease-in-out pulse of opacity 0.6 → 0.3 → 0.6.
- All motion respects `prefers-reduced-motion: reduce`.

There are no bounces, no spring physics, no celebratory transitions,
no confetti.

### Hover and press states

- **Primary button hover:** swap `--primary` → `--primary-hover`
  (darker green). No scale.
- **Secondary / ghost button hover:** background fills with
  `--surface-2`. No border-color change.
- **Card hover:** no change. (Cards are tappable rows, not buttons.)
- **Card press / button press:** the 1px translateY described above.
- **Soft-button hover:** `var(--primary-soft)` → a slightly darker
  `#d6ead9` (literal hex; not a token because it exists once).
- **Disabled primary button:** background becomes `--surface-sunken`,
  text becomes `--text-mute`, cursor `not-allowed`. No opacity hack.

### Transparency and blur

One place: the filter bar at the top of `/feed`. It sticks
(`position: sticky; top: 0`), the background drops to
`rgba(245, 240, 232, 0.85)` (the canvas at 85%), and a
`backdrop-filter: blur(8px) saturate(140%)` lets the feed scroll
through underneath. Nowhere else does the product use blur or
translucency. Sheets sit on a solid scrim (`rgba(17, 24, 39, 0.45)`),
not a blur.

### Layout

Mobile-first. Page widths cap at **480px** for auth/profile/alerts and
**560px** for the listing detail. The feed widens to 960px on desktop
with a 2-column listing grid. Almost every screen is centered in a
fixed-width container with `padding: 24px 20px` (or `var(--s-6) var(--s-5)`).
There are no full-bleed sections, no sticky footers, no fixed nav bars.
The only fixed element in the entire product is the **FAB** —
56×56 circle, primary green, bottom-right at 24px inset, with its own
soft green shadow `0 6px 16px rgba(26, 122, 74, 0.30)` (the one place
shadow color is green instead of brown — the FAB casts its own light).

### Cards

White surface, `--r-lg 16px` radius, `var(--shadow-card)` shadow, 16px
internal padding. No border, no left-accent-strip pattern, no rounded
corners with a colored bar — that's not the öz vocabulary. The card has
a top row (avatar + name + verification badge), an amount block, and a
bottom row (timestamp + action button). The own-listing variant shows
two outline secondary buttons; the not-own variant shows one soft
green "Связаться" button.

The listing-hero card on `/listing/[id]` is the same recipe but with
20px padding and a 36px monospace amount.

### Form inputs

Single recipe: `.oz-input`. 13×14px padding, 1px solid border-strong,
12px radius, 15px Inter, white surface. Focus: border → primary, 3px
soft-green ring. Error: border → error, 3px soft-error ring on focus.
The OTP boxes are a separate 44×52px taller variant.

### Avatars

Circular. Four sizes: xs 20px, sm 28px, lg 48px, xl 96px. Initials are
the first matched alpha-or-digit character from the display name, then
from the phone if no name — uppercased. Background `--surface-sunken`,
text `--text-2`, 600 weight Inter.

### Badges (verification)

Pills, `--r-full`. Three tiers, with deliberate visual weight increase:
1. **phone (`тел.`)** — `--primary-soft` bg, `--primary` text, no animation.
2. **phone_id (`ID`)** — solid `--primary` bg, `--bg` text, *shimmer*.
3. **verified_trader (`трейдер`)** — solid `--gold` bg, `--bg` text, *shimmer*.

The shimmer is what tells you a tier is "alive" / earned. Phone verification
is the floor, so it doesn't shimmer.

### Iconography

See **ICONOGRAPHY** below.

---

## ICONOGRAPHY

öz uses **almost no icons.** This is intentional. The product is type-led —
it solves trust by being precisely worded and predictably laid out, not by
giving you a glyph to interpret. When an icon does appear, it's because no
amount of typography would do the same job.

### What's actually used

- **Currency glyphs `₸` and `₩`.** These are Unicode characters, set in
  Inter at the same weight as surrounding text. They're not icons — they're
  type. They appear inline in amounts and directions, and at 32px medium-bold
  in the rate widget as the centerpiece glyphs.

- **The direction triangle in the rate widget.** A *hollow outline*
  right-pointing triangle, 20×20, 1.6px stroke, `currentColor`. Not a
  filled play button. Defined inline in `RateWidget.tsx`:
  ```svg
  <path d="M6 4.5 L15 10 L6 15.5 Z"
        stroke="currentColor" stroke-width="1.6"
        stroke-linejoin="round" stroke-linecap="round" />
  ```

- **The brand mark.** A `#1A7A4A` rounded square (128px radius on a
  512px canvas — `--r-xl`-ish proportion) with a lowercase `ö` in Inter
  Bold at `#F5F0E8`. See `assets/oz-icon.svg`. The mark is also rendered
  in-app as a div with the same proportions (`.oz-brand-mark` in
  `globals.css`, accepts a `size` prop).

- **The sortselect dropdown chevron.** A 12×12 inline-SVG-as-data-URL
  chevron set into the `background-image` of the `<select>`, 1.5px stroke
  in `#4B5563`. Lives only inside `.oz-sortselect`.

- **The "+" on the FAB.** Drawn as text (`+`), not as an SVG. It's a
  56×56 green circle with white `+` glyph at 28-ish px.

- **The chat-bubble flagged-message dot.** A 6×6 warning-colored circle
  drawn with `::after` on the bubble. Used to mark moderated content.

- **The pull handle on the bottom sheet.** A 36×4 rounded rectangle in
  `--border-strong`. Pure CSS, no SVG.

### What is NOT used

- **No icon font.** No Lucide / Heroicons / Phosphor / Feather. The
  codebase has zero icon-set imports. Don't add one.
- **No emoji.** Period.
- **No flag icons** (e.g. 🇰🇿 / 🇰🇷). Currencies are represented by glyph,
  not by country. This is partly aesthetic and partly substantive — öz
  is about the exchange, not the geographies.
- **No "star" icon for ratings.** The rating uses the literal `★` Unicode
  character followed by the number (`★ 4.7 · 12`) in Inter. New users get
  the word `Новый`. No filled-half-empty star strip.

### If you need an icon

The codebase does not ship an icon set. If a future surface genuinely needs
one (say, the trash icon currently rendered as a `×` character in
`AlertsClient.tsx` is a candidate for upgrade), follow these rules:

1. **Try harder to avoid it.** Most candidates can be solved with a word.
2. If you must, **match the rate-widget triangle's vocabulary**: hollow
   outline, 1.5–1.6px stroke weight, rounded line-caps and line-joins,
   `currentColor` fill or stroke, sit on a 20×20 viewBox.
3. **Lucide** is the closest CDN match for this stroke style and would
   substitute cleanly if needed. **Flag the substitution** to the team
   before shipping.

---

## How to use this design system in a new mock

```html
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>öz — what you're building</title>
  <link rel="icon" href="assets/oz-icon.svg" />
  <link rel="stylesheet" href="colors_and_type.css" />
  <link rel="stylesheet" href="ui_kits/oz-mobile/components.css" />
</head>
<body>
  <!-- compose using classes from globals.css mirrored in colors_and_type.css
       + the components.css UI-kit recipes -->
</body>
</html>
```

For a working starting point, open `ui_kits/oz-mobile/index.html` — it's
a clickable prototype of the feed → post-listing → transaction flow.

---

## Substitutions to flag

- **Fonts:** Inter and JetBrains Mono are loaded from **Google Fonts CDN**
  rather than self-hosted. The codebase uses `next/font/google`, which
  self-hosts at build time. If you self-host, swap the `@import` in
  `colors_and_type.css` for `@font-face` rules pointing at local woff2s.
  This is the same font family — no visual substitution.
- **No icon set substitution made.** The product has no icon set; none
  was added.

---

## Caveats

- The full `oz_design_system.html` on the repo root (581 KB) was not
  fully ingested — only the parts of it that overlap with `globals.css`
  and the component code. If that file documents motifs not covered
  here, this DS may be incomplete. **Ask the user to point out anything
  missing from that file.**
- The Telegram-bot OTP flow has a "delivered" and "awaiting_link" mode;
  both are documented but only the "delivered" path is mocked in the
  UI kit.
- The dispute sheet and rating card UI exist in code (`DisputeSheet.tsx`,
  `RatingCard.tsx`) but aren't yet recreated in the kit.
