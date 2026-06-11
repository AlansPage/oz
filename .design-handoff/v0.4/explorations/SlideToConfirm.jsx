/* global React */
const { useState, useRef } = React;

// Drag-or-tap-and-hold slide to confirm a destructive/important action.
// Disabled state ignores all input. When the thumb is dragged ≥85% of the
// track width and released, fires onConfirm.
function SlideToConfirm({ label = "Сдвиньте, чтобы подтвердить", confirmedLabel = "Готово", disabled = false, onConfirm }) {
  const trackRef = useRef(null);
  const [pos, setPos] = useState(0);   // 0..1
  const [done, setDone] = useState(false);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startPosRef = useRef(0);

  function trackWidth() {
    if (!trackRef.current) return 0;
    return trackRef.current.clientWidth - 56;   // 48px thumb + 8px gap
  }

  function onDown(e) {
    if (disabled || done) return;
    draggingRef.current = true;
    startXRef.current = e.touches ? e.touches[0].clientX : e.clientX;
    startPosRef.current = pos;
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
  }
  function onMove(e) {
    if (!draggingRef.current) return;
    if (e.cancelable) e.preventDefault();
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = x - startXRef.current;
    const w = trackWidth();
    const next = Math.max(0, Math.min(1, startPosRef.current + dx / w));
    setPos(next);
  }
  function onUp() {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    window.removeEventListener("touchmove", onMove);
    window.removeEventListener("touchend", onUp);
    if (pos >= 0.85) {
      setPos(1);
      setDone(true);
      onConfirm?.();
    } else {
      setPos(0);
    }
  }

  const cls =
    "tx-slide" +
    (disabled ? " is-disabled" : "") +
    (done ? " is-done" : "");

  return (
    <div ref={trackRef} className={cls} onMouseDown={onDown} onTouchStart={onDown}>
      <div className="tx-slide__label" style={{ opacity: pos > 0.4 ? Math.max(0, 1 - pos * 1.4) : 1 }}>
        {done ? confirmedLabel : label}
      </div>
      <div
        className="tx-slide__thumb"
        style={{ left: `calc(4px + ${pos} * (100% - 56px))` }}
      >
        {done ? <Tick /> : <span className="tx-slide__arrow" aria-hidden></span>}
      </div>
    </div>
  );
}

function Tick() {
  return (
    <span style={{
      display: "block",
      width: 14, height: 7,
      borderLeft: "2px solid currentColor",
      borderBottom: "2px solid currentColor",
      transform: "rotate(-45deg) translate(2px, -2px)",
    }}></span>
  );
}

window.SlideToConfirm = SlideToConfirm;
