"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";
import { bankByCode, banksFor } from "@/lib/banks";
import { accountNumberError } from "@/lib/payment-validation";
import type { Currency, PaymentMethod } from "@/lib/types";

const SAVE_FAILED = "Не удалось сохранить реквизиты. Попробуйте ещё раз.";

// Server-side rejections from upsert_payment_method. The client validates
// first, so hitting these means the two validators disagree (or the client
// was bypassed) — keep the copy generic but actionable.
function rpcErrorMessage(raw: string | undefined): string {
  switch (raw) {
    case "invalid_account_number":
      return "Номер не проходит проверку. Проверьте цифры.";
    case "invalid_holder_name":
      return "Укажите имя получателя.";
    case "invalid_bank_code":
    case "invalid_bank_name":
      return "Выберите банк из списка или укажите название.";
    default:
      return SAVE_FAILED;
  }
}

// "other" = «Другой банк» escape hatch (free-text bank name, bank_code null).
type BankSelection = string | "other" | null;

type Props = {
  currency: Currency;
  initial?: PaymentMethod | null;
  onSaved: (pm: PaymentMethod) => void;
  onCancel: () => void;
};

export function PaymentMethodForm({
  currency,
  initial,
  onSaved,
  onCancel,
}: Props) {
  const supabase = createClient();
  const [bankSel, setBankSel] = useState<BankSelection>(() => {
    if (initial?.bank_code) return initial.bank_code;
    if (initial?.bank_name) return "other";
    return null;
  });
  const [customBank, setCustomBank] = useState(
    initial?.bank_code ? "" : (initial?.bank_name ?? ""),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [holderName, setHolderName] = useState(initial?.holder_name ?? "");
  const [accountNumber, setAccountNumber] = useState(
    initial?.account_number ?? "",
  );
  const [accountError, setAccountError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useBodyScrollLock(pickerOpen);

  const banks = banksFor(currency);
  const selectedBank = bankSel !== "other" ? bankByCode(bankSel) : null;
  const isOther = bankSel === "other";

  const customBankTrimmed = customBank.trim();
  const holder = holderName.trim();
  const account = accountNumber.trim();
  const bankChosen =
    selectedBank !== null ||
    (isOther && customBankTrimmed.length >= 1 && customBankTrimmed.length <= 80);
  const canSubmit =
    bankChosen &&
    holder.length >= 1 &&
    holder.length <= 120 &&
    account.length >= 4 &&
    account.length <= 40 &&
    !saving;

  function pickBank(sel: BankSelection) {
    setBankSel(sel);
    setAccountError(null);
    setPickerOpen(false);
  }

  async function save() {
    if (!canSubmit) return;

    // Structural per-rail check (Luhn / IBAN mod-97 / KRW shapes); the server
    // mirrors it in upsert_payment_method, this is the friendly first line.
    const numberError = accountNumberError(
      currency,
      selectedBank?.code ?? null,
      account,
    );
    if (numberError) {
      setAccountError(numberError);
      return;
    }

    setSaving(true);
    setError(null);

    const { data, error: saveError } = await supabase.rpc(
      "upsert_payment_method",
      {
        p_currency: currency,
        p_bank_code: selectedBank?.code ?? null,
        p_bank_name: isOther ? customBankTrimmed : null,
        p_holder_name: holder,
        p_account_number: account,
      },
    );
    setSaving(false);

    if (saveError || !data) {
      setError(rpcErrorMessage(saveError?.message));
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
        <button
          id="oz-pm-bank"
          type="button"
          className={`oz-input oz-bankpicker${selectedBank || isOther ? "" : " oz-bankpicker--placeholder"}`}
          onClick={() => setPickerOpen(true)}
          disabled={saving}
        >
          <span>
            {selectedBank?.label ?? (isOther ? "Другой банк" : "Выберите банк")}
          </span>
          <span className="oz-bankpicker__chevron" aria-hidden>
            ▾
          </span>
        </button>
      </div>

      {isOther && (
        <div className="oz-sheet__field">
          <label className="oz-sheet__label" htmlFor="oz-pm-bank-custom">
            Название банка
          </label>
          <input
            id="oz-pm-bank-custom"
            type="text"
            className="oz-input"
            placeholder="Название банка"
            value={customBank}
            maxLength={80}
            onChange={(e) => setCustomBank(e.target.value)}
            disabled={saving}
          />
        </div>
      )}

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
          className={`oz-input font-mono${accountError ? " is-error" : ""}`}
          inputMode="numeric"
          autoComplete="off"
          placeholder={currency === "KZT" ? "4400 4302 1234 5678" : "1000-0000-0000"}
          value={accountNumber}
          maxLength={40}
          onChange={(e) => {
            setAccountNumber(e.target.value);
            setAccountError(null);
          }}
          disabled={saving}
          aria-invalid={accountError !== null}
        />
        {accountError && <p className="oz-field-error">{accountError}</p>}
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

      {pickerOpen &&
        createPortal(
          <>
            <div
              className="oz-sheet-scrim oz-sheet-scrim--stacked"
              onClick={() => setPickerOpen(false)}
              aria-hidden
            />
            <div
              className="oz-sheet oz-sheet--stacked"
              role="dialog"
              aria-modal="true"
              aria-labelledby="oz-bankpicker-title"
            >
              <div className="oz-sheet__handle" />
              <h2 id="oz-bankpicker-title" className="oz-sheet__title">
                Банк ({currency})
              </h2>
              <div className="oz-banklist" role="listbox">
                {banks.map((b) => (
                  <button
                    key={b.code}
                    type="button"
                    role="option"
                    aria-selected={bankSel === b.code}
                    className={`oz-banklist__item${bankSel === b.code ? " oz-banklist__item--active" : ""}`}
                    onClick={() => pickBank(b.code)}
                  >
                    {b.label}
                  </button>
                ))}
                <button
                  type="button"
                  role="option"
                  aria-selected={isOther}
                  className={`oz-banklist__item oz-banklist__item--other${isOther ? " oz-banklist__item--active" : ""}`}
                  onClick={() => pickBank("other")}
                >
                  Другой банк
                </button>
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
