"use client";

import { Avatar } from "./Avatar";
import { VerificationBadge } from "./VerificationBadge";
import { useRate } from "./RateContext";
import {
  equivalentAmount,
  formatAmount,
  formatAmountBare,
  formatRate,
  formatRelativeTime,
  reputationLine,
} from "@/lib/format";
import {
  directionFrom,
  directionTo,
  type Currency,
  type Direction,
  type ListingWithProfile,
  type VerificationTier,
} from "@/lib/types";

const SYMBOL: Record<Currency, string> = { KZT: "₸", KRW: "₩" };

type Props = {
  listing: ListingWithProfile;
  currentUserId: string;
  pulse?: boolean;
  onContact: (id: string) => void;
  onEdit: (id: string) => void;
  onWithdraw: (id: string) => void;
};

export function ListingCard({
  listing,
  currentUserId,
  pulse,
  onContact,
  onEdit,
  onWithdraw,
}: Props) {
  const { data: rateData } = useRate();
  const direction = listing.direction as Direction;
  const from = directionFrom(direction);
  const to = directionTo(direction);
  const isOwn = listing.user_id === currentUserId;
  const profile = listing.profiles;
  const tier = profile.verification_tier as VerificationTier;

  const displayName =
    profile.display_name?.trim() || (profile.phone_masked ?? "—");

  // Inventory: remaining is what a buyer acts on. remaining_amount is the
  // trigger-maintained cache (null on listings posted before partial fills =
  // treat as full). Only divisible listings show the "из total" context.
  const amount = Number(listing.amount);
  const remaining =
    listing.remaining_amount === null ? amount : Number(listing.remaining_amount);
  const partial = remaining < amount;
  const shownAmount = partial ? remaining : amount;

  const marketRate = rateData?.rate ?? null;
  const equivalent =
    marketRate !== null
      ? equivalentAmount(shownAmount, from, marketRate, listing.rate)
      : null;

  return (
    <article className={`oz-card${pulse ? " oz-pulse-once" : ""}`}>
      <div className="oz-card__top">
        <div className="oz-card__who">
          <Avatar
            url={profile.avatar_url}
            name={profile.display_name}
            phone={profile.phone_masked}
          />
          <div className="oz-card__identity">
            <span className="oz-card__name">{displayName}</span>
            <span className="oz-card__rating">
              {reputationLine(profile.rating_avg, profile.deals_count)}
            </span>
          </div>
        </div>
        <VerificationBadge tier={tier} />
      </div>

      <div>
        <div className="oz-card__amount">
          <span className="oz-card__direction" aria-hidden>
            {SYMBOL[from]} → {SYMBOL[to]}
          </span>
          {formatAmountBare(shownAmount)}
        </div>
        {partial && (
          <div className="oz-card__remaining-note">
            осталось из {formatAmount(amount, from)}
          </div>
        )}
        <div className="oz-card__rateline">
          {listing.rate !== null
            ? `по курсу ${formatRate(Number(listing.rate))}`
            : "по рынку"}
        </div>
        {equivalent !== null && (
          <div className="oz-card__equivalent">
            ≈ {formatAmount(equivalent, to)}
          </div>
        )}
        {listing.note && <p className="oz-card__note">{listing.note}</p>}
      </div>

      <div className="oz-card__bottom">
        <span className="oz-card__time">
          {formatRelativeTime(listing.created_at)}
        </span>
        <div className="oz-card__actions">
          {isOwn ? (
            <>
              <button className="oz-secondary-btn-sm" onClick={() => onEdit(listing.id)}>
                Редактировать
              </button>
              <button className="oz-secondary-btn-sm" onClick={() => onWithdraw(listing.id)}>
                Снять
              </button>
            </>
          ) : (
            <button className="oz-soft-btn-sm" onClick={() => onContact(listing.id)}>
              Связаться
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
