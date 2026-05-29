"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  label?: string;
  doneLabel?: string;
  holdMs?: number;
  /** Fraction of holdMs that must elapse to fire (0..1). Default 1 = full hold. */
  threshold?: number;
  disabled?: boolean;
  onConfirm?: () => void;
};

// Press and hold for `holdMs` to confirm. Releasing early aborts and resets.
// A fill animates 0→100% during the hold (rAF-driven). Keyboard: hold
// Enter/Space; release the key to abort.
export function PressAndHold({
  label = "Я отправил деньги",
  doneLabel = "Готово",
  holdMs = 2000,
  threshold = 1,
  disabled = false,
  onConfirm,
}: Props) {
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const holdingRef = useRef(false);
  const startRef = useRef(0);
  const rafRef = useRef(0);

  const tick = () => {
    if (!holdingRef.current) return;
    const elapsed = performance.now() - startRef.current;
    const next = Math.min(1, elapsed / holdMs);
    setPct(next);
    if (next >= threshold) {
      holdingRef.current = false;
      setPct(1);
      setDone(true);
      onConfirm?.();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  };

  const down = () => {
    if (disabled || done || holdingRef.current) return;
    holdingRef.current = true;
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  };

  const up = () => {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    if (!done) setPct(0);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.key === "Enter" || e.key === " ") && !e.repeat) {
      e.preventDefault();
      down();
    }
  };
  const onKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") up();
  };

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const cls =
    "tx-hold" +
    (pct > 0 && !done ? " is-holding" : "") +
    (done ? " is-done" : "");

  return (
    <button
      type="button"
      className={cls}
      onMouseDown={down}
      onMouseUp={up}
      onMouseLeave={up}
      onTouchStart={(e) => {
        if (e.cancelable) e.preventDefault();
        down();
      }}
      onTouchEnd={up}
      onTouchCancel={up}
      onKeyDown={onKeyDown}
      onKeyUp={onKeyUp}
      disabled={disabled}
      aria-label={label}
    >
      <span className="tx-hold__fill" style={{ width: pct * 100 + "%" }} />
      <span className="tx-hold__label">{done ? doneLabel : label}</span>
    </button>
  );
}
