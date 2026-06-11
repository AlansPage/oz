"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { formatAmountInput, parseAmount } from "@/lib/format";
import type { Currency, ReceiptSide } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  uploaderId: string;
  side: ReceiptSide;
  expectedAmount: number;
  currency: Currency;
  onUploaded: () => void;
};

const SYMBOL: Record<Currency, string> = { KZT: "₸", KRW: "₩" };

const EXT_FROM_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

function extFor(file: File): string {
  return (
    EXT_FROM_TYPE[file.type] ??
    file.name.split(".").pop()?.toLowerCase() ??
    "bin"
  );
}

const ACTION_FOR_SIDE: Record<ReceiptSide, string> = {
  initiator: "initiator_mark_paid",
  counterparty: "counterparty_mark_paid",
};

export function ReceiptUploadSheet({
  open,
  onClose,
  transactionId,
  uploaderId,
  side,
  expectedAmount,
  currency,
  onUploaded,
}: Props) {
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [amountStr, setAmountStr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (open) {
      setAmountStr(formatAmountInput(String(Math.round(expectedAmount))));
    } else {
      setFile(null);
      setAmountStr("");
      setError(null);
      setSubmitting(false);
    }
  }, [open, expectedAmount]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const submit = async () => {
    if (!file) return;
    setSubmitting(true);
    setError(null);
    const path = `${transactionId}/${side}_${Date.now()}.${extFor(file)}`;

    const { error: uploadErr } = await supabase.storage
      .from("receipts")
      .upload(path, file, { contentType: file.type });
    if (uploadErr) {
      setSubmitting(false);
      setError(uploadErr.message);
      return;
    }

    const { error: insertErr } = await supabase.from("receipts").insert({
      transaction_id: transactionId,
      uploader_id: uploaderId,
      storage_path: path,
      side,
      amount_claimed: parseAmount(amountStr) || null,
      currency,
    });
    if (insertErr) {
      setSubmitting(false);
      setError(insertErr.message);
      return;
    }

    const { error: rpcErr } = await supabase.rpc("advance_transaction", {
      p_transaction_id: transactionId,
      p_action: ACTION_FOR_SIDE[side],
    });
    if (rpcErr) {
      setSubmitting(false);
      setError(rpcErr.message);
      return;
    }

    onUploaded();
    onClose();
  };

  return createPortal(
    <>
      <div className="oz-sheet-scrim" onClick={onClose} aria-hidden />
      <div
        className="oz-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oz-upload-title"
      >
        <div className="oz-sheet__handle" />
        <h2 id="oz-upload-title" className="oz-sheet__title">
          Загрузите чек об отправке
        </h2>
        <p className="oz-sheet__helper" style={{ marginTop: -8, marginBottom: 16 }}>
          Скриншот из Kaspi / банковского приложения. Время, сумма и получатель
          должны быть видны.
        </p>

        <div className="oz-sheet__field">
          <label className="oz-sheet__label" htmlFor="oz-receipt-file">
            Файл чека
          </label>
          <input
            id="oz-receipt-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            capture="environment"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            disabled={submitting}
          />
          {file && (
            <p className="oz-sheet__helper">
              Выбран: {file.name} ({Math.round(file.size / 1024)} КБ)
            </p>
          )}
        </div>

        <div className="oz-sheet__field">
          <label className="oz-sheet__label" htmlFor="oz-receipt-amount">
            Сумма перевода
          </label>
          <div className="oz-input--withsuffix">
            <input
              id="oz-receipt-amount"
              className="oz-input font-mono"
              inputMode="decimal"
              autoComplete="off"
              value={amountStr}
              onChange={(e) => setAmountStr(formatAmountInput(e.target.value))}
              disabled={submitting}
            />
            <span className="oz-input__suffix">{SYMBOL[currency]}</span>
          </div>
        </div>

        {error && <p className="oz-sheet__error">{error}</p>}

        <p className="oz-sheet__helper" style={{ fontStyle: "italic" }}>
          Чек хранится зашифрованным и доступен только сторонам сделки.
        </p>

        <button
          className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg"
          onClick={submit}
          disabled={!file || submitting}
        >
          {submitting ? "Отправляем…" : "Отправить чек"}
        </button>
      </div>
    </>,
    document.body,
  );
}
