# Rate widget v2 — design spec

A redesign of the rate widget at the top of /feed. Replaces the
current dark-green pill with a softer, more spacious version that
feels like a status indicator rather than a CTA.

## Visual

Soft tinted background (primary green at ~8-12% opacity over the
canvas), generous rounded corners (~24px), subtle 1px border in
primary at low opacity.

Internal contents, left to right:
- ₸ symbol, primary color, medium-bold weight, ~32px
- Hollow outline right-pointing triangle as direction indicator,
  primary color, ~20px (NOT a filled play-button shape)
- ₩ symbol matching ₸ weight and size
- Rate number "3,19" in JetBrains Mono bold, ~36px, primary color
  (comma decimal separator per Russian convention)
- Sparkline taking ~40% of widget width on the right

Sparkline: 1.5px line in primary, with an open circle marker at
the right end (the current value). Subtle horizontal fade-out on
the left edge so the line appears to emerge rather than start
abruptly.

## Animation

Three behaviors:

**On mount:** icons fade in first, number fades in with a small
stagger, sparkline draws itself left-to-right over ~800ms using
SVG stroke-dasharray. Open circle marker appears at the end of the
draw.

**On rate update (every 5 min):** if the rate changed, the number
briefly pulses (scale 1.0 → 1.08 → 1.0 over 600ms). Sparkline
extends by one segment smoothly. Marker repositions. If the rate
didn't change, no animation.

**Ambient (optional):** very subtle breathing on the background
opacity, oscillating between ~0.95 and 1.0 over 4 seconds. Almost
imperceptible. Drop if it feels distracting.

## States

- **Loading**: widget structure visible with muted/shimmer
  placeholder where the rate would be, sparkline absent
- **Error**: number replaced with "—" in muted color, no sparkline,
  no animation. Subtitle below: "Курс временно недоступен"
- **Live**: normal display with animations

## Tone

Airy, calm, status-indicator energy. Not loud, not pulsing
aggressively, not demanding attention. The widget gives context;
the listings are the focus.

## Responsive

Mobile (<480px): widget scales down proportionally. Sparkline
reduces to ~30% of widget width. Rate number stays at minimum 28px.

## Excluded from this slice

- Logo mark (sprout) above the widget — separate slice, designed
  later
- Interactivity (no click target)
- Hover state beyond subtle 1.01 scale
- Tooltip / refresh button / drill-down chart