"use client";

import { useState } from "react";
import { formatRate } from "@/lib/format";
import { SuccessCheck } from "@/components/transaction/SuccessCheck";
import { StarRating } from "@/components/transaction/StarRating";

type Props = {
  shortId: string;
  otherName: string;
  gaveValue: string;
  gotValue: string;
  rate: number | null;
  completedAt: string | null;
  alreadyRated: boolean;
  myStars: number | null;
  hasReceipt: boolean;
  onSubmitRating: (stars: number) => Promise<void> | void;
  onOpenReceipt: () => void;
  onDone: () => void;
};

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function CompleteScreen({
  shortId,
  otherName,
  gaveValue,
  gotValue,
  rate,
  completedAt,
  alreadyRated,
  myStars,
  hasReceipt,
  onSubmitRating,
  onOpenReceipt,
  onDone,
}: Props) {
  const [stars, setStars] = useState(0);
  const [busy, setBusy] = useState(false);

  const done = async () => {
    if (!alreadyRated && stars > 0) {
      setBusy(true);
      await onSubmitRating(stars);
      setBusy(false);
    }
    onDone();
  };

  return (
    <div
      className="tc-stage"
      style={{ paddingBottom: "calc(8px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="tc-topbar">
        <span />
        <span className="tc-topbar__id">Сделка #{shortId}</span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "12px 24px 14px",
        }}
      >
        <SuccessCheck size="sm" />
        <h2
          className="tc-heading tc-heading--md"
          style={{ margin: 0, textAlign: "left" }}
        >
          Сделка завершена
        </h2>
      </div>

      <div className="tc-summary" style={{ marginBottom: 16 }}>
        <div className="tc-summary__row tc-summary__row--hero">
          <span className="tc-summary__label">Отдано</span>
          <span className="tc-summary__value tc-summary__value--mono">
            {gaveValue}
          </span>
        </div>
        <div className="tc-summary__row tc-summary__row--hero tc-summary__row--receive">
          <span className="tc-summary__label">Получено</span>
          <span className="tc-summary__value tc-summary__value--mono">
            {gotValue}
          </span>
        </div>
        <div className="tc-summary__row">
          <span className="tc-summary__label">Контрагент</span>
          <span className="tc-summary__value">{otherName}</span>
        </div>
        {rate !== null && (
          <div className="tc-summary__row">
            <span className="tc-summary__label">Курс</span>
            <span className="tc-summary__value tc-summary__value--mono">
              {formatRate(rate)}
            </span>
          </div>
        )}
        <div className="tc-summary__row">
          <span className="tc-summary__label">ID операции</span>
          <span className="tc-summary__value tc-summary__value--mono">
            #{shortId}
          </span>
        </div>
        {completedAt && (
          <div className="tc-summary__row">
            <span className="tc-summary__label">Дата</span>
            <span className="tc-summary__value tc-summary__value--mono">
              {formatDateTime(completedAt)}
            </span>
          </div>
        )}
      </div>

      <div className="tc-rating" style={{ padding: "16px 20px" }}>
        <p className="tc-rating__prompt">
          {alreadyRated ? "Вы оценили" : "Оцените сделку с"}{" "}
          <strong>{otherName}</strong>
        </p>
        {alreadyRated ? (
          <StarRating size="md" value={myStars ?? 0} readOnly showLabel={false} />
        ) : (
          <StarRating
            size="md"
            value={stars}
            onChange={setStars}
            showLabel={false}
          />
        )}
      </div>

      <div className="tc-actions">
        <button
          className="tc-actions__primary"
          onClick={done}
          disabled={busy}
        >
          {busy ? "Отправляем…" : "Готово"}
        </button>
        {hasReceipt && (
          <button
            type="button"
            className="tc-receipt-reveal"
            onClick={onOpenReceipt}
          >
            <span className="tc-receipt-reveal__lock">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
                <rect
                  x="2"
                  y="5.5"
                  width="8"
                  height="5"
                  rx="1"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
                <path
                  d="M4 5.5V4a2 2 0 0 1 4 0v1.5"
                  stroke="currentColor"
                  strokeWidth="1.3"
                />
              </svg>
            </span>
            Посмотреть чеки
          </button>
        )}
      </div>
    </div>
  );
}
