"use client";

import { Avatar } from "@/components/feed/Avatar";
import { VerificationBadge } from "@/components/feed/VerificationBadge";
import { useRate } from "@/components/feed/RateContext";
import {
  equivalentAmount,
  formatAmount,
  formatAmountInput,
  formatRate,
  formatRelativeTime,
  parseAmount,
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
import type { EditForm } from "./ListingDetailClient";

const SYMBOL: Record<Currency, string> = { KZT: "₸", KRW: "₩" };
const HOUR_MS = 60 * 60 * 1000;

type Props = {
  listing: ListingWithProfile;
  editForm: EditForm | null;
  onEditChange: (next: EditForm) => void;
};

export function ListingHero({ listing, editForm, onEditChange }: Props) {
  const { data: rateData } = useRate();
  const direction = listing.direction as Direction;
  const from = directionFrom(direction);
  const to = directionTo(direction);
  const profile = listing.profiles;
  const tier = profile.verification_tier as VerificationTier;

  const displayName =
    profile.display_name?.trim() || (profile.phone_masked ?? "—");

  const editing = editForm !== null;

  const postedAmount = Number(listing.amount);
  // Remaining inventory (cache; null = pre-feature listing = full). The hero
  // shows remaining as the headline when partially filled, never while editing.
  const remaining =
    listing.remaining_amount === null
      ? postedAmount
      : Number(listing.remaining_amount);
  const partial = !editing && remaining < postedAmount;

  const displayAmount = editing
    ? parseAmount(editForm.amountStr)
    : partial
      ? remaining
      : postedAmount;

  const displayRate = editing
    ? editForm.rateStr
      ? Number(editForm.rateStr.replace(",", "."))
      : null
    : listing.rate !== null
      ? Number(listing.rate)
      : null;

  const marketRate = rateData?.rate ?? null;
  const equivalent =
    marketRate !== null && displayAmount > 0
      ? equivalentAmount(displayAmount, from, marketRate, displayRate)
      : null;

  const expiresMs = new Date(listing.expires_at).getTime() - Date.now();
  const expiresSoon = expiresMs < HOUR_MS;

  const ratingLine = reputationLine(profile.rating_avg, profile.deals_count);

  return (
    <article className="oz-listing-hero">
      <div className="oz-listing-hero__who">
        <Avatar
          url={profile.avatar_url}
          name={profile.display_name}
          phone={profile.phone_masked}
          size="lg"
        />
        <div className="oz-listing-hero__identity">
          <div className="oz-listing-hero__name">{displayName}</div>
          <div className="oz-listing-hero__rating">{ratingLine}</div>
        </div>
        <VerificationBadge tier={tier} full />
      </div>

      <div className="oz-listing-hero__money">
        <div className="oz-listing-hero__direction">
          {SYMBOL[from]} → {SYMBOL[to]}
        </div>

        {editing ? (
          <input
            className="oz-listing-hero__edit-amount"
            inputMode="decimal"
            value={editForm.amountStr}
            onChange={(e) =>
              onEditChange({
                ...editForm,
                amountStr: formatAmountInput(e.target.value),
              })
            }
            aria-label="Сумма"
          />
        ) : (
          <div className="oz-listing-hero__amount">
            {formatAmount(displayAmount, from)}
          </div>
        )}

        {partial && (
          <div className="oz-listing-hero__remaining-note">
            осталось из {formatAmount(postedAmount, from)}
          </div>
        )}

        {editing ? (
          <div className="oz-input--withsuffix">
            <input
              className="oz-input font-mono"
              inputMode="decimal"
              placeholder={rateData ? formatRate(rateData.rate) : "по рынку"}
              value={editForm.rateStr}
              onChange={(e) =>
                onEditChange({
                  ...editForm,
                  rateStr: e.target.value.replace(/[^\d.,]/g, ""),
                })
              }
              aria-label="Курс"
            />
            <span className="oz-input__suffix">₩/₸</span>
          </div>
        ) : (
          <div className="oz-listing-hero__rateline">
            {displayRate !== null
              ? `по курсу ${formatRate(displayRate)}`
              : "по рынку"}
          </div>
        )}

        {equivalent !== null && (
          <div className="oz-listing-hero__equivalent">
            ≈ {formatAmount(equivalent, to)}
          </div>
        )}
      </div>

      <div className="oz-listing-hero__meta">
        <div>Опубликовано {formatRelativeTime(listing.created_at)}</div>
        <div className={expiresSoon ? "oz-listing-hero__expires--warn" : ""}>
          Истекает {formatRelativeTime(listing.expires_at)}
        </div>
      </div>

      {editing ? (
        <div>
          <textarea
            className="oz-textarea"
            maxLength={280}
            placeholder="Примечание"
            value={editForm.note}
            onChange={(e) =>
              onEditChange({ ...editForm, note: e.target.value })
            }
            aria-label="Примечание"
          />
          <div className="oz-charcount">{editForm.note.length}/280</div>
        </div>
      ) : (
        listing.note && (
          <aside className="oz-listing-hero__note">{listing.note}</aside>
        )
      )}
    </article>
  );
}
