/* global React */

// CSS-only Kaspi receipt screenshot mock. A placeholder until the user
// supplies a real screenshot — the visual properties matter (red brand
// accent, green check, big amount, key-value list of transaction fields)
// because the counterparty visually matches THIS surface against their
// own bank app, so a believable mock is essential for review.
function KaspiReceiptMock({ amount = "750 000 ₸", counterparty = "Айгерим К." }) {
  return (
    <div className="kaspi">
      <div className="kaspi__header">
        <span className="time">15:42</span>
        <span className="kaspi__bar">●●●● 5G</span>
      </div>

      <div className="kaspi__check"></div>
      <div className="kaspi__title">Перевод выполнен</div>
      <div className="kaspi__amount">{amount}</div>

      <div className="kaspi__list">
        <div className="kaspi__row">
          <span className="k">Получатель</span>
          <span className="v">{counterparty}</span>
        </div>
        <div className="kaspi__row">
          <span className="k">Счёт</span>
          <span className="v">**** 4821</span>
        </div>
        <div className="kaspi__row">
          <span className="k">Комиссия</span>
          <span className="v">0 ₸</span>
        </div>
        <div className="kaspi__row">
          <span className="k">№ операции</span>
          <span className="v">KP-829441</span>
        </div>
        <div className="kaspi__row">
          <span className="k">Дата</span>
          <span className="v">17 ноя, 15:42</span>
        </div>
      </div>

      <div className="kaspi__brand">
        <span className="kaspi__brand-mark"></span>
        Kaspi.kz
      </div>
    </div>
  );
}

window.KaspiReceiptMock = KaspiReceiptMock;
