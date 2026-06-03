"use client";

import type { Currency, Profile, Receipt } from "@/lib/types";
import { formatAmount, formatRate } from "@/lib/format";
import { SubmittedReceiptCard } from "@/components/transaction/SubmittedReceiptCard";
import { WaitingPulse } from "@/components/transaction/WaitingPulse";

type Props = {
  shortId: string;
  counterparty: Profile;
  receipt: Receipt | null;
  amount: number;
  from: Currency;
  equivalent: number | null;
  to: Currency;
  rate: number | null;
  onOpenReceipt: () => void;
  onDispute: () => void;
  onBack: () => void;
};

export function WaitScreen({
  shortId,
  counterparty,
  receipt,
  amount,
  from,
  equivalent,
  to,
  rate,
  onOpenReceipt,
  onDispute,
  onBack,
}: Props) {
  const name = counterparty.display_name ?? "контрагента";
  const sentAmount = formatAmount(receipt?.amount_claimed ?? amount, from);
  const time = receipt
    ? new Date(receipt.created_at).toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const meta = time ? `отправлено в ${time}` : undefined;

  return (
    <div className="tx-stage">
      <div className="tx-topbar">
        <button className="tx-topbar__back" aria-label="Назад" onClick={onBack}>
          ←
        </button>
        <span className="tx-topbar__id">Сделка #{shortId}</span>
      </div>

      <div className="tx-statusline">
        <span className="tx-statusline__dot" />
        <span>Чек получен · ожидаем подтверждения</span>
      </div>

      <SubmittedReceiptCard
        amount={sentAmount}
        meta={meta}
        onOpenFull={receipt ? onOpenReceipt : undefined}
      />

      <div className="tx-card tx-card--tight" style={{ gap: 6 }}>
        <div className="tx-money-row">
          <span className="tx-money-row__label">Вы получаете</span>
          <span className="tx-money-row__value" style={{ fontSize: 18 }}>
            {equivalent !== null ? formatAmount(equivalent, to) : "—"}
          </span>
        </div>
        <div className="tx-money-sub">
          от {name} <span className="tx-vbadge-inline">ID</span>{" "}
          {rate !== null && <span className="mono">· курс {formatRate(rate)}</span>}
        </div>
      </div>

      <WaitingPulse hero />

      <p
        className="tx-bank-helper"
        style={{ padding: "0 20px", textAlign: "center" }}
      >
        Если контрагент долго не отвечает, мы отправим напоминание.
      </p>

      <div
        style={{
          padding: "16px 16px 0",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <button
          className="tx-actions__ghost-link"
          style={{ alignSelf: "center" }}
          onClick={onDispute}
        >
          Сообщить о проблеме
        </button>
      </div>
    </div>
  );
}
