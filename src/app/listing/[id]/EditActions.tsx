"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseAmount } from "@/lib/format";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import type { ListingWithProfile } from "@/lib/types";
import type { EditForm } from "./ListingDetailClient";

type Props = {
  listing: ListingWithProfile;
  editForm: EditForm;
  onSaved: (updated: ListingWithProfile) => void;
  onWithdrawn: () => void;
};

export function EditActions({ listing, editForm, onSaved, onWithdrawn }: Props) {
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const amount = parseAmount(editForm.amountStr);
    if (amount <= 0) {
      setError("Укажите сумму");
      return;
    }
    const rate = editForm.rateStr
      ? Number(editForm.rateStr.replace(",", "."))
      : null;
    if (rate !== null && !(rate > 0)) {
      setError("Курс должен быть больше нуля");
      return;
    }

    setBusy(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("listings")
      .update({
        amount,
        rate,
        note: editForm.note.trim() ? editForm.note.trim() : null,
      })
      .eq("id", listing.id)
      .select(`*, profiles(${PROFILE_COLUMNS})`)
      .single();

    setBusy(false);
    if (updateError || !data) {
      setError(updateError?.message ?? "Не удалось сохранить");
      return;
    }
    onSaved(data as unknown as ListingWithProfile);
  };

  const withdraw = async () => {
    if (!confirm("Снять объявление?")) return;
    setBusy(true);
    const { error: updateError } = await supabase
      .from("listings")
      .update({ status: "withdrawn" })
      .eq("id", listing.id);
    setBusy(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    onWithdrawn();
  };

  return (
    <div className="oz-listing-actions">
      {error && <p className="oz-sheet__error">{error}</p>}
      <button
        className="oz-btn oz-btn--primary oz-btn--lg oz-btn--full"
        onClick={save}
        disabled={busy}
      >
        {busy ? "Сохранение…" : "Сохранить"}
      </button>
      <button
        className="oz-btn oz-btn--ghost oz-btn--full"
        onClick={withdraw}
        disabled={busy}
      >
        Снять объявление
      </button>
    </div>
  );
}
