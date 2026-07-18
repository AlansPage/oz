"use client";

import {
  OZ_CONTACT_EMAIL,
  buildContactTelegramUrl,
} from "@/lib/contact";
import { getWebApp } from "@/lib/telegram/webapp";

type Props = {
  /**
   * When set (help opened from inside a deal), the id rides the Telegram deep
   * link as `?start=help_<txid>` so the thread arrives with context to pull.
   */
  transactionId?: string | null;
  /**
   * "card" — the full contact surface (framing line + Telegram CTA + optional
   * email + response-time note). Used on /help and on empty/error states.
   * "inline" — a quiet single-line catch-all for use beneath the in-deal
   * dispute button, where dispute stays the prominent, context-carrying path.
   */
  variant?: "card" | "inline";
  className?: string;
};

export function ContactFounder({
  transactionId,
  variant = "card",
  className,
}: Props) {
  const url = buildContactTelegramUrl(transactionId);

  // Inside the Telegram Mini App, opening a t.me link to another account via a
  // normal anchor is awkward; route it through the WebApp helper instead. The
  // check is at click-time (not render) so SSR markup is identical and there's
  // no hydration mismatch — the href stays the real URL for the web case.
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const wa = getWebApp();
    if (wa?.initData) {
      e.preventDefault();
      wa.openTelegramLink(url);
    }
  };

  if (variant === "inline") {
    return (
      <a
        className={`oz-contact__inline${className ? ` ${className}` : ""}`}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
      >
        Проблема не по конкретной сделке? Написать создателю
      </a>
    );
  }

  return (
    <div className={`oz-contact${className ? ` ${className}` : ""}`}>
      <p className="oz-contact__lede">
        За öz стоит один человек, а не служба поддержки. Напишите мне напрямую —
        я делаю öz сам и читаю каждое сообщение.
      </p>
      <a
        className="oz-btn oz-btn--primary oz-btn--full"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
      >
        Написать в Telegram
      </a>
      {OZ_CONTACT_EMAIL && (
        <a className="oz-contact__email" href={`mailto:${OZ_CONTACT_EMAIL}`}>
          {OZ_CONTACT_EMAIL}
        </a>
      )}
      <p className="oz-contact__note">Обычно отвечаю в течение дня.</p>
    </div>
  );
}
