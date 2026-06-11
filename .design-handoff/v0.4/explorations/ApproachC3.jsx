/* global React, KaspiReceiptMock */
// Approach C3 — receipt-as-hero with time-since-sent patience.
// Builds on C. Adds:
//   1. A time-since-sent pill on the status line ("12 минут назад"). At <5m
//      it's a calm green pill; at ≥10m it switches to a warm warning tone.
//   2. A patience callout above the sticky bottom bar when elapsed is high,
//      offering the user a calm reason NOT to confirm yet if the deposit
//      hasn't shown up — "проверьте банкомат у контрагента, банковские
//      задержки случаются."
// The CTA stays as a single primary button — adding patience, not friction.

function ApproachC3() {
  return (
    <div className="tx-stage" style={{ paddingBottom: 0 }}>
      <div className="tx-topbar">
        <button className="tx-topbar__back" aria-label="Назад">←</button>
        <span className="tx-topbar__id">Сделка #abc123</span>
      </div>

      <div className="tx-statusline" style={{ paddingBottom: 12 }}>
        <span className="tx-statusline__dot"></span>
        <span>Контрагент отправил перевод</span>
        <span className="tx-elapsed tx-elapsed--warn">12 мин назад</span>
        <span className="tx-statusline__time" style={{ marginLeft: "auto" }}>15:42</span>
      </div>

      <div className="tx-card" style={{ padding: 0, overflow: "hidden", gap: 0 }}>
        <div className="tx-receipt__thumb tx-receipt__thumb--xl" style={{ borderRadius: "var(--r-lg)", border: 0 }}>
          <KaspiReceiptMock />
        </div>
      </div>

      <div className="tx-card tx-card--tight" style={{ gap: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 500 }}>Вы получаете</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 22, fontWeight: 600, color: "var(--text)", letterSpacing: "-0.01em" }}>2 392 500 ₩</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>от Айгерим К. <span className="tx-vbadge-inline">ID</span></span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-3)" }}>750 000 ₸ · 3,19</span>
        </div>
      </div>

      <div className="tx-patience">
        <span className="tx-patience__dot"></span>
        <div>
          <strong>Не пришло ещё?</strong> Банковские задержки иногда случаются. Попросите контрагента уточнить статус в Kaspi или подождите пару минут. Не подтверждайте получение, пока деньги не появятся в вашем банке.
        </div>
      </div>

      <div className="tx-stickybar">
        <button className="tx-actions__primary">Я получил перевод</button>
        <button className="tx-actions__ghost">Сообщить о проблеме</button>
      </div>
    </div>
  );
}

window.ApproachC3 = ApproachC3;
