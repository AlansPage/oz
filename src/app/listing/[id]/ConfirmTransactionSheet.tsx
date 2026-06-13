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
  formatAmountInput,
  formatRate,
  parseAmount,
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
    case "first_deal_limit_exceeded":
      return `Для новых участников лимит первой сделки — ${formatAmount(500_000, "KZT")}.`;
    case "payment_method_too_new":
      return "Реквизиты были изменены недавно. Сделки возможны через 24 часа после изменения.";
    case "fill_exceeds_remaining":
      return "Сумма больше, чем осталось по объявлению. Обновите страницу.";
    case "fill_below_minimum":
      return "Сумма меньше минимальной для этого объявления.";
    case "fill_invalid":
      return "Введите корректную сумму обмена.";
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
  const [fillStr, setFillStr] = useState("");

  useEffect(() => setMounted(true), []);

  // Default the fill input to the whole remaining each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    const posted = Number(listing.amount);
    const rem =
      listing.remaining_amount === null
        ? posted
        : Number(listing.remaining_amount);
    setFillStr(formatAmountInput(String(rem)));
  }, [open, listing]);

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
  const posted = Number(listing.amount);
  // remaining_amount is the trigger cache (null = pre-feature listing = full).
  const remaining =
    listing.remaining_amount === null
      ? posted
      : Number(listing.remaining_amount);
  const minMatch =
    listing.min_match_amount === null ? null : Number(listing.min_match_amount);
  // Only show the fill input when the listing is divisible inventory: partially
  // filled, or the dealer set a minimum. Otherwise the one-tap flow is unchanged.
  const needsFill = remaining < posted || minMatch !== null;
  const fillAmount = needsFill ? parseAmount(fillStr) : remaining;

  // Client-side mirror of the server rules in create_transaction; the server
  // stays authoritative. Clearing the entire remaining is always allowed even
  // when it falls below the minimum.
  let fillError: string | null = null;
  if (needsFill) {
    if (!(fillAmount > 0)) {
      fillError = "Введите сумму обмена";
    } else if (fillAmount > remaining) {
      fillError = `Доступно не больше ${formatAmount(remaining, from)}`;
    } else if (
      minMatch !== null &&
      fillAmount < minMatch &&
      fillAmount !== remaining
    ) {
      fillError = `Минимальная сумма обмена — ${formatAmount(minMatch, from)}`;
    }
  }

  const listingRate = listing.rate !== null ? Number(listing.rate) : null;
  const marketRate = rateData?.rate ?? null;
  const lockedRate = listingRate ?? marketRate;
  const equivalent =
    lockedRate !== null
      ? equivalentAmount(fillAmount, from, lockedRate, listingRate)
      : null;

  const confirm = async () => {
    if (needsFill && fillError) return;
    setSubmitting(true);
    setError(null);
    // Server derives counterparty/currency/direction from the listing and is the
    // authority on the fill (a fresh sum under the lock). We pass the fill only
    // when the listing is divisible; a full taker sends null = whole remaining.
    const { data, error: rpcError } = await supabase.rpc("create_transaction", {
      p_listing_id: listing.id,
      p_rate: lockedRate,
      p_fill_amount: needsFill ? fillAmount : null,
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

        {needsFill && (
          <div className="oz-sheet__field">
            <label className="oz-sheet__label" htmlFor="oz-fill">
              Сумма обмена
            </label>
            <div className="oz-input--withsuffix">
              <input
                id="oz-fill"
                className="oz-input font-mono"
                inputMode="decimal"
                autoComplete="off"
                value={fillStr}
                onChange={(e) => setFillStr(formatAmountInput(e.target.value))}
              />
              <span className="oz-input__suffix">{SYMBOL[from]}</span>
            </div>
            <p className="oz-sheet__helper">
              Доступно {formatAmount(remaining, from)}
              {minMatch !== null
                ? `, минимум ${formatAmount(minMatch, from)}`
                : ""}
            </p>
            {fillError && <p className="oz-sheet__error">{fillError}</p>}
          </div>
        )}

        <div className="oz-confirm__summary">
          <div className="oz-confirm__summary-row">
            <span>Направление</span>
            <span>
              {SYMBOL[from]} → {SYMBOL[to]}
            </span>
          </div>
          <div className="oz-confirm__summary-amount">
            {formatAmount(fillAmount, from)}
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
            disabled={
              submitting ||
              lockedRate === null ||
              (needsFill && fillError !== null)
            }
          >
            {submitting ? "Создаём…" : "Подтвердить"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
