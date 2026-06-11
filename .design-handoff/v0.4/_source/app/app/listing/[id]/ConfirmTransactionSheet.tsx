"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useRate } from "@/components/feed/RateContext";
import {
  equivalentAmount,
  formatAmount,
  formatRate,
} from "@/lib/format";
import {
  directionFrom,
  directionTo,
  type Currency,
  type Direction,
  type ListingWithProfile,
  type TransactionInsert,
} from "@/lib/types";

const SYMBOL: Record<Currency, string> = { KZT: "₸", KRW: "₩" };

type Props = {
  open: boolean;
  onClose: () => void;
  listing: ListingWithProfile;
  currentUserId: string;
};

export function ConfirmTransactionSheet({
  open,
  onClose,
  listing,
  currentUserId,
}: Props) {
  const router = useRouter();
  const supabase = createClient();
  const { data: rateData } = useRate();
  const [mounted, setMounted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setError(null);
      setSubmitting(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const direction = listing.direction as Direction;
  const from = directionFrom(direction);
  const to = directionTo(direction);
  const amount = Number(listing.amount);
  const listingRate = listing.rate !== null ? Number(listing.rate) : null;
  const marketRate = rateData?.rate ?? null;
  const lockedRate = listingRate ?? marketRate;
  const equivalent =
    lockedRate !== null
      ? equivalentAmount(amount, from, lockedRate, listingRate)
      : null;

  const confirm = async () => {
    setSubmitting(true);
    setError(null);
    const payload: TransactionInsert = {
      listing_id: listing.id,
      initiator_id: currentUserId,
      counterparty_id: listing.user_id,
      direction,
      amount,
      amount_currency: from,
      rate: lockedRate,
    };
    const { data, error: insertError } = await supabase
      .from("transactions")
      .insert(payload)
      .select("id")
      .single();

    if (insertError || !data) {
      setSubmitting(false);
      setError(insertError?.message ?? "Не удалось создать сделку");
      return;
    }
    router.push(`/transaction/${(data as { id: string }).id}`);
  };

  return createPortal(
    <>
      <div className="oz-sheet-scrim" onClick={onClose} aria-hidden />
      <div
        className="oz-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oz-confirm-title"
      >
        <div className="oz-sheet__handle" />
        <h2 id="oz-confirm-title" className="oz-sheet__title">
          Подтвердите начало сделки
        </h2>

        <div className="oz-confirm__summary">
          <div className="oz-confirm__summary-row">
            <span>Направление</span>
            <span>
              {SYMBOL[from]} → {SYMBOL[to]}
            </span>
          </div>
          <div className="oz-confirm__summary-amount">
            {formatAmount(amount, from)}
          </div>
          <div className="oz-confirm__summary-row">
            <span>Курс</span>
            <span>{lockedRate !== null ? formatRate(lockedRate) : "—"}</span>
          </div>
          {equivalent !== null && (
            <div className="oz-confirm__summary-row">
              <span>≈ к получению</span>
              <span>{formatAmount(equivalent, to)}</span>
            </div>
          )}
        </div>

        {error && <p className="oz-sheet__error">{error}</p>}

        <div className="oz-confirm__actions">
          <button
            className="oz-btn oz-btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Отмена
          </button>
          <button
            className="oz-btn oz-btn--primary"
            onClick={confirm}
            disabled={submitting || lockedRate === null}
          >
            {submitting ? "Создаём…" : "Подтвердить"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
