"use client";

type Props = {
  onStartDeal: () => void;
  // First-deal cap (5.3): when the viewer or the lister is capped and the
  // listing exceeds the limit, the button states the limit up front instead
  // of letting the user walk into the server's rejection.
  capNotice?: string | null;
};

export function ContactActions({ onStartDeal, capNotice }: Props) {
  return (
    <div className="oz-listing-actions">
      <button
        className="oz-btn oz-btn--primary oz-btn--lg oz-btn--full"
        onClick={onStartDeal}
        disabled={!!capNotice}
      >
        {capNotice ?? "Начать сделку"}
      </button>
    </div>
  );
}
