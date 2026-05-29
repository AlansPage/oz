"use client";

type Props = {
  amount?: string;
  counterparty?: string;
  account?: string;
  fee?: string;
  opId?: string;
  date?: string;
  time?: string;
};

// CSS-only Kaspi receipt screenshot mock. Design-system parity / fallback
// only — real transaction views render the actual uploaded receipt image.
// Used when no receipt image is available so the counterparty still has a
// believable surface to visually match against their bank app.
export function KaspiReceiptMock({
  amount = "750 000 ₸",
  counterparty = "Айгерим К.",
  account = "**** 4821",
  fee = "0 ₸",
  opId = "KP-829441",
  date = "17 ноя, 15:42",
  time = "15:42",
}: Props) {
  return (
    <div className="kaspi">
      <div className="kaspi__header">
        <span className="time">{time}</span>
        <span className="kaspi__bar">●●●● 5G</span>
      </div>

      <div className="kaspi__check" />
      <div className="kaspi__title">Перевод выполнен</div>
      <div className="kaspi__amount">{amount}</div>

      <div className="kaspi__list">
        <div className="kaspi__row">
          <span className="k">Получатель</span>
          <span className="v">{counterparty}</span>
        </div>
        <div className="kaspi__row">
          <span className="k">Счёт</span>
          <span className="v">{account}</span>
        </div>
        <div className="kaspi__row">
          <span className="k">Комиссия</span>
          <span className="v">{fee}</span>
        </div>
        <div className="kaspi__row">
          <span className="k">№ операции</span>
          <span className="v">{opId}</span>
        </div>
        <div className="kaspi__row">
          <span className="k">Дата</span>
          <span className="v">{date}</span>
        </div>
      </div>

      <div className="kaspi__brand">
        <span className="kaspi__brand-mark" />
        Kaspi.kz
      </div>
    </div>
  );
}
