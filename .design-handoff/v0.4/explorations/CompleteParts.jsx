/* global React */

// SuccessCheck — primary-soft circle with green tick. Three sizes.
function SuccessCheck({ size = "lg" }) {
  return (
    <div className={"tc-success tc-success--" + size}>
      <div className="tc-success__ring">
        <span className="tc-success__tick"></span>
      </div>
    </div>
  );
}

// Star rating — gold (#B98A3A) filled / outline. Controllable; supports
// hover preview for the desktop experience. The "chosen label" below the
// row mirrors what 1–5 stars mean in plain Russian.
const { useState: useStateSR } = React;

function StarRating({ size = "md", showLabel = true, onChange }) {
  const [picked, setPicked] = useStateSR(0);
  const [hovered, setHovered] = useStateSR(0);

  const labels = ["", "Плохо", "Так себе", "Нормально", "Хорошо", "Отлично"];
  const active = hovered || picked;
  const chosenLabel = labels[picked] || labels[hovered] || "Нажмите, чтобы оценить";

  function pick(n) {
    setPicked(n);
    onChange?.(n);
  }

  return (
    <>
      <div className={"tc-stars tc-stars--" + size}>
        {[1, 2, 3, 4, 5].map((n) => {
          const isFilled = n <= active;
          const isPreview = hovered > 0 && n <= hovered && n > picked;
          return (
            <button
              key={n}
              type="button"
              className={
                "tc-star" +
                (isFilled ? " is-filled" : "") +
                (isPreview ? " is-preview" : "")
              }
              onClick={() => pick(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              aria-label={n + " звёзд"}
            >
              <StarShape filled={isFilled} />
            </button>
          );
        })}
      </div>
      {showLabel && (
        <div className={"tc-rating__chosen-label" + (picked > 0 ? " is-on" : "")}>
          {chosenLabel}
        </div>
      )}
    </>
  );
}

function StarShape({ filled }) {
  // 5-point star, balanced for the gold fill we want.
  return (
    <svg viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 1.6} strokeLinejoin="round">
      <path d="M12 2.6 L14.9 9.0 L21.8 9.7 L16.5 14.3 L18.0 21.0 L12 17.6 L6.0 21.0 L7.5 14.3 L2.2 9.7 L9.1 9.0 Z" />
    </svg>
  );
}

// Locked-eye icon for the "Посмотреть чеки" reveal
function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <rect x="2" y="5.5" width="8" height="5" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

// Receipt reveal — small ghost link with a tiny lock icon.
function ReceiptReveal() {
  return (
    <button type="button" className="tc-receipt-reveal">
      <span className="tc-receipt-reveal__lock"><LockIcon /></span>
      Посмотреть чеки
    </button>
  );
}

window.SuccessCheck = SuccessCheck;
window.StarRating = StarRating;
window.ReceiptReveal = ReceiptReveal;
