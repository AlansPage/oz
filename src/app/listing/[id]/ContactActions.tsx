"use client";

type Props = {
  onStartDeal: () => void;
};

export function ContactActions({ onStartDeal }: Props) {
  return (
    <div className="oz-listing-actions">
      <button
        className="oz-btn oz-btn--primary oz-btn--lg oz-btn--full"
        onClick={onStartDeal}
      >
        Начать сделку
      </button>
    </div>
  );
}
