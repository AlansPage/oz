"use client";

type Props = {
  bankName?: string;
  amount: string;
  meta?: string;
  eyebrow?: string;
  pillLabel?: string;
  compact?: boolean;
  onOpenFull?: () => void;
};

// Structured summary of the receipt the sender uploaded — NOT the full
// screenshot. "Открыть полностью →" reveals the image via onOpenFull.
export function SubmittedReceiptCard({
  bankName = "Kaspi Gold",
  amount,
  meta,
  eyebrow = "Ваш чек",
  pillLabel = "чек получен",
  compact = false,
  onOpenFull,
}: Props) {
  return (
    <div
      className={
        "tx-card tx-receipt-summary" +
        (compact ? " tx-receipt-summary--compact" : "")
      }
    >
      <div className="tx-receipt-summary__header">
        <span className="tx-receipt-summary__eyebrow">{eyebrow}</span>
        <span className="tx-receipt-summary__pill">{pillLabel}</span>
      </div>
      <div className="tx-receipt-summary__body">
        <div className="tx-receipt-summary__bank">
          <span className="tx-receipt-summary__logo" aria-hidden />
          <span className="tx-receipt-summary__bank-name">{bankName}</span>
        </div>
        <div className="tx-receipt-summary__amount">{amount}</div>
        {meta && <div className="tx-receipt-summary__meta">{meta}</div>}
        {onOpenFull && (
          <button
            type="button"
            className="tx-receipt-summary__open"
            onClick={onOpenFull}
          >
            Открыть полностью →
          </button>
        )}
      </div>
    </div>
  );
}
