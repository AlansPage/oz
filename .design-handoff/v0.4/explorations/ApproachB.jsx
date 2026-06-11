/* global React, KaspiReceiptMock */
// Approach B — smaller, tighter receipt.
// Same overall shape as A but the receipt is a compressed 16:10 strip
// that sits inline between the metadata and the CTA. Tests whether the
// receipt can earn its place at "auxiliary evidence" scale rather than
// "hero" scale — useful if the user already trusts the system enough to
// not need a giant proof image.

function ApproachB() {
  return (
    <div className="tx-stage">
      <div className="tx-topbar">
        <button className="tx-topbar__back" aria-label="Назад">←</button>
        <span className="tx-topbar__id">Сделка #abc123</span>
      </div>

      <div className="tx-statusline">
        <span className="tx-statusline__dot"></span>
        <span>Контрагент отправил перевод</span>
        <span className="tx-statusline__time">15:42</span>
      </div>

      <div className="tx-card">
        <div className="tx-amount">
          <div className="tx-amount__label">Вы получаете</div>
          <div className="tx-amount__value">2 392 500 ₩</div>
          <div className="tx-amount__sub">
            от 750 000 ₸ <span className="sep">·</span> курс 3,19{" "}
            <span className="tx-lockchip">зафикс.</span>
          </div>
        </div>

        <hr className="tx-hr" />

        <div className="tx-meta">
          <span className="tx-meta__label">От</span>
          <span className="tx-meta__value">
            Айгерим К. <span className="tx-vbadge-inline">ID</span>
          </span>
          <span className="tx-meta__label">Рейтинг</span>
          <span className="tx-meta__value tx-meta__value--mono">★ 4,8 · 12</span>
          <span className="tx-meta__label">Банк</span>
          <span className="tx-meta__value">Kaspi → KakaoBank</span>
        </div>

        <div className="tx-receipt">
          <div className="tx-receipt__caption">
            <span className="tx-receipt__caption-icon"></span>
            <span>Чек · приложение Kaspi · 15:42</span>
            <span className="tx-receipt__caption-tap">Открыть полностью</span>
          </div>
          <div className="tx-receipt__thumb tx-receipt__thumb--sm">
            <KaspiReceiptMock />
          </div>
        </div>

        <div className="tx-actions">
          <button className="tx-actions__primary">Я получил перевод</button>
          <button className="tx-actions__ghost">Сообщить о проблеме</button>
        </div>
      </div>

      <div className="tx-disclaimer">
        Проверьте получение в вашем банке<br />
        перед подтверждением.
      </div>

      <div style={{ height: 24 }}></div>
    </div>
  );
}

window.ApproachB = ApproachB;
