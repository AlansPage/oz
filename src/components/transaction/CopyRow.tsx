"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  label: string;
  value: string;
  emphasize?: boolean;
};

// A bank-detail row: label + mono value + a copy button that briefly flips
// to a "copied" tick.
export function CopyRow({ label, value, emphasize = false }: Props) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    [],
  );

  const copy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className={"tx-bank__row" + (emphasize ? " tx-bank__row--amount" : "")}>
      <span className="tx-bank__label">{label}</span>
      <span className="tx-bank__value">{value}</span>
      <button
        type="button"
        className={"tx-bank__copy" + (copied ? " is-copied" : "")}
        onClick={copy}
        aria-label={"Копировать " + label}
      >
        {copied ? (
          <span
            style={{
              display: "block",
              width: 10,
              height: 6,
              borderLeft: "2px solid currentColor",
              borderBottom: "2px solid currentColor",
              transform: "rotate(-45deg) translate(1px, -1px)",
            }}
          />
        ) : (
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <rect
              x="3.5"
              y="3.5"
              width="7"
              height="9"
              rx="1.5"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M5 1.5h5a1.5 1.5 0 0 1 1.5 1.5v7"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
