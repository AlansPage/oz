/* global React, SubmittedReceiptCard, ProgressStepper */
// Wait Approach B — Progress-state hero.
// A vertical stepper at the top makes the 4-stage transaction process
// legible: created → receipt sent (current) → confirmation → completed.
// The current step uses a breathing primary-soft ring so it reads as
// active. Receipt sits below in a compact role.

function WaitApproachB() {
  const steps = [
    { state: "done", title: "Сделка создана", time: "14:31" },
    { state: "done", title: "Чек отправлен", time: "14:34" },
    {
      state: "current",
      title: "Подтверждение получения",
      sub: "Контрагент проверяет поступление в своём банке. Обычно 2–8 минут.",
    },
    { state: "pending", title: "Сделка завершена" },
  ];

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

      <ProgressStepper steps={steps} />

      <SubmittedReceiptCard compact />

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

window.WaitApproachB = WaitApproachB;
