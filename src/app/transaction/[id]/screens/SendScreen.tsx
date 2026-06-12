"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  CounterpartyPaymentMethod,
  Currency,
  Profile,
  VerificationTier,
} from "@/lib/types";
import { formatAmount, reputationLine } from "@/lib/format";
import { VerificationBadge } from "@/components/feed/VerificationBadge";
import { PressAndHold } from "@/components/transaction/PressAndHold";
import { CopyRow } from "@/components/transaction/CopyRow";

// TODO(rate-lock): RATE_LOCK_MINUTES should be server-driven (the v0.3 note
// flagged the lock window as not yet stable). Until then the countdown is a
// client estimate from rate_locked_at.
const RATE_LOCK_MINUTES = 15;

type Props = {
  shortId: string;
  transactionId: string;
  counterparty: Profile;
  amount: number;
  equivalent: number | null;
  from: Currency;
  to: Currency;
  rateLockedAt: string;
  // Set when either party reported that the recipient name doesn't match
  // the bank's transfer screen; freezes the send affordance until the
  // counterparty resolves it (transactions.name_mismatch_at).
  nameMismatchAt: string | null;
  onReportMismatch: () => Promise<void>;
  onConfirmSent: () => void;
  onCancel: () => void;
  onBack: () => void;
};

function initialOf(name: string | null, phone: string | null): string {
  const source = name?.trim() || phone?.trim();
  const first = source?.match(/[A-Za-zА-Яа-яЁё0-9]/);
  return (first?.[0] ?? "?").toUpperCase();
}

function joinedLine(createdAt: string): string {
  const month = new Intl.DateTimeFormat("ru-RU", { month: "long" }).format(
    new Date(createdAt),
  );
  const year = new Date(createdAt).getFullYear();
  return `На öz с ${month} ${year}`;
}

export function SendScreen({
  shortId,
  transactionId,
  counterparty,
  amount,
  equivalent,
  from,
  to,
  rateLockedAt,
  nameMismatchAt,
  onReportMismatch,
  onConfirmSent,
  onCancel,
  onBack,
}: Props) {
  const supabase = createClient();
  const [pm, setPm] = useState<CounterpartyPaymentMethod | null>(null);
  const [pmLoading, setPmLoading] = useState(true);
  const [pmError, setPmError] = useState(false);
  // The counterparty edited their payout details after this deal started —
  // the RPC refuses to reveal them (payment_details_changed_mid_deal) and
  // the send affordance freezes, mirroring the name-mismatch state.
  const [detailsChanged, setDetailsChanged] = useState(false);
  // The name-match checkpoint: the press-and-hold confirm stays hidden
  // until the sender explicitly confirms the recipient name they see in
  // their banking app matches recipient_name. Resets if the freeze is
  // lifted, so the name gets re-verified against the fixed details.
  const [nameChecked, setNameChecked] = useState(false);
  const [reporting, setReporting] = useState(false);

  useEffect(() => {
    if (nameMismatchAt) setNameChecked(false);
  }, [nameMismatchAt]);

  const reportMismatch = async () => {
    setReporting(true);
    try {
      await onReportMismatch();
    } finally {
      setReporting(false);
    }
  };

  // Reveal the counterparty's real bank details for this transaction. The RPC
  // enforces that the caller is a party and audit-logs the reveal. Treat both
  // an RPC error and a missing method as an error (the sender can't pay without
  // it — defence in depth, since they should have passed the gate).
  useEffect(() => {
    let cancelled = false;
    setPmLoading(true);
    void supabase
      .rpc("get_counterparty_payment_method", {
        p_transaction_id: transactionId,
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        const row =
          (data as CounterpartyPaymentMethod[] | null)?.[0] ?? null;
        if (error?.message === "payment_details_changed_mid_deal") {
          setDetailsChanged(true);
          setPmError(false);
          setPm(null);
        } else if (error || !row) {
          setPmError(true);
          setPm(null);
        } else {
          setPmError(false);
          setDetailsChanged(false);
          setPm(row);
        }
        setPmLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, transactionId]);

  const [remaining, setRemaining] = useState(() =>
    Math.max(
      0,
      new Date(rateLockedAt).getTime() +
        RATE_LOCK_MINUTES * 60_000 -
        Date.now(),
    ),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(
        Math.max(
          0,
          new Date(rateLockedAt).getTime() +
            RATE_LOCK_MINUTES * 60_000 -
            Date.now(),
        ),
      );
    }, 1000);
    return () => clearInterval(id);
  }, [rateLockedAt]);

  const mm = Math.floor(remaining / 60_000);
  const ss = Math.floor((remaining % 60_000) / 1000);
  const timer = `${mm}:${ss.toString().padStart(2, "0")}`;

  const name = counterparty.display_name ?? "Без имени";
  const ratingLine = reputationLine(
    counterparty.rating_avg,
    counterparty.deals_count,
  );

  return (
    <div className="tx-stage">
      <div className="tx-topbar">
        <button className="tx-topbar__back" aria-label="Назад" onClick={onBack}>
          ←
        </button>
        <span className="tx-topbar__id">Сделка #{shortId}</span>
      </div>

      <div className="tx-statusline">
        <span
          className={`tx-statusline__dot${nameMismatchAt || detailsChanged ? " tx-statusline__dot--warn" : ""}`}
        />
        <span>
          {detailsChanged
            ? "Перевод остановлен · реквизиты изменились"
            : nameMismatchAt
              ? "Перевод остановлен · реквизиты проверяются"
              : "Сделка активна · переведите средства"}
        </span>
      </div>

      <div
        className="tx-card tx-party-card tx-party-card--lg"
        style={{ padding: 20, alignItems: "flex-start" }}
      >
        <div className="tx-party-card__avatar">
          {initialOf(counterparty.display_name, counterparty.phone_masked)}
        </div>
        <div className="tx-party-card__identity">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <div className="tx-party-card__name">{name}</div>
            <VerificationBadge
              tier={counterparty.verification_tier as VerificationTier}
              full
            />
          </div>
          <div className="tx-party-card__meta" style={{ marginTop: 4 }}>
            {ratingLine}
          </div>
          <div className="tx-party-card__history">
            {joinedLine(counterparty.created_at)}
          </div>
        </div>
      </div>

      <div
        className="tx-card tx-timer tx-timer--understated"
        style={{ padding: "10px 14px" }}
      >
        <div
          className="tx-timer__icon"
          style={{ width: 22, height: 22, borderWidth: 1 }}
        >
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path
              d="M7 4.5V7.5L9 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="tx-timer__label" style={{ fontSize: 12 }}>
          Окно перевода
        </span>
        <span className="tx-timer__value" style={{ fontSize: 15 }}>
          {timer}
        </span>
      </div>

      <div className="tx-card">
        <div className="tx-twoside">
          <div className="tx-twoside__side">
            <div className="tx-twoside__label">Вы отправляете</div>
            <div className="tx-twoside__value">{formatAmount(amount, from)}</div>
          </div>
          <div className="tx-twoside__arrow">→</div>
          <div className="tx-twoside__side tx-twoside__side--receive">
            <div className="tx-twoside__label">Получаете</div>
            <div className="tx-twoside__value">
              {equivalent !== null ? formatAmount(equivalent, to) : "—"}
            </div>
          </div>
        </div>
      </div>

      {pmError && (
        <div className="tx-card tx-freeze">
          <p className="tx-freeze__copy">
            Контрагент ещё не указал реквизиты. Свяжитесь через чат.
          </p>
        </div>
      )}

      {/* The details block disappears entirely in the changed-details
          freeze: stale or swapped payout data must never be on screen. */}
      {!detailsChanged && (
      <div className="tx-card tx-bank">
        <div className="tx-bank__title">Реквизиты получателя</div>
        {/* The recipient name leads the block: it's what the sender's bank
            shows on its own confirmation screen, so it's the one field they
            can verify for free before money moves. */}
        <div className="tx-bank__recipient">
          <span className="tx-bank__recipient-name">
            {pm?.recipient_name ?? "—"}
          </span>
          <span className="tx-bank__recipient-hint">
            Банк покажет это имя при переводе — сверьте перед отправкой
          </span>
        </div>
        <CopyRow label="Банк" value={pm?.bank_name ?? "—"} />
        <CopyRow label="Номер карты" value={pm?.account_number ?? "—"} />
        <CopyRow label="Сумма" value={formatAmount(amount, from)} emphasize />
      </div>
      )}

      {!pmError && !detailsChanged && (
        <p className="tx-bank-helper">
          {pmLoading
            ? "Загружаем реквизиты получателя…"
            : "Получатель видит ваш платёж в течение 2–5 минут."}
        </p>
      )}

      {detailsChanged && (
        <div className="tx-card tx-freeze">
          <div className="tx-freeze__title">Перевод остановлен</div>
          <p className="tx-freeze__copy">
            Контрагент изменил реквизиты после начала сделки. Не отправляйте
            перевод. Отмените сделку или дождитесь подтверждения от команды
            öz.
          </p>
        </div>
      )}

      {nameMismatchAt && (
        <div className="tx-card tx-freeze">
          <div className="tx-freeze__title">Перевод остановлен</div>
          <p className="tx-freeze__copy">
            Не отправляйте деньги. Контрагент получил уведомление и исправит
            реквизиты — мы сообщим, когда они обновятся.
          </p>
        </div>
      )}

      <div className="tx-actions tx-actions--inset">
        {!pmError && !nameMismatchAt && pm && !nameChecked && (
          <div className="tx-namecheck">
            <p className="tx-namecheck__question">
              В приложении банка перед отправкой вы увидите имя получателя.
              Оно совпадает с:{" "}
              <strong className="tx-namecheck__name">
                {pm.recipient_name}
              </strong>
              ?
            </p>
            <div className="tx-namecheck__actions">
              <button
                type="button"
                className="tx-actions__primary"
                disabled={reporting}
                onClick={() => setNameChecked(true)}
              >
                Да, совпадает
              </button>
              <button
                type="button"
                className="tx-namecheck__no"
                disabled={reporting}
                onClick={reportMismatch}
              >
                {reporting ? "Останавливаем…" : "Имя не совпадает"}
              </button>
            </div>
          </div>
        )}
        {!pmError && !nameMismatchAt && nameChecked && (
          <>
            <PressAndHold label="Я отправил деньги" onConfirm={onConfirmSent} />
            <p className="tx-hold-hint">
              Удерживайте 2 сек. — далее загрузка чека
            </p>
          </>
        )}
        <button className="tx-actions__ghost-link" onClick={onCancel}>
          Отменить сделку
        </button>
      </div>
    </div>
  );
}
