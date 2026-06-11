"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
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
} from "@/lib/types";

const SYMBOL: Record<Currency, string> = { KZT: "₸", KRW: "₩" };

// Maps the RPC's raise-exception codes to user-facing Russian copy.
function createErrorMessage(raw: string | undefined): string {
  switch (raw) {
    case "counterparty_no_payment_method":
      return "У этого пользователя пока нет реквизитов для получения оплаты. Сделка невозможна.";
    case "listing_not_available":
      return "Это объявление больше недоступно.";
    case "cannot_transact_own_listing":
      return "Нельзя начать сделку по собственному объявлению.";
    default:
      return "Не удалось создать сделку";
  }
}

type Props = {
  open: boolean;
  onClose: () => void;
  listing: ListingWithProfile;
};

export function ConfirmTransactionSheet({ open, onClose, listing }: Props) {
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

  useBodyScrollLock(open);

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
    // Server derives counterparty/amount/currency/direction from the listing;
    // only the locked display rate is passed through (see create_transaction).
    const { data, error: rpcError } = await supabase.rpc("create_transaction", {
      p_listing_id: listing.id,
      p_rate: lockedRate,
    });

    if (rpcError || !data) {
      setSubmitting(false);
      setError(createErrorMessage(rpcError?.message));
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
