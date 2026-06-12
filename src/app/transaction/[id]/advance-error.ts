// Server-side rejections from advance_transaction. The client gates
// affordances by status, so most codes are unreachable through the UI —
// only codes a user can legitimately hit get human copy, the rest fall
// through raw so they stay diagnosable.
export function advanceErrorMessage(raw: string | undefined): string {
  switch (raw) {
    case "name_mismatch_frozen":
      return "Сделка приостановлена из-за несовпадения имени. Дождитесь исправления реквизитов или отмените сделку.";
    default:
      return raw ?? "Не удалось выполнить действие. Попробуйте ещё раз.";
  }
}
