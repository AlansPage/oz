"use client";

import { reputationLine } from "@/lib/format";
import type { Profile, VerificationTier } from "@/lib/types";

const TIER_FULL: Record<VerificationTier, string> = {
  phone: "Подтверждён по телефону",
  phone_id: "Подтверждён по телефону и удостоверению",
  verified_trader: "Верифицированный трейдер öz",
};

const monthYear = new Intl.DateTimeFormat("ru-RU", {
  month: "long",
  year: "numeric",
});

export function AboutUser({ profile }: { profile: Profile }) {
  const tier = profile.verification_tier as VerificationTier;
  const ratingLine = reputationLine(profile.rating_avg, profile.deals_count);
  const memberSince = `В öz с ${monthYear.format(new Date(profile.created_at))}`;

  return (
    <section className="oz-listing-about" aria-label="О пользователе">
      <div className="oz-listing-about__title">О пользователе</div>
      <div className="oz-listing-about__line">{TIER_FULL[tier]}</div>
      <div className="oz-listing-about__line">{ratingLine}</div>
      <div className="oz-listing-about__line">{memberSince}</div>
    </section>
  );
}
