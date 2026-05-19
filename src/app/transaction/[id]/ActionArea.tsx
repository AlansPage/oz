"use client";

import { useState } from "react";
import type { DisputeReason, TransactionStatus } from "@/lib/types";
import type { ViewerRole } from "./TransactionDetailClient";

const REASON_LABEL: Record<DisputeReason, string> = {
  not_received: "Не получил деньги",
  wrong_amount: "Неверная сумма",
  wrong_account: "Неверный счёт",
  other: "Другое",
};

type Props = {
  status: TransactionStatus;
  viewerRole: ViewerRole;
  disputeReason: DisputeReason | null;
  disputeDescription: string | null;
  disputedByYou: boolean;
  onUpload: () => void;
  onConfirmCounterpartyReceived: () => Promise<void>;
  onConfirmInitiatorReceived: () => Promise<void>;
  onCancel: () => Promise<void>;
};

export function ActionArea({
  status,
  viewerRole,
  disputeReason,
  disputeDescription,
  disputedByYou,
  onUpload,
  onConfirmCounterpartyReceived,
  onConfirmInitiatorReceived,
  onCancel,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runAction = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось выполнить");
    } finally {
      setBusy(false);
    }
  };

  if (status === "pending_sender_payment" && viewerRole === "initiator") {
    return (
      <div className="oz-listing-actions">
        <button
          className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg"
          onClick={onUpload}
          disabled={busy}
        >
          Я отправил
        </button>
        <button
          className="oz-btn oz-btn--ghost"
          onClick={() => runAction(onCancel)}
          disabled={busy}
        >
          Отменить сделку
        </button>
        {error && <p className="oz-sheet__error">{error}</p>}
      </div>
    );
  }

  if (status === "sender_paid" && viewerRole === "counterparty") {
    return (
      <div className="oz-listing-actions">
        <button
          className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg"
          onClick={() => runAction(onConfirmCounterpartyReceived)}
          disabled={busy}
        >
          {busy ? "…" : "Я получил перевод"}
        </button>
        {error && <p className="oz-sheet__error">{error}</p>}
      </div>
    );
  }

  if (status === "counterparty_confirmed" && viewerRole === "counterparty") {
    return (
      <div className="oz-listing-actions">
        <button
          className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg"
          onClick={onUpload}
          disabled={busy}
        >
          Я отправил
        </button>
        {error && <p className="oz-sheet__error">{error}</p>}
      </div>
    );
  }

  if (status === "counterparty_paid" && viewerRole === "initiator") {
    return (
      <div className="oz-listing-actions">
        <button
          className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg"
          onClick={() => runAction(onConfirmInitiatorReceived)}
          disabled={busy}
        >
          {busy ? "…" : "Я получил перевод"}
        </button>
        {error && <p className="oz-sheet__error">{error}</p>}
      </div>
    );
  }

  if (status === "disputed") {
    return (
      <div className="oz-listing-about">
        <div className="oz-listing-about__title">Спор</div>
        <div className="oz-listing-about__line">
          Причина: {disputeReason ? REASON_LABEL[disputeReason] : "—"}
        </div>
        {disputeDescription && (
          <div className="oz-listing-about__line">
            {disputeDescription}
          </div>
        )}
        <div className="oz-listing-about__line" style={{ color: "var(--text-2)" }}>
          {disputedByYou ? "Спор открыли вы." : "Спор открыл контрагент."}
        </div>
      </div>
    );
  }

  return null;
}
