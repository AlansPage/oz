/* global React, KaspiReceiptMock, SlideToConfirm */
// Approach C2 — receipt-as-hero with verification gating (refined v2).
// Changes from v1:
//  - status line shows relative time ("14 мин назад"), not absolute timestamp
//  - italic framing line above the receipt reframes it as user-submitted,
//    not platform-verified
//  - receipt tightened to its natural height (no fixed aspect-ratio)
//  - "Вы получаете" demoted to a single horizontal strip lower in hierarchy
//  - Open-Kaspi arrow upgraded to a soft-green pill so it reads as a CTA
//  - sticky-bar restructured: hint when disabled · slider · ghost link with chevron

const { useState: useStateC2 } = React;

function ApproachC2() {
  const [verified, setVerified] = useStateC2(false);
  const [done, setDone] = useStateC2(false);

  return (
    <div className="tx-stage" style={{ paddingBottom: 0 }}>
      <div className="tx-topbar">
        <button className="tx-topbar__back" aria-label="Назад">←</button>
        <span className="tx-topbar__id">Сделка #abc123</span>
      </div>

      <div className="tx-statusline" style={{ paddingBottom: 12 }}>
        <span className="tx-statusline__dot"></span>
        <span>Контрагент отправил перевод · 14 мин назад</span>
      </div>

      <p className="tx-frame-line">
        Чек предоставлен контрагентом. Откройте банк, чтобы проверить поступление.
      </p>

      {/* Receipt — natural height, sized by content */}
      <div className="tx-card" style={{ padding: 0, overflow: "hidden", gap: 0 }}>
        <div className="tx-receipt__thumb tx-receipt__thumb--xl" style={{ borderRadius: "var(--r-lg)", border: 0 }}>
          <KaspiReceiptMock />
        </div>
      </div>

      {/* Compact money strip — single horizontal row, lower hierarchy */}
      <div className="tx-card tx-card--tight" style={{ gap: 4 }}>
        <div className="tx-money-row">
          <span className="tx-money-row__label">Вы получаете</span>
          <span className="tx-money-row__value">2 392 500 ₩</span>
        </div>
        <div className="tx-money-sub">
          от Айгерим К. <span className="tx-vbadge-inline">ID</span>{" "}
          <span className="mono">· 750 000 ₸ · 3,19</span>
        </div>
      </div>

      {/* Verification station — Open Kaspi + checkbox */}
      <div className="tx-card tx-station">
        <button className="tx-station__open" type="button">
          <span className="tx-station__logo" aria-hidden></span>
          <span className="tx-station__text">
            <span className="tx-station__title">Откройте Kaspi и сверьте</span>
            <span className="tx-station__sub">Поступление 750 000 ₸</span>
          </span>
          <span className="tx-station__arrow">Открыть ↗</span>
        </button>
        <button
          type="button"
          className={"tx-check" + (verified ? " tx-check--on" : "")}
          onClick={() => setVerified((v) => !v)}
        >
          <span className="tx-check__box">
            <span className="tx-check__tick"></span>
          </span>
          <span className="tx-check__label">Я сверил поступление в моём банке</span>
        </button>
      </div>

      <div className="tx-stickybar">
        {!verified && (
          <p className="tx-hint">
            Отметьте «Я сверил», чтобы подтвердить получение.
          </p>
        )}
        <SlideToConfirm
          label="Сдвиньте, чтобы подтвердить"
          confirmedLabel="Подтверждено"
          disabled={!verified}
          onConfirm={() => setDone(true)}
        />
        <button className="tx-actions__ghost-link">Сообщить о проблеме</button>
      </div>
    </div>
  );
}

window.ApproachC2 = ApproachC2;
