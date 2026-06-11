/* global React, PressAndHold, CopyRow */
// Send Approach B — Urgency through the timer. The timer card becomes the
// second-most-prominent element after the bank details. Big mono countdown,
// linear progress bar showing elapsed time. Under 5min it switches to a
// "is-urgent" mode (full warning fill, bigger numerals) — here shown at the
// urgent state to demonstrate.

function SendApproachB() {
  // mock: 4:12 remaining of a 15min window → 28% remaining
  const remainingPct = 0.28;
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

      {/* The hero timer */}
      <div className="tx-card tx-timer tx-timer--urgent" style={{ flexDirection: "column", alignItems: "stretch", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div className="tx-timer__icon">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M7 4.5V7.5L9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <span className="tx-timer__label" style={{ color: "var(--warning)", fontWeight: 600 }}>
            Окно перевода истекает
          </span>
          <span className="tx-timer__value tx-timer__value--lg">04:12</span>
        </div>
        <div className="tx-timer__progress">
          <div className="tx-timer__progress-fill" style={{ width: remainingPct * 100 + "%" }}></div>
        </div>
        <div style={{ fontSize: 12, color: "var(--warning)", fontWeight: 500 }}>
          После истечения курс может измениться.
        </div>
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
        Сумма должна совпадать до тенге.
      </p>

      <div style={{ padding: "20px 16px 0", display: "flex", flexDirection: "column", gap: 10 }}>
        <PressAndHold label="Я отправил деньги" />
        <p className="tx-hold-hint">Удерживайте 2 сек. — далее загрузка чека</p>
        <button className="tx-actions__ghost-link" style={{ marginTop: 4 }}>Отменить сделку</button>
      </div>
    </div>
  );
}

window.SendApproachB = SendApproachB;
