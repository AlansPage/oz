"use client";

import { useState } from "react";

type Props = {
  size?: "lg" | "md" | "sm";
  value?: number;
  onChange?: (n: number) => void;
  showLabel?: boolean;
  readOnly?: boolean;
};

const LABELS = ["", "Плохо", "Так себе", "Нормально", "Хорошо", "Отлично"];

// Gold filled / outline star rating. Controllable via value/onChange so the
// parent owns the submit. readOnly renders a static filled row.
export function StarRating({
  size = "md",
  value,
  onChange,
  showLabel = true,
  readOnly = false,
}: Props) {
  const [internal, setInternal] = useState(0);
  const [hovered, setHovered] = useState(0);

  const picked = value ?? internal;
  const active = hovered || picked;
  const chosenLabel =
    LABELS[picked] || LABELS[hovered] || "Нажмите, чтобы оценить";

  const pick = (n: number) => {
    if (readOnly) return;
    if (value === undefined) setInternal(n);
    onChange?.(n);
  };

  return (
    <>
      <div
        className={"tc-stars tc-stars--" + size}
        role={readOnly ? "img" : "radiogroup"}
        aria-label={readOnly ? `Оценка ${picked} из 5` : "Оценка"}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const isFilled = n <= active;
          const isPreview = hovered > 0 && n <= hovered && n > picked;
          return (
            <button
              key={n}
              type="button"
              disabled={readOnly}
              className={
                "tc-star" +
                (isFilled ? " is-filled" : "") +
                (isPreview ? " is-preview" : "")
              }
              onClick={() => pick(n)}
              onMouseEnter={() => !readOnly && setHovered(n)}
              onMouseLeave={() => !readOnly && setHovered(0)}
              aria-label={n + " звёзд"}
              aria-checked={readOnly ? undefined : picked === n}
              role={readOnly ? undefined : "radio"}
              style={readOnly ? { cursor: "default" } : undefined}
            >
              <StarShape filled={isFilled} />
            </button>
          );
        })}
      </div>
      {showLabel && !readOnly && (
        <div
          className={"tc-rating__chosen-label" + (picked > 0 ? " is-on" : "")}
        >
          {chosenLabel}
        </div>
      )}
    </>
  );
}

function StarShape({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.6}
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2.6 L14.9 9.0 L21.8 9.7 L16.5 14.3 L18.0 21.0 L12 17.6 L6.0 21.0 L7.5 14.3 L2.2 9.7 L9.1 9.0 Z" />
    </svg>
  );
}
