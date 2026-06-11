/* global React */
// Patient status indicator — not a spinner, not anxious. Three dots that
// gently breathe at 1.6s cycle. Reads as "we are here, no rush."

function WaitingPulse({ title = "Контрагент уведомлён", sub = "Обычно занимает 2–8 минут", hero = false }) {
  return (
    <div className={"tx-card tx-wait" + (hero ? " tx-wait--hero" : "")}>
      <span className="tx-wait__dots" aria-hidden>
        <span></span><span></span><span></span>
      </span>
      <div className="tx-wait__text">
        <strong>{title}</strong>
        {sub}
      </div>
    </div>
  );
}

window.WaitingPulse = WaitingPulse;
