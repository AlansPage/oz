/* global React, SuccessCheck, StarRating, ReceiptReveal */
// Approach BC — B + C merged.
// Rating capture is the hero (from B). The permanent transaction record
// lives in a collapsible "Подробности сделки" disclosure below (from C),
// so the user can claim it without ever having to scroll past it. Stripe-
// style: payment receipts are always accessible, never in the way.

const { useState: useStateBC } = React;

function CompleteApproachBC() {
  const [open, setOpen] = useStateBC(false);

  return (
    <div className="tc-stage" style={{ paddingBottom: 8 }}>
      <div className="tc-topbar">
        <span></span>
        <span className="tc-topbar__id">Сделка #abc123</span>
      </div>

      {/* Brief success */}
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 8, padding: "8px 24px 16px", textAlign: "center",
      }}>
        <SuccessCheck size="sm" />
        <h2 className="tc-heading tc-heading--md" style={{ margin: 0 }}>
          Сделка завершена
        </h2>
        <p className="tc-subline" style={{ margin: 0 }}>
          Вы обменяли <span className="mono">750 000 ₸</span> на{" "}
          <span className="mono">2 392 500 ₩</span> с Айгерим К.
        </p>
      </div>

      {/* Rating hero — large stars, prompt, comment */}
      <div className="tc-rating" style={{ padding: 24, gap: 16 }}>
        <p className="tc-rating__prompt tc-rating__prompt--lg">
          Оцените сделку
        </p>
        <p className="tc-rating__prompt" style={{ marginTop: -8 }}>
          Ваш отзыв помогает сообществу öz.
        </p>
        <StarRating size="lg" />
        <textarea
          className="tc-comment"
          placeholder="Расскажите, как прошло — необязательно"
          style={{ minHeight: 88 }}
        ></textarea>
      </div>

      {/* Collapsible details — the full record from approach C */}
      <div className="tc-details">
        <button
          type="button"
          className="tc-details__toggle"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? "Скрыть подробности" : "Подробности сделки"}
          <span className="tc-details__caret"></span>
        </button>
        <div className={"tc-details__body " + (open ? "is-open" : "is-collapsed")}>
          <div className="tc-summary">
            <div className="tc-summary__row tc-summary__row--hero">
              <span className="tc-summary__label">Отдано</span>
              <span className="tc-summary__value tc-summary__value--mono">750 000 ₸</span>
            </div>
            <div className="tc-summary__row tc-summary__row--hero tc-summary__row--receive">
              <span className="tc-summary__label">Получено</span>
              <span className="tc-summary__value tc-summary__value--mono">2 392 500 ₩</span>
            </div>
            <div className="tc-summary__row">
              <span className="tc-summary__label">Контрагент</span>
              <span className="tc-summary__value">Айгерим К.</span>
            </div>
            <div className="tc-summary__row">
              <span className="tc-summary__label">Курс</span>
              <span className="tc-summary__value tc-summary__value--mono">3,19</span>
            </div>
            <div className="tc-summary__row">
              <span className="tc-summary__label">ID операции</span>
              <span className="tc-summary__value tc-summary__value--mono">#abc123</span>
            </div>
            <div className="tc-summary__row">
              <span className="tc-summary__label">Дата</span>
              <span className="tc-summary__value tc-summary__value--mono">17 ноя, 15:42</span>
            </div>
          </div>
        </div>
      </div>

      <div className="tc-actions" style={{ paddingTop: 16 }}>
        <button className="tc-actions__primary">Отправить отзыв</button>
        <button
          type="button"
          style={{ background: "transparent", border: 0, fontSize: 13, color: "var(--text-3)", padding: "6px 4px", cursor: "pointer" }}
        >
          Пропустить → готово
        </button>
        <ReceiptReveal />
      </div>
    </div>
  );
}

window.CompleteApproachBC = CompleteApproachBC;
