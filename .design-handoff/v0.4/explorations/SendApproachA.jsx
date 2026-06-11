/* global React, PressAndHold, CopyRow */
// Send Approach A — Calm. Bank details get the most visual weight; timer is
// understated (warning border but quiet); counterparty is a small identifier
// row at the top. The press-and-hold button is prominent but the screen is
// composed so the bank details card is what the eye lands on.

function SendApproachA() {
  return (
    <div className="tx-stage" style={{ paddingBottom: 24 }}>
      <div className="tx-topbar">
        <button className="tx-topbar__back" aria-label="Назад">←</button>
        <span className="tx-topbar__id">Сделка #abc123</span>
      </div>

      <div className="tx-statusline">
        <span className="tx-statusline__dot"></span>
        <span>Сделка активна · переведите средства</span>
      </div>

      <div className="tx-card tx-party-card">
        <div className="tx-party-card__avatar">А</div>
        <div className="tx-party-card__identity">
          <div className="tx-party-card__name">Айгерим К.</div>
          <div className="tx-party-card__meta">
            ★ 4,9 · 23 сделки <span className="tx-vbadge-inline">ID</span>
          </div>
        </div>
      </div>

      <div className="tx-card tx-timer tx-timer--understated">
        <div className="tx-timer__icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 4.5V7.5L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="tx-timer__label">Окно перевода</span>
        <span className="tx-timer__value">14:23</span>
      </div>

      <div className="tx-card">
        <div className="tx-twoside">
          <div className="tx-twoside__side">
            <div className="tx-twoside__label">Вы отправляете</div>
            <div className="tx-twoside__value">750 000 ₸</div>
          </div>
          <div className="tx-twoside__arrow">→</div>
          <div className="tx-twoside__side tx-twoside__side--receive">
            <div className="tx-twoside__label">Получаете</div>
            <div className="tx-twoside__value">2 392 500 ₩</div>
          </div>
        </div>
      </div>

      <div className="tx-card tx-bank" style={{ padding: 0 }}>
        <div className="tx-bank__title">Реквизиты для перевода</div>
        <CopyRow label="Банк" value="Kaspi Gold" />
        <CopyRow label="Получатель" value="А. Нурланова" />
        <CopyRow label="Номер карты" value="5169 4971 •••• 8821" />
        <CopyRow label="Сумма" value="750 000 ₸" emphasize />
      </div>

      <p className="tx-bank-helper" style={{ padding: "0 20px" }}>
        Сумма должна совпадать до тенге. Получатель видит ваш платёж в течение 2–5 минут.
      </p>

      <div style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <PressAndHold label="Я отправил деньги" />
        <p className="tx-hold-hint">Удерживайте 2 сек. — далее загрузка чека</p>
        <button className="tx-actions__ghost-link" style={{ marginTop: 4 }}>Отменить сделку</button>
      </div>
    </div>
  );
}

window.SendApproachA = SendApproachA;
