"use client";

import { useRef, useState } from "react";
import { hapticImpact, hapticNotification } from "@/lib/telegram/webapp";

type Props = {
  label?: string;
  confirmedLabel?: string;
  disabled?: boolean;
  onConfirm?: () => void;
};

const THRESHOLD = 0.85;

// Drag (mouse or touch) the thumb ≥85% of the track and release to confirm.
// Keyboard: focus the control and press Enter/Space to confirm. Disabled
// ignores all input.
export function SlideToConfirm({
  label = "Сдвиньте, чтобы подтвердить",
  confirmedLabel = "Готово",
  disabled = false,
  onConfirm,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(0); // 0..1, drives the thumb
  const posRef = useRef(0); // mirror so release reads the live value, not a stale closure
  const [done, setDone] = useState(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startPosRef = useRef(0);
  const armedRef = useRef(false); // fired the "past threshold" haptic this drag

  const setPosition = (p: number) => {
    posRef.current = p;
    setPos(p);
  };

  const trackWidth = () => {
    const el = trackRef.current;
    return el ? el.clientWidth - 56 : 0; // 48px thumb + 8px gap
  };

  const commit = () => {
    setPosition(1);
    setDone(true);
    hapticNotification("success");
    onConfirm?.();
  };

  const onMove = (e: MouseEvent | TouchEvent) => {
    if (!draggingRef.current) return;
    if (e.cancelable) e.preventDefault();
    const x = "touches" in e ? e.touches[0]!.clientX : e.clientX;
    const dx = x - startXRef.current;
    const w = trackWidth();
    const next = Math.max(0, Math.min(1, startPosRef.current + (w ? dx / w : 0)));
    // Light tick the moment the thumb crosses into the "release to confirm"
    // zone, so the user feels where the commit point is.
    if (next >= THRESHOLD && !armedRef.current) {
      armedRef.current = true;
      hapticImpact("light");
    } else if (next < THRESHOLD) {
      armedRef.current = false;
    }
    setPosition(next);
  };

  const onUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onUp);
    if (posRef.current >= THRESHOLD) commit();
    else setPosition(0);
  };

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled || done) return;
    draggingRef.current = true;
    startXRef.current =
      "touches" in e ? e.touches[0]!.clientX : (e as React.MouseEvent).clientX;
    startPosRef.current = posRef.current;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled || done) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      commit();
    }
  };

  const cls =
    "tx-slide" + (disabled ? " is-disabled" : "") + (done ? " is-done" : "");

  return (
    <div
      ref={trackRef}
      className={cls}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={done ? confirmedLabel : label}
      aria-disabled={disabled}
      onMouseDown={onDown}
      onTouchStart={onDown}
      onKeyDown={onKeyDown}
    >
      <div
        className="tx-slide__label"
        style={{ opacity: pos > 0.4 ? Math.max(0, 1 - pos * 1.4) : 1 }}
      >
        {done ? confirmedLabel : label}
      </div>
      <div
        className="tx-slide__thumb"
        style={{ left: `calc(4px + ${pos} * (100% - 56px))` }}
      >
        {done ? (
          <span
            style={{
              display: "block",
              width: 14,
              height: 7,
              borderLeft: "2px solid currentColor",
              borderBottom: "2px solid currentColor",
              transform: "rotate(-45deg) translate(2px, -2px)",
            }}
          />
        ) : (
          <span className="tx-slide__arrow" aria-hidden />
        )}
      </div>
    </div>
  );
}
