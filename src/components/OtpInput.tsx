"use client";

import { useEffect, useRef } from "react";

type Props = {
  length?: number;
  value: string;
  onChange: (v: string) => void;
  hasError?: boolean;
  autoFocus?: boolean;
};

export function OtpInput({
  length = 6,
  value,
  onChange,
  hasError = false,
  autoFocus = true,
}: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function setDigit(i: number, d: string) {
    const next = value.split("");
    next[i] = d;
    // Keep dense — drop trailing undefineds
    const joined = next.join("").slice(0, length);
    onChange(joined);
  }

  function handleChange(i: number, raw: string) {
    const d = raw.replace(/\D/g, "");
    if (!d) return;

    if (d.length === 1) {
      setDigit(i, d);
      const nextIndex = Math.min(i + 1, length - 1);
      refs.current[nextIndex]?.focus();
      refs.current[nextIndex]?.select();
      return;
    }

    // Paste path: distribute digits across boxes from index i
    const slice = d.slice(0, length - i);
    const chars = value.split("");
    for (let k = 0; k < slice.length; k++) {
      chars[i + k] = slice[k];
    }
    onChange(chars.join("").slice(0, length));
    const target = Math.min(i + slice.length, length - 1);
    refs.current[target]?.focus();
    refs.current[target]?.select();
  }

  function handleKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (value[i]) {
        setDigit(i, "");
        return;
      }
      // Empty box: move to previous and clear it
      if (i > 0) {
        const prev = i - 1;
        setDigit(prev, "");
        refs.current[prev]?.focus();
      }
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowLeft" && i > 0) {
      refs.current[i - 1]?.focus();
      refs.current[i - 1]?.select();
      e.preventDefault();
    }
    if (e.key === "ArrowRight" && i < length - 1) {
      refs.current[i + 1]?.focus();
      refs.current[i + 1]?.select();
      e.preventDefault();
    }
  }

  function handlePaste(i: number, e: React.ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData("text").replace(/\D/g, "");
    if (!text) return;
    e.preventDefault();
    handleChange(i, text);
  }

  return (
    <div className="flex gap-2 justify-center">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.currentTarget.select()}
          className={`oz-otp-box${hasError ? " is-error" : ""}`}
          aria-label={`Цифра ${i + 1}`}
        />
      ))}
    </div>
  );
}
