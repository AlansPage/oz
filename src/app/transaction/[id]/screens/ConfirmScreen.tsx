"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Currency, Profile, Receipt } from "@/lib/types";
import { formatAmount, formatRate, formatRelativeTime } from "@/lib/format";
import { KaspiReceiptMock } from "@/components/transaction/KaspiReceiptMock";
import { SlideToConfirm } from "@/components/transaction/SlideToConfirm";

type Props = {
  shortId: string;
  counterparty: Profile;
  receipt: Receipt | null;
  amount: number;
  from: Currency;
  rate: number | null;
  paidAt: string | null;
  onConfirmReceived: () => void;
  onDispute: () => void;
  onBack: () => void;
};

export function ConfirmScreen({
  shortId,
  counterparty,
  receipt,
  amount,
  from,
  rate,
  paidAt,
  onConfirmReceived,
  onDispute,
  onBack,
}: Props) {
  const [verified, setVerified] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  const isPdf = receipt?.storage_path.toLowerCase().endsWith(".pdf") ?? false;

  useEffect(() => {
    if (!receipt || isPdf) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    void supabase.storage
      .from("receipts")
      .createSignedUrl(receipt.storage_path, 600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [receipt, isPdf]);

  const name = counterparty.display_name ?? "контрагента";
  const incoming = formatAmount(amount, from);

  return (
    <div className="tx-stage" style={{ paddingBottom: 0 }}>
      <div className="tx-topbar">
        <button className="tx-topbar__back" aria-label="Назад" onClick={onBack}>
          ←
        </button>
        <span className="tx-topbar__id">Сделка #{shortId}</span>
      </div>

      <div className="tx-statusline" style={{ paddingBottom: 12 }}>
        <span className="tx-statusline__dot" />
        <span>
          Контрагент отправил перевод
          {paidAt ? ` · ${formatRelativeTime(paidAt)}` : ""}
        </span>
      </div>

      <p className="tx-frame-line">
        Чек предоставлен контрагентом. Откройте банк, чтобы проверить
        поступление.
      </p>

      <div
        className="tx-card"
        style={{ padding: 0, overflow: "hidden", gap: 0 }}
      >
        <div
          className="tx-receipt__thumb tx-receipt__thumb--xl"
          style={{ borderRadius: "var(--r-lg)", border: 0 }}
        >
          {receipt && url && !isPdf ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Чек контрагента" />
          ) : receipt && isPdf ? (
            <a
              href={url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="oz-btn oz-btn--ghost"
              style={{ margin: 16, alignSelf: "flex-start" }}
            >
              Открыть PDF
            </a>
          ) : (
            <KaspiReceiptMock amount={incoming} counterparty={name} />
          )}
        </div>
      </div>

      <div className="tx-card tx-card--tight" style={{ gap: 4 }}>
        <div className="tx-money-row">
          <span className="tx-money-row__label">Вы получаете</span>
          <span className="tx-money-row__value">{incoming}</span>
        </div>
        <div className="tx-money-sub">
          от {name} <span className="tx-vbadge-inline">ID</span>{" "}
          {rate !== null && <span className="mono">· курс {formatRate(rate)}</span>}
        </div>
      </div>

      <div className="tx-card tx-station">
        {/* TODO(deep-link): "Открыть" is a no-op until the Phase 1.5 Kaspi
            deep link lands. */}
        <button className="tx-station__open" type="button">
          <span className="tx-station__logo" aria-hidden />
          <span className="tx-station__text">
            <span className="tx-station__title">Откройте Kaspi и сверьте</span>
            <span className="tx-station__sub">Поступление {incoming}</span>
          </span>
          <span className="tx-station__arrow">Открыть ↗</span>
        </button>
        <button
          type="button"
          className={"tx-check" + (verified ? " tx-check--on" : "")}
          aria-pressed={verified}
          onClick={() => setVerified((v) => !v)}
        >
          <span className="tx-check__box">
            <span className="tx-check__tick" />
          </span>
          <span className="tx-check__label">
            Я сверил поступление в моём банке
          </span>
        </button>
      </div>

      <div className="tx-stickybar">
        {!verified && (
          <p className="tx-hint">
            Отметьте «Я сверил», чтобы подтвердить получение.
          </p>
        )}
        <SlideToConfirm
          label="Сдвиньте, чтобы подтвердить"
          confirmedLabel="Подтверждено"
          disabled={!verified}
          onConfirm={onConfirmReceived}
        />
        <button className="tx-actions__ghost-link" onClick={onDispute}>
          Сообщить о проблеме
        </button>
      </div>
    </div>
  );
}
