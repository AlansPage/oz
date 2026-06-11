---
name: oz-design
description: Use this skill to generate well-branded interfaces and assets for öz — a P2P marketplace for Kazakhstanis in Korea exchanging KZT ↔ KRW directly with each other. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for production code OR throwaway prototypes / mocks / slides.
user-invocable: true
---

Read the `README.md` file within this skill first — it has the company
context, the content fundamentals (Russian, calm, terse, formal-you,
no emoji), the visual foundations (warm off-white canvas, single
confident green for trust only, two type families, brown-toned warm
shadows, no icon set), and the iconography rules.

Then explore the other files:

- `colors_and_type.css` — every CSS custom property + Inter + JetBrains
  Mono via Google Fonts. Drop into any new HTML mock.
- `ui_kits/oz-mobile/components.css` — every `oz-*` component class
  from the production codebase, ready to drop in alongside.
- `ui_kits/oz-mobile/` — JSX recreations of Landing, Phone, OTP verify,
  Feed (with rate widget, listing cards, FAB, post-listing sheet) plus
  shared primitives. Open `index.html` to see them as a click-through
  prototype.
- `assets/` — the `ö` brand mark SVG, the rate-widget reference image.
- `_source/` — frozen snapshot of the relevant slices of the production
  Next.js codebase (`AlansPage/oz` on GitHub), kept for reference when
  recreating screens that aren't yet in the UI kit.
- `preview/` — small per-token / per-component cards used to populate
  the Design System tab. Useful as visual reference.

## When generating designs

**If creating visual artifacts** (slides, mocks, throwaway prototypes,
static HTML): copy `colors_and_type.css` + `components.css` into the
new file's folder, link them in `<head>`, and compose using the `oz-*`
classes from `components.css` or the type recipes from
`colors_and_type.css`. Copy any visual assets out of `assets/`.

**If working on production code** (the `AlansPage/oz` Next.js app):
the canonical token source is `src/app/globals.css` + `tailwind.config.ts`
in that repo. `colors_and_type.css` here is a mirror; if they diverge,
the codebase wins.

## Non-negotiables

- Background is `#F5F0E8`. **Never pure white.** White is for elevated
  surfaces only.
- `#1A7A4A` green is reserved for trust + confirmation. No decorative
  green. No green icons just for color. The rate-widget tint
  (`rgba(26,122,74, .08)`) is the one exception — and it has its own
  variable.
- Numbers always render in JetBrains Mono with `font-variant-numeric: tabular-nums`.
- Russian sentence case. No All-Caps except the one `oz-eyebrow` recipe.
- No emoji. No flag icons. No icon font. If you reach for one of these,
  re-read the README's ICONOGRAPHY section first.
- Russian decimal separator is the comma; group separator is a thin
  space (`\u202F`). Helpers in `ui_kits/oz-mobile/oz-shared.jsx`.

## If the user invokes this skill without other guidance

Ask them what they want to build (a new screen? a marketing page?
a slide? a print piece?), confirm they're targeting öz (this skill is
brand-specific), and ask about audience + surface + variation count.
Then act as an expert öz designer — output HTML artifacts for mocks
and slides, or production-style React + Tailwind/CSS for code.

## Source repository

<https://github.com/AlansPage/oz> — read its `oz_design_system.html`
(at the repo root, 581 KB) for an in-browser living styleguide that may
document motifs not captured in this skill.
