/* global React, SuccessCheck, StarRating, ReceiptReveal */
// Approach A — Celebration-forward.
// Big check + bold heading + warm subline dominate the top half.
// Compact transaction summary card. Rating sits at the bottom — inviting,
// but secondary to the "вы это сделали" feeling.

function CompleteApproachA() {
  return (
    <div className="tc-stage" style={{ paddingBottom: 8 }}>
      <div className="tc-topbar">
        <span></span>
        <span className="tc-topbar__id">Сделка #abc123</span>
      </div>

      <div style={{ padding: "24px 0 16px" }}>
        <SuccessCheck size="lg" />
        <h1 className="tc-heading">Сделка завершена</h1>
        <p className="tc-subline">
          Вы обменяли <span className="mono">750 000 ₸</span> на{" "}
          <span className="mono">2 392 500 ₩</span>
        </p>
      </div>

      <div className="tc-summary tc-summary--compact" style={{ marginBottom: 16 }}>
        <div className="tc-summary__row">
          <span className="tc-summary__label">Контрагент</span>
          <span className="tc-summary__value">Айгерим К.</span>
        </div>
        <div className="tc-summary__row">
          <span className="tc-summary__label">Курс</span>
          <span className="tc-summary__value tc-summary__value--mono">3,19</span>
        </div>
        <div className="tc-summary__row">
          <span className="tc-summary__label">Дата</span>
          <span className="tc-summary__value tc-summary__value--mono">17 ноя, 15:42</span>
        </div>
      </div>

      <div className="tc-rating">
        <p className="tc-rating__prompt">
          Оцените сделку с <strong>Айгерим К.</strong>
        </p>
        <StarRating size="lg" />
        <textarea
          className="tc-comment"
          placeholder="Комментарий — необязательно"
        ></textarea>
      </div>

      <div className="tc-actions">
        <button className="tc-actions__primary">Готово</button>
        <ReceiptReveal />
      </div>
    </div>
  );
}

window.CompleteApproachA = CompleteApproachA;
