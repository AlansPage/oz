"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { PaymentMethodForm } from "@/components/profile/PaymentMethodForm";
import type { Currency, PaymentMethod } from "@/lib/types";
import type { TransactionWithProfiles } from "./TransactionDetailClient";

// Shown to the party whose payout details were flagged by the sender's
// name-match checkpoint (transactions.name_mismatch_by is the OTHER user).
// Offers the one-tap edit path and the explicit «исправлено» signal that
// clears the sender's freeze via resolve_recipient_name_mismatch.
type Props = {
  tx: TransactionWithProfiles;
  currentUserId: string;
  onResolved: () => void;
};

export function NameMismatchPanel({ tx, currentUserId, onResolved }: Props) {
  const supabase = createClient();
  const [editOpen, setEditOpen] = useState(false);
  const [pm, setPm] = useState<PaymentMethod | null>(null);
  const [pmLoading, setPmLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState(false);

  useBodyScrollLock(editOpen);

  // The flagged payout method is the one revealed to the reporter: the
  // initiator sends tx.amount_currency, the counterparty sends the other leg.
  const currency: Currency =
    tx.name_mismatch_by === tx.initiator_id
      ? tx.amount_currency
      : tx.amount_currency === "KZT"
        ? "KRW"
        : "KZT";

  const reporter =
    tx.name_mismatch_by === tx.initiator_id ? tx.initiator : tx.counterparty;
  const reporterName = reporter.display_name ?? "Контрагент";

  useEffect(() => {
    if (!editOpen) return;
    let cancelled = false;
    setPmLoading(true);
    void supabase
      .from("payment_methods")
      .select("*")
      .eq("user_id", currentUserId)
      .eq("currency", currency)
      .eq("is_default", true)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setPm((data as PaymentMethod | null) ?? null);
        setPmLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, editOpen, currentUserId, currency]);

  const resolve = async () => {
    setResolving(true);
    setError(false);
    const { error: rpcError } = await supabase.rpc(
      "resolve_recipient_name_mismatch",
      { p_transaction_id: tx.id },
    );
    setResolving(false);
    if (rpcError) {
      setError(true);
      return;
    }
    onResolved();
  };

  return (
    <div className="oz-mismatch" role="alert">
      <div className="oz-mismatch__title">Проверьте ваши реквизиты</div>
      <p className="oz-mismatch__copy">
        {reporterName} сообщил, что имя получателя не совпадает с вашими
        реквизитами ({currency}). Перевод приостановлен, пока вы не
        подтвердите исправление.
      </p>
      <div className="oz-mismatch__actions">
        <button
          type="button"
          className="oz-btn oz-btn--secondary"
          onClick={() => setEditOpen(true)}
          disabled={resolving}
        >
          Изменить реквизиты
        </button>
        <button
          type="button"
          className="oz-btn oz-btn--primary"
          onClick={resolve}
          disabled={resolving}
        >
          {resolving ? "Подтверждаем…" : "Готово, исправлено"}
        </button>
      </div>
      {error && (
        <p className="oz-mismatch__error">
          Не удалось подтвердить. Попробуйте ещё раз.
        </p>
      )}

      {editOpen &&
        createPortal(
          <>
            <div
              className="oz-sheet-scrim"
              onClick={() => setEditOpen(false)}
              aria-hidden
            />
            <div
              className="oz-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="oz-mismatch-edit-title"
            >
              <div className="oz-sheet__handle" />
              <h2 id="oz-mismatch-edit-title" className="oz-sheet__title">
                Реквизиты ({currency})
              </h2>
              <p className="oz-sheet__subtitle">
                Имя получателя должно совпадать с именем, зарегистрированным в
                банке — его видит отправитель при переводе.
              </p>
              {pmLoading ? (
                <p className="oz-pm__muted">Загрузка…</p>
              ) : (
                <PaymentMethodForm
                  currency={currency}
                  initial={pm}
                  onSaved={(saved) => {
                    setPm(saved);
                    setEditOpen(false);
                  }}
                  onCancel={() => setEditOpen(false)}
                />
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
