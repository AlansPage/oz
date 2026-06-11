"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { createClient } from "@/lib/supabase/client";
import { useRate } from "@/components/feed/RateContext";
import {
  formatAmountInput,
  formatRate,
  parseAmount,
} from "@/lib/format";
import type { AlertSubscription, Direction } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  userId: string;
  defaultDirection: Direction | null;
  onCreated: (alert: AlertSubscription) => void;
};

const COOLDOWN_OPTIONS = [5, 15, 30, 60, 180, 360];

const SAVE_FAILED = "Не удалось создать оповещение. Попробуйте ещё раз.";

function fromCurrency(direction: Direction): "KZT" | "KRW" {
  return direction === "kzt_to_krw" ? "KZT" : "KRW";
}

export function AlertCreateSheet({
  open,
  onClose,
  userId,
  defaultDirection,
  onCreated,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const { data: rateData } = useRate();
  const [mounted, setMounted] = useState(false);
  const [direction, setDirection] = useState<Direction>(
    defaultDirection ?? "kzt_to_krw",
  );
  const [minStr, setMinStr] = useState("");
  const [maxStr, setMaxStr] = useState("");
  const [rateStr, setRateStr] = useState("");
  const [cooldown, setCooldown] = useState(30);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setDirection(defaultDirection ?? "kzt_to_krw");
      setMinStr("");
      setMaxStr("");
      setRateStr("");
      setCooldown(30);
      setError(null);
      setSubmitting(false);
    }
  }, [open, defaultDirection]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useBodyScrollLock(open);

  if (!open || !mounted) return null;

  const ccy = fromCurrency(direction);
  const ccySymbol = ccy === "KZT" ? "₸" : "₩";

  async function submit() {
    if (submitting) return;
    const amountMin = minStr ? parseAmount(minStr) : null;
    const amountMax = maxStr ? parseAmount(maxStr) : null;
    if (amountMin !== null && amountMax !== null && amountMin > amountMax) {
      setError("Минимум не может быть больше максимума.");
      return;
    }
    const rateParsed = rateStr ? Number(rateStr.replace(",", ".")) : null;
    if (rateParsed !== null && !Number.isFinite(rateParsed)) {
      setError("Неверный курс.");
      return;
    }

    setSubmitting(true);
    setError(null);
    const payload = {
      user_id: userId,
      direction,
      amount_min: amountMin,
      amount_max: amountMax,
      rate_better_than: rateParsed,
      cooldown_minutes: cooldown,
      active: true,
    };
    const { data, error: insertErr } = await supabase
      .from("alert_subscriptions")
      .insert(payload)
      .select("*")
      .single();

    setSubmitting(false);
    if (insertErr || !data) {
      setError(SAVE_FAILED);
      return;
    }
    onCreated(data as AlertSubscription);
    onClose();
  }

  return createPortal(
    <>
      <div className="oz-sheet-scrim" onClick={onClose} aria-hidden />
      <div
        className="oz-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oz-alert-create-title"
      >
        <div className="oz-sheet__handle" />
        <h2 id="oz-alert-create-title" className="oz-sheet__title">
          Новое оповещение
        </h2>

        <div className="oz-sheet__field">
          <label className="oz-sheet__label">Направление</label>
          <div className="oz-segmented">
            <button
              type="button"
              className={
                "oz-segmented__btn" +
                (direction === "kzt_to_krw" ? " oz-segmented__btn--active" : "")
              }
              onClick={() => setDirection("kzt_to_krw")}
            >
              ₸ → ₩
            </button>
            <button
              type="button"
              className={
                "oz-segmented__btn" +
                (direction === "krw_to_kzt" ? " oz-segmented__btn--active" : "")
              }
              onClick={() => setDirection("krw_to_kzt")}
            >
              ₩ → ₸
            </button>
          </div>
        </div>

        <div className="oz-sheet__field">
          <label className="oz-sheet__label">Сумма от (необязательно)</label>
          <div className="oz-input--withsuffix">
            <input
              type="text"
              inputMode="numeric"
              className="oz-input"
              placeholder="0"
              value={minStr}
              onChange={(e) => setMinStr(formatAmountInput(e.target.value))}
            />
            <span className="oz-input__suffix">{ccySymbol}</span>
          </div>
        </div>

        <div className="oz-sheet__field">
          <label className="oz-sheet__label">Сумма до (необязательно)</label>
          <div className="oz-input--withsuffix">
            <input
              type="text"
              inputMode="numeric"
              className="oz-input"
              placeholder="0"
              value={maxStr}
              onChange={(e) => setMaxStr(formatAmountInput(e.target.value))}
            />
            <span className="oz-input__suffix">{ccySymbol}</span>
          </div>
        </div>

        <div className="oz-sheet__field">
          <label className="oz-sheet__label">Курс не хуже (необязательно)</label>
          <input
            type="text"
            inputMode="decimal"
            className="oz-input"
            placeholder={
              rateData?.rate != null
                ? `Сейчас рынок: ${formatRate(rateData.rate)}`
                : "Оставьте пустым для любого курса"
            }
            value={rateStr}
            onChange={(e) => setRateStr(e.target.value)}
          />
          <p className="oz-sheet__helper">
            Оставьте пустым для любого курса.
          </p>
        </div>

        <div className="oz-sheet__field">
          <label className="oz-sheet__label">
            Пауза между уведомлениями
          </label>
          <select
            className="oz-input"
            value={cooldown}
            onChange={(e) => setCooldown(Number(e.target.value))}
          >
            {COOLDOWN_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m < 60
                  ? `${m} мин`
                  : `${m / 60} ч`}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="oz-sheet__error">{error}</p>}

        <div className="oz-confirm__actions">
          <button
            type="button"
            className="oz-btn oz-btn--ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Отмена
          </button>
          <button
            type="button"
            className="oz-btn oz-btn--primary"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "Создаём…" : "Создать"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
