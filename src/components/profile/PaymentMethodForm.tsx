"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Currency, PaymentMethod } from "@/lib/types";

const SAVE_FAILED = "Не удалось сохранить реквизиты. Попробуйте ещё раз.";

type Props = {
  userId: string;
  currency: Currency;
  initial?: PaymentMethod | null;
  onSaved: (pm: PaymentMethod) => void;
  onCancel: () => void;
};

export function PaymentMethodForm({
  userId,
  currency,
  initial,
  onSaved,
  onCancel,
}: Props) {
  const supabase = createClient();
  const [bankName, setBankName] = useState(initial?.bank_name ?? "");
  const [holderName, setHolderName] = useState(initial?.holder_name ?? "");
  const [accountNumber, setAccountNumber] = useState(
    initial?.account_number ?? "",
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const bank = bankName.trim();
  const holder = holderName.trim();
  const account = accountNumber.trim();
  const canSubmit =
    bank.length >= 1 &&
    bank.length <= 80 &&
    holder.length >= 1 &&
    holder.length <= 120 &&
    account.length >= 4 &&
    account.length <= 40 &&
    !saving;

  async function save() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);

    // Resolve the existing default row for this currency, if any.
    let existingId = initial?.id ?? null;
    if (!existingId) {
      const { data: existing } = await supabase
        .from("payment_methods")
        .select("id")
        .eq("user_id", userId)
        .eq("currency", currency)
        .eq("is_default", true)
        .maybeSingle();
      existingId = (existing as { id: string } | null)?.id ?? null;
    }

    const fields = {
      bank_name: bank,
      holder_name: holder,
      account_number: account,
    };

    const query = existingId
      ? supabase.from("payment_methods").update(fields).eq("id", existingId)
      : supabase.from("payment_methods").insert({
          user_id: userId,
          currency,
          is_default: true,
          ...fields,
        });

    const { data, error: saveError } = await query.select().single();
    setSaving(false);

    if (saveError || !data) {
      setError(SAVE_FAILED);
      return;
    }
    onSaved(data as PaymentMethod);
  }

  return (
    <div className="oz-pm-form">
      <div className="oz-sheet__field">
        <label className="oz-sheet__label" htmlFor="oz-pm-bank">
          Банк
        </label>
        <input
          id="oz-pm-bank"
          type="text"
          className="oz-input"
          placeholder={currency === "KZT" ? "Kaspi Gold" : "Toss Bank"}
          value={bankName}
          maxLength={80}
          onChange={(e) => setBankName(e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="oz-sheet__field">
        <label className="oz-sheet__label" htmlFor="oz-pm-holder">
          Получатель
        </label>
        <input
          id="oz-pm-holder"
          type="text"
          className="oz-input"
          placeholder="Имя владельца счёта"
          value={holderName}
          maxLength={120}
          onChange={(e) => setHolderName(e.target.value)}
          disabled={saving}
        />
      </div>

      <div className="oz-sheet__field">
        <label className="oz-sheet__label" htmlFor="oz-pm-account">
          Номер счёта или карты
        </label>
        <input
          id="oz-pm-account"
          type="text"
          className="oz-input font-mono"
          inputMode="numeric"
          autoComplete="off"
          placeholder={currency === "KZT" ? "4400 4302 1234 5678" : "1000-0000-0000"}
          value={accountNumber}
          maxLength={40}
          onChange={(e) => setAccountNumber(e.target.value)}
          disabled={saving}
        />
      </div>

      {error && <p className="oz-sheet__error">{error}</p>}

      <div className="oz-confirm__actions">
        <button
          type="button"
          className="oz-btn oz-btn--ghost"
          onClick={onCancel}
          disabled={saving}
        >
          Отмена
        </button>
        <button
          type="button"
          className="oz-btn oz-btn--primary"
          onClick={save}
          disabled={!canSubmit}
        >
          {saving ? "Сохраняем…" : "Сохранить"}
        </button>
      </div>
    </div>
  );
}
