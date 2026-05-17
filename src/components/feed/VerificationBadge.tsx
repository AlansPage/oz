import type { VerificationTier } from "@/lib/types";

const LABEL: Record<VerificationTier, string> = {
  phone: "тел.",
  phone_id: "ID",
  verified_trader: "трейдер",
};

const CLASS: Record<VerificationTier, string> = {
  phone: "oz-vbadge oz-vbadge--phone",
  phone_id: "oz-vbadge oz-vbadge--id",
  verified_trader: "oz-vbadge oz-vbadge--trader",
};

export function VerificationBadge({ tier }: { tier: VerificationTier }) {
  return <span className={CLASS[tier]}>{LABEL[tier]}</span>;
}
