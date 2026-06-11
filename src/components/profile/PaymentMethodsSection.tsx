"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { maskAccountNumber } from "@/lib/format";
import type { Currency, PaymentMethod } from "@/lib/types";
import { PaymentMethodForm } from "./PaymentMethodForm";

const CURRENCIES: Currency[] = ["KZT", "KRW"];
const LABEL: Record<Currency, string> = { KZT: "₸ KZT", KRW: "₩ KRW" };

type Props = {
  userId: string;
};

export function PaymentMethodsSection({ userId }: Props) {
  const supabase = createClient();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Currency>("KZT");
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("payment_methods")
      .select("*")
      .eq("user_id", userId)
      .then(({ data }) => {
        if (cancelled) return;
        setMethods(((data as PaymentMethod[] | null) ?? []).filter(Boolean));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  const current = methods.find(
    (m) => m.currency === active && m.is_default,
  );

  function selectTab(currency: Currency) {
    setActive(currency);
    setEditing(false);
  }

  function handleSaved(pm: PaymentMethod) {
    setMethods((prev) => {
      const rest = prev.filter(
        (m) => !(m.currency === pm.currency && m.is_default),
      );
      return [...rest, pm];
    });
    setEditing(false);
  }

  return (
    <div className="oz-pm">
      <div className="oz-profile__field-label">Реквизиты для приёма</div>
      <p className="oz-pm__help">
        Эти реквизиты увидит ваш контрагент после начала сделки. Платформа не
        хранит данные карты — только номер счёта или номер карты как вы их
        вводите.
      </p>

      <div className="oz-segmented" role="tablist">
        {CURRENCIES.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={active === c}
            className={`oz-segmented__btn${active === c ? " oz-segmented__btn--active" : ""}`}
            onClick={() => selectTab(c)}
          >
            {LABEL[c]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="oz-pm__muted">Загрузка…</p>
      ) : editing ? (
        <PaymentMethodForm
          currency={active}
          initial={current ?? null}
          onSaved={handleSaved}
          onCancel={() => setEditing(false)}
        />
      ) : current ? (
        <div className="oz-pm__card">
          <div className="oz-pm__row">
            <span className="oz-pm__row-label">Банк</span>
            <span className="oz-pm__row-value">{current.bank_name}</span>
          </div>
          <div className="oz-pm__row">
            <span className="oz-pm__row-label">Получатель</span>
            <span className="oz-pm__row-value">{current.recipient_name}</span>
          </div>
          <div className="oz-pm__row">
            <span className="oz-pm__row-label">Счёт / карта</span>
            <span className="oz-pm__row-value font-mono">
              {maskAccountNumber(current.account_number)}
            </span>
          </div>
          <button
            type="button"
            className="oz-profile__link"
            onClick={() => setEditing(true)}
          >
            Изменить
          </button>
        </div>
      ) : (
        <div className="oz-pm__empty">
          <p className="oz-pm__muted">
            Реквизиты в {active === "KZT" ? "тенге" : "вонах"} ещё не добавлены.
          </p>
          <button
            type="button"
            className="oz-btn oz-btn--secondary"
            onClick={() => setEditing(true)}
          >
            Добавить реквизиты
          </button>
        </div>
      )}
    </div>
  );
}
