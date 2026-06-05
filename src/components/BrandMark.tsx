type Props = {
  size?: number;
};

// öz brand mark — a single-stroke glyph (two ears, an "o" body, two eyes) that
// reads as both a small face and the ö+z motif. Authored in a 512 viewBox; the
// strokes scale with `size`. Color is driven by `currentColor` (see
// .oz-brand-mark in globals.css), so it themes with one CSS rule.
export function BrandMark({ size = 56 }: Props) {
  return (
    <svg
      className="oz-brand-mark"
      width={size}
      height={size}
      viewBox="114 88 284 284"
      role="img"
      aria-label="öz"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth={9.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M256 178 C 257.4 144.6 275.6 117.3 307.4 108.2 C 348.4 96.8 374.2 121.8 374.2 153.7 C 374.2 182.5 353 196.1 332.5 188.5 C 317.3 182.8 315.8 163.1 330.9 158.6" />
        <path d="M256 178 C 254.6 144.6 236.4 117.3 204.6 108.2 C 163.6 96.8 137.8 121.8 137.8 153.7 C 137.8 182.5 159 196.1 179.5 188.5 C 194.7 182.8 196.2 163.1 181.1 158.6" />
        <ellipse cx="256" cy="306" rx="40" ry="46" />
      </g>
      <g fill="currentColor" stroke="none">
        <circle cx="242" cy="222" r="7.5" />
        <circle cx="270" cy="222" r="7.5" />
      </g>
    </svg>
  );
}
