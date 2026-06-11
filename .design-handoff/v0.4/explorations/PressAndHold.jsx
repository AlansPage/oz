/* global React */

// Press-and-hold confirm button. Holds for `holdMs` (default 2000ms) before
// firing onConfirm. Release early = abort + reset. Visual fill animates 0→100%
// during the hold. Disabled = no interaction.
const { useState: useStatePAH, useRef: useRefPAH, useEffect: useEffectPAH } = React;

function PressAndHold({
  label = "Я отправил деньги",
  doneLabel = "Готово",
  holdMs = 2000,
  disabled = false,
  onConfirm,
}) {
  const [pct, setPct] = useStatePAH(0);
  const [done, setDone] = useStatePAH(false);
  const holdingRef = useRefPAH(false);
  const startRef = useRefPAH(0);
  const rafRef = useRefPAH(0);

  function tick() {
    if (!holdingRef.current) return;
    const elapsed = performance.now() - startRef.current;
    const next = Math.min(1, elapsed / holdMs);
    setPct(next);
    if (next >= 1) {
      holdingRef.current = false;
      setDone(true);
      onConfirm?.();
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function down(e) {
    if (disabled || done) return;
    if (e.cancelable) e.preventDefault();
    holdingRef.current = true;
    startRef.current = performance.now();
    rafRef.current = requestAnimationFrame(tick);
  }
  function up() {
    if (!holdingRef.current) return;
    holdingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    if (!done) setPct(0);
  }

  useEffectPAH(() => () => cancelAnimationFrame(rafRef.current), []);

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
      onTouchStart={down}
      onTouchEnd={up}
      onTouchCancel={up}
      disabled={disabled}
    >
      <span className="tx-hold__fill" style={{ width: pct * 100 + "%" }}></span>
      <span className="tx-hold__label">{done ? doneLabel : label}</span>
    </button>
  );
}

window.PressAndHold = PressAndHold;
