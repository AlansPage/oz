/* global React, SubmittedReceiptCard, WaitingPulse */
// Wait Approach A — Receipt as hero.
// The submitted receipt is the most prominent element after the status
// banner. The waiting pulse sits below as a calm "you are seen, taking
// our time" footer. Counterparty + money summary are compact identifier
// rows. Read as: "look — the platform has captured your receipt."

function WaitApproachA() {
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

      <SubmittedReceiptCard />

      <div className="tx-card tx-card--tight" style={{ gap: 6 }}>
        <div className="tx-money-row">
          <span className="tx-money-row__label">Вы получаете</span>
          <span className="tx-money-row__value" style={{ fontSize: 18 }}>2 392 500 ₩</span>
        </div>
        <div className="tx-money-sub">
          от Айгерим К. <span className="tx-vbadge-inline">ID</span>{" "}
          <span className="mono">· курс 3,19</span>
        </div>
      </div>

      <WaitingPulse hero />

      <p className="tx-bank-helper" style={{ padding: "0 20px", textAlign: "center" }}>
        Если контрагент долго не отвечает, мы отправим напоминание.
      </p>

      <div style={{ padding: "16px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <button className="tx-actions__ghost-link" style={{ alignSelf: "center" }}>
          Сообщить о проблеме
        </button>
      </div>
    </div>
  );
}

window.WaitApproachA = WaitApproachA;
