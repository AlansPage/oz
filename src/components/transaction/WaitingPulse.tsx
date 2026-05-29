"use client";

type Props = {
  title?: string;
  sub?: string;
  hero?: boolean;
};

// Patient status indicator — three dots that gently breathe (1.6s). Not a
// spinner. The animation is subdued under prefers-reduced-motion.
export function WaitingPulse({
  title = "Контрагент уведомлён",
  sub = "Обычно занимает 2–8 минут",
  hero = false,
}: Props) {
  return (
    <div className={"tx-card tx-wait" + (hero ? " tx-wait--hero" : "")}>
      <span className="tx-wait__dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <div className="tx-wait__text">
        <strong>{title}</strong>
        {sub}
      </div>
    </div>
  );
}
