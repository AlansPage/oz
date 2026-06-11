"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import type { Currency } from "@/lib/types";
import { PaymentMethodForm } from "@/components/profile/PaymentMethodForm";

type Props = {
  open: boolean;
  userId: string;
  currency: Currency;
  onReady: () => void;
  onCancel: () => void;
};

export function PaymentMethodGateSheet({
  open,
  userId,
  currency,
  onReady,
  onCancel,
}: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useBodyScrollLock(open);

  if (!open || !mounted) return null;

  return createPortal(
    // Scrim has no onClick: the gate is non-dismissible by backdrop. The only
    // way out is saving (→ onReady) or the form's Отмена (→ onCancel, which
    // aborts the whole flow without creating anything).
    <>
      <div className="oz-sheet-scrim" aria-hidden />
      <div
        className="oz-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oz-pm-gate-title"
      >
        <div className="oz-sheet__handle" />
        <h2 id="oz-pm-gate-title" className="oz-sheet__title">
          Добавьте реквизиты для приёма
        </h2>
        <p className="oz-sheet__subtitle">
          Чтобы получить {currency}, добавьте номер счёта или карты, на которые
          контрагент отправит средства. Платформа не хранит данные карты.
        </p>

        <PaymentMethodForm
          userId={userId}
          currency={currency}
          onSaved={onReady}
          onCancel={onCancel}
        />
      </div>
    </>,
    document.body,
  );
}
