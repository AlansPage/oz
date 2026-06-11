/* global React, SuccessCheck, StarRating, ReceiptReveal */
// Approach C — Receipt/record-forward.
// Brief success at top. Hero is the full transaction summary card — every
// row of the record (Отдано, Получено, Контрагент, Курс, ID, Дата),
// with the two money rows visually emphasized. Rating below frames the
// record as something the user is closing out.

function CompleteApproachC() {
  return (
    <div className="tc-stage" style={{ paddingBottom: 8 }}>
      <div className="tc-topbar">
        <span></span>
        <span className="tc-topbar__id">Сделка #abc123</span>
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 10, padding: "12px 24px 14px",
      }}>
        <SuccessCheck size="sm" />
        <h2 className="tc-heading tc-heading--md" style={{ margin: 0, textAlign: "left" }}>
          Сделка завершена
        </h2>
      </div>

      <div className="tc-summary" style={{ marginBottom: 16 }}>
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

      <div className="tc-rating" style={{ padding: "16px 20px" }}>
        <p className="tc-rating__prompt">
          Оцените сделку с <strong>Айгерим К.</strong>
        </p>
        <StarRating size="md" showLabel={false} />
      </div>

      <div className="tc-actions">
        <button className="tc-actions__primary">Готово</button>
        <ReceiptReveal />
      </div>
    </div>
  );
}

window.CompleteApproachC = CompleteApproachC;
