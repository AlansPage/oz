import type { VerificationTier } from "@/lib/types";

const SHORT_LABEL: Record<VerificationTier, string> = {
  phone: "тел.",
  phone_id: "ID",
  verified_trader: "трейдер",
};

const FULL_LABEL: Record<VerificationTier, string> = {
  phone: "Телефон подтверждён",
  phone_id: "Удостоверение проверено",
  verified_trader: "Верифицированный трейдер",
};

const CLASS: Record<VerificationTier, string> = {
  phone: "oz-vbadge oz-vbadge--phone",
  phone_id: "oz-vbadge oz-vbadge--id",
  verified_trader: "oz-vbadge oz-vbadge--trader",
};

type Props = {
  tier: VerificationTier;
  full?: boolean;
};

export function VerificationBadge({ tier, full }: Props) {
  const label = full ? FULL_LABEL[tier] : SHORT_LABEL[tier];
  return <span className={CLASS[tier]}>{label}</span>;
}
