"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { useRate } from "./RateContext";
import { createClient } from "@/lib/supabase/client";
import { PaymentMethodGateSheet } from "@/components/PaymentMethodGateSheet";
import { formatAmountInput, formatRate, parseAmount } from "@/lib/format";
import {
  directionFrom,
  directionTo,
  type Currency,
  type Direction,
  type ListingInsert,
} from "@/lib/types";

const SYMBOL: Record<Currency, string> = { KZT: "₸", KRW: "₩" };

type SubmitPayload = Pick<
  ListingInsert,
  "direction" | "amount" | "amount_currency" | "rate" | "note"
>;

type Props = {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSubmit: (payload: SubmitPayload) => Promise<void>;
};

export function PostListingSheet({ open, userId, onClose, onSubmit }: Props) {
  const { data: rateData } = useRate();
  const supabase = createClient();
  const [paymentGateOpen, setPaymentGateOpen] = useState(false);
  const [direction, setDirection] = useState<Direction>("kzt_to_krw");
  const [amountStr, setAmountStr] = useState("");
  const [rateStr, setRateStr] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setAmountStr("");
      setRateStr("");
      setNote("");
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

  const from = directionFrom(direction);
  const to = directionTo(direction);
  const amount = parseAmount(amountStr);
  const rate = rateStr ? Number(rateStr.replace(",", ".")) : null;
  const canSubmit = amount > 0 && !submitting && (rate === null || rate > 0);

  const doSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        direction,
        amount,
        amount_currency: from,
        rate,
        note: note.trim() ? note.trim() : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось опубликовать");
      setSubmitting(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    // A user posting "exchange X to Y" must have a payment method for Y (the
    // currency they will RECEIVE) before the listing goes live.
    const { data: pm } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("user_id", userId)
      .eq("currency", to)
      .eq("is_default", true)
      .maybeSingle();
    if (!pm) {
      setSubmitting(false);
      setPaymentGateOpen(true);
      return;
    }
    await doSubmit();
  };

  return createPortal(
    <>
      <div className="oz-sheet-scrim" onClick={onClose} aria-hidden />
      <div
        className="oz-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oz-sheet-title"
      >
        <div className="oz-sheet__handle" />
        <h2 id="oz-sheet-title" className="oz-sheet__title">
          Новое объявление
        </h2>

        <form onSubmit={submit}>
          <div className="oz-sheet__field">
            <label className="oz-sheet__label">Направление</label>
            <div className="oz-segmented" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={direction === "kzt_to_krw"}
                className={`oz-segmented__btn${direction === "kzt_to_krw" ? " oz-segmented__btn--active" : ""}`}
                onClick={() => setDirection("kzt_to_krw")}
              >
                ₸ → ₩
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={direction === "krw_to_kzt"}
                className={`oz-segmented__btn${direction === "krw_to_kzt" ? " oz-segmented__btn--active" : ""}`}
                onClick={() => setDirection("krw_to_kzt")}
              >
                ₩ → ₸
              </button>
            </div>
          </div>

          <div className="oz-sheet__field">
            <label className="oz-sheet__label" htmlFor="oz-amount">
              Сумма
            </label>
            <div className="oz-input--withsuffix">
              <input
                id="oz-amount"
                className="oz-input font-mono"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={amountStr}
                onChange={(e) => setAmountStr(formatAmountInput(e.target.value))}
              />
              <span className="oz-input__suffix">{SYMBOL[from]}</span>
            </div>
          </div>

          <div className="oz-sheet__field">
            <label className="oz-sheet__label" htmlFor="oz-rate">
              Курс
            </label>
            <div className="oz-input--withsuffix">
              <input
                id="oz-rate"
                className="oz-input font-mono"
                inputMode="decimal"
                autoComplete="off"
                placeholder={
                  rateData ? formatRate(rateData.rate) : "по рынку"
                }
                value={rateStr}
                onChange={(e) => setRateStr(e.target.value.replace(/[^\d.,]/g, ""))}
              />
              <span className="oz-input__suffix">₩/₸</span>
            </div>
            <p className="oz-sheet__helper">
              Оставьте пустым для рыночного курса
            </p>
          </div>

          <div className="oz-sheet__field">
            <label className="oz-sheet__label" htmlFor="oz-note">
              Примечание
            </label>
            <textarea
              id="oz-note"
              className="oz-textarea"
              maxLength={280}
              placeholder="Например: только Kaspi, до 22:00"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <div className="oz-charcount">{note.length}/280</div>
          </div>

          {error && <p className="oz-sheet__error">{error}</p>}

          <button
            type="submit"
            disabled={!canSubmit}
            className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg"
          >
            {submitting ? "Публикация…" : "Опубликовать"}
          </button>
        </form>
      </div>

      <PaymentMethodGateSheet
        open={paymentGateOpen}
        currency={to}
        onReady={() => {
          setPaymentGateOpen(false);
          void doSubmit();
        }}
        onCancel={() => setPaymentGateOpen(false)}
      />
    </>,
    document.body,
  );
}
