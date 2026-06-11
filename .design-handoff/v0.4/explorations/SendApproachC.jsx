/* global React, PressAndHold, CopyRow */
// Send Approach C — Trust resume. The counterparty card is much larger and
// includes a transaction-history snippet ("23 сделки · ★ 4,9 · с фев. 2025").
// The framing is: "you've already vetted this person; now just send the
// money." Bank details still clear but slightly less prominent. Timer also
// recedes.

function SendApproachC() {
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

      {/* Trust resume card — bigger avatar, full badge label, history snippet */}
      <div className="tx-card tx-party-card tx-party-card--lg" style={{ padding: 20, alignItems: "flex-start" }}>
        <div className="tx-party-card__avatar">А</div>
        <div className="tx-party-card__identity">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <div className="tx-party-card__name">Айгерим К.</div>
            <span className="oz-vbadge oz-vbadge--id">Удостоверение проверено</span>
          </div>
          <div className="tx-party-card__meta" style={{ marginTop: 4 }}>
            ★ 4,9 · 23 сделки
          </div>
          <div className="tx-party-card__history">
            На öz с февраля 2025 · последняя сделка 2 дня назад
          </div>
        </div>
      </div>

      <div className="tx-card tx-timer tx-timer--understated" style={{ padding: "10px 14px" }}>
        <div className="tx-timer__icon" style={{ width: 22, height: 22, borderWidth: 1 }}>
          <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
            <circle cx="7" cy="7.5" r="5" stroke="currentColor" strokeWidth="1.5" />
            <path d="M7 4.5V7.5L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
        <span className="tx-timer__label" style={{ fontSize: 12 }}>Окно перевода</span>
        <span className="tx-timer__value" style={{ fontSize: 15 }}>14:23</span>
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
        <div className="tx-bank__title">Реквизиты получателя</div>
        <CopyRow label="Банк" value="Kaspi Gold" />
        <CopyRow label="Получатель" value="А. Нурланова" />
        <CopyRow label="Номер карты" value="5169 4971 •••• 8821" />
        <CopyRow label="Сумма" value="750 000 ₸" emphasize />
      </div>

      <p className="tx-bank-helper" style={{ padding: "0 20px" }}>
        Получатель видит ваш платёж в течение 2–5 минут.
      </p>

      <div style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <PressAndHold label="Я отправил деньги" />
        <p className="tx-hold-hint">Удерживайте 2 сек. — далее загрузка чека</p>
        <button className="tx-actions__ghost-link" style={{ marginTop: 4 }}>Отменить сделку</button>
      </div>
    </div>
  );
}

window.SendApproachC = SendApproachC;
