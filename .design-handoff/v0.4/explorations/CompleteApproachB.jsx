/* global React, SuccessCheck, StarRating, ReceiptReveal */
// Approach B — Rating-forward.
// Success is acknowledged briefly (40px check + inline heading). The rating
// card is the visual center: bigger stars, "Оцените сделку" prompt at h-3
// weight, prominent comment field. Optimizes for rating capture rate.

function CompleteApproachB() {
  return (
    <div className="tc-stage" style={{ paddingBottom: 8 }}>
      <div className="tc-topbar">
        <span></span>
        <span className="tc-topbar__id">Сделка #abc123</span>
      </div>

      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        gap: 8, padding: "8px 24px 16px", textAlign: "center",
      }}>
        <SuccessCheck size="sm" />
        <h2 className="tc-heading tc-heading--md" style={{ margin: 0 }}>
          Сделка завершена
        </h2>
        <p className="tc-subline" style={{ margin: "0 0 0 0" }}>
          Вы обменяли <span className="mono">750 000 ₸</span> на{" "}
          <span className="mono">2 392 500 ₩</span> с Айгерим К.
        </p>
      </div>

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

      <div className="tc-actions">
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

window.CompleteApproachB = CompleteApproachB;
