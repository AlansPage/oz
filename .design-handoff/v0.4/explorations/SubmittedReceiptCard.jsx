/* global React */
// Structured summary of the receipt the sender just uploaded — NOT the full
// screenshot. The screenshot is one tap away ("Открыть полностью →") but
// the page itself shows captured fields so the sender sees their action as
// recorded data, not a fuzzy image.

function SubmittedReceiptCard({ compact = false }) {
  return (
    <div className={"tx-card tx-receipt-summary" + (compact ? " tx-receipt-summary--compact" : "")}>
      <div className="tx-receipt-summary__header">
        <span className="tx-receipt-summary__eyebrow">Ваш чек</span>
        <span className="tx-receipt-summary__pill">чек получен</span>
      </div>
      <div className="tx-receipt-summary__body">
        <div className="tx-receipt-summary__bank">
          <span className="tx-receipt-summary__logo" aria-hidden></span>
          <span className="tx-receipt-summary__bank-name">Kaspi Gold</span>
        </div>
        <div className="tx-receipt-summary__amount">750 000 ₸</div>
        <div className="tx-receipt-summary__meta">
          отправлено в 14:34 · с карты •••• 8821
        </div>
        <button type="button" className="tx-receipt-summary__open">
          Открыть полностью →
        </button>
      </div>
    </div>
  );
}

window.SubmittedReceiptCard = SubmittedReceiptCard;
