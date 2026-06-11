"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { createClient } from "@/lib/supabase/client";
import type { DisputeReason } from "@/lib/types";

const REASONS: { value: DisputeReason; label: string }[] = [
  { value: "not_received", label: "Не получил деньги" },
  { value: "wrong_amount", label: "Неверная сумма" },
  { value: "wrong_account", label: "Неверный счёт" },
  { value: "other", label: "Другое" },
];

const MAX_DESCRIPTION = 1000;

type Props = {
  open: boolean;
  onClose: () => void;
  transactionId: string;
  onOpened: () => void;
};

export function DisputeSheet({
  open,
  onClose,
  transactionId,
  onOpened,
}: Props) {
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  const [reason, setReason] = useState<DisputeReason>("not_received");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setReason("not_received");
      setDescription("");
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

  const canSubmit = description.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: rpcErr } = await supabase.rpc("open_dispute", {
      p_transaction_id: transactionId,
      p_reason: reason,
      p_description: description.trim(),
    });
    if (rpcErr) {
      setSubmitting(false);
      setError(rpcErr.message);
      return;
    }
    onOpened();
    onClose();
  };

  return createPortal(
    <>
      <div className="oz-sheet-scrim" onClick={onClose} aria-hidden />
      <div
        className="oz-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oz-dispute-title"
      >
        <div className="oz-sheet__handle" />
        <h2 id="oz-dispute-title" className="oz-sheet__title">
          Сообщить о проблеме
        </h2>

        <div className="oz-sheet__field">
          <label className="oz-sheet__label">Причина</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {REASONS.map((r) => (
              <label
                key={r.value}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                <input
                  type="radio"
                  name="dispute-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  disabled={submitting}
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div className="oz-sheet__field">
          <label className="oz-sheet__label" htmlFor="oz-dispute-desc">
            Опишите проблему
          </label>
          <textarea
            id="oz-dispute-desc"
            className="oz-textarea"
            maxLength={MAX_DESCRIPTION}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={submitting}
          />
          <div className="oz-charcount">
            {description.length}/{MAX_DESCRIPTION}
          </div>
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
            onClick={submit}
            disabled={!canSubmit}
          >
            {submitting ? "Отправляем…" : "Отправить"}
          </button>
        </div>
      </div>
    </>,
    document.body,
  );
}
