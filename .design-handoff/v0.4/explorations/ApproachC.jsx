/* global React, KaspiReceiptMock */
// Approach C — receipt-first / receipt-as-hero.
// Receipt occupies the top half of the screen as a near-full-bleed thumbnail.
// Money summary collapses into a tight strip below. CTA is pinned to a
// sticky bottom bar — the user scrolls the receipt itself, the action is
// always one tap away.
// This is the "everything stripped back except the receipt" variant.

function ApproachC() {
  return (
    <div className="tx-stage" style={{ paddingBottom: 0 }}>
      <div className="tx-topbar">
        <button className="tx-topbar__back" aria-label="Назад">←</button>
        <span className="tx-topbar__id">Сделка #abc123</span>
      </div>

      <div className="tx-statusline" style={{ paddingBottom: 12 }}>
        <span className="tx-statusline__dot"></span>
        <span>Контрагент отправил перевод</span>
        <span className="tx-statusline__time">15:42</span>
      </div>

      {/* Receipt as the hero — fullbleed card, tall aspect ratio */}
      <div className="tx-card" style={{ padding: 0, overflow: "hidden", gap: 0 }}>
        <div className="tx-receipt__thumb tx-receipt__thumb--xl" style={{ borderRadius: "var(--r-lg)", border: 0 }}>
          <KaspiReceiptMock />
        </div>
      </div>

      {/* Tight money summary strip — single line, mono */}
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

      <div className="tx-disclaimer">
        Проверьте получение в вашем банке перед подтверждением.
      </div>

      <div className="tx-stickybar">
        <button className="tx-actions__primary">Я получил перевод</button>
        <button className="tx-actions__ghost">Сообщить о проблеме</button>
      </div>
    </div>
  );
}

window.ApproachC = ApproachC;
