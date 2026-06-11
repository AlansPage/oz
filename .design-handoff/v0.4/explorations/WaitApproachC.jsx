/* global React, SubmittedReceiptCard */
// Wait Approach C — Counterparty-focused.
// The counterparty card is at the top with a live-status indicator
// ("просматривает чек"). Read as: "the other person is actively working
// on this." Receipt sits below in a supporting role. Removes the abstract
// "system is waiting" feeling — replaces it with a specific human action.

function WaitApproachC() {
  return (
    <div className="tx-stage" style={{ paddingBottom: 24 }}>
      <div className="tx-topbar">
        <button className="tx-topbar__back" aria-label="Назад">←</button>
        <span className="tx-topbar__id">Сделка #abc123</span>
      </div>

      <div className="tx-statusline">
        <span className="tx-statusline__dot"></span>
        <span>Чек получен · ожидаем подтверждения</span>
      </div>

      <div className="tx-card tx-party-card tx-party-card--lg" style={{ padding: 20, alignItems: "flex-start" }}>
        <div className="tx-party-card__avatar">А</div>
        <div className="tx-party-card__identity">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div className="tx-party-card__name">Айгерим К.</div>
            <span className="oz-vbadge oz-vbadge--id">ID</span>
          </div>
          <div className="tx-party-card__meta" style={{ marginTop: 4 }}>
            ★ 4,9 · 23 сделки
          </div>
          <div className="tx-party-card__status">просматривает чек</div>
        </div>
      </div>

      <SubmittedReceiptCard compact />

      <div className="tx-card tx-card--tight" style={{ gap: 6 }}>
        <div className="tx-money-row">
          <span className="tx-money-row__label">Вы получаете</span>
          <span className="tx-money-row__value" style={{ fontSize: 18 }}>2 392 500 ₩</span>
        </div>
        <div className="tx-money-sub">
          курс 3,19 · зафикс. на сделку
        </div>
      </div>

      <p className="tx-bank-helper" style={{ padding: "0 20px", textAlign: "center" }}>
        Обычно подтверждение занимает 2–8 минут. Если контрагент долго не отвечает, мы отправим напоминание.
      </p>

      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <button className="tx-actions__ghost-link" style={{ alignSelf: "center" }}>
          Сообщить о проблеме
        </button>
      </div>
    </div>
  );
}

window.WaitApproachC = WaitApproachC;
