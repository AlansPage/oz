import type { Database } from "./supabase/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Listing = Database["public"]["Tables"]["listings"]["Row"];
export type ListingInsert = Database["public"]["Tables"]["listings"]["Insert"];

export type Direction = "kzt_to_krw" | "krw_to_kzt";
export type Currency = "KZT" | "KRW";
export type VerificationTier = "phone" | "phone_id" | "verified_trader";
export type ListingStatus =
  | "active"
  | "matched"
  | "completed"
  | "expired"
  | "withdrawn";

export type ListingWithProfile = Listing & { profiles: Profile };

export type TransactionStatus =
  | "pending_sender_payment"
  | "sender_paid"
  | "counterparty_confirmed"
  | "counterparty_paid"
  | "completed"
  | "disputed"
  | "cancelled";

export type DisputeReason =
  | "not_received"
  | "wrong_amount"
  | "wrong_account"
  | "other";

export type ReceiptSide = "initiator" | "counterparty";

// Defined manually until the next `npm run gen:types` after the
// transactions migration is applied to the linked project.
export type Transaction = {
  id: string;
  listing_id: string;
  initiator_id: string;
  counterparty_id: string;
  direction: Direction;
  amount: number;
  amount_currency: Currency;
  rate: number | null;
  rate_locked_at: string;
  status: TransactionStatus;
  created_at: string;
  completed_at: string | null;
  initiator_paid_at: string | null;
  counterparty_paid_at: string | null;
  initiator_confirmed_at: string | null;
  counterparty_confirmed_at: string | null;
  disputed_at: string | null;
  disputed_by: string | null;
  dispute_reason: DisputeReason | null;
  dispute_description: string | null;
};

export type TransactionInsert = {
  listing_id: string;
  initiator_id: string;
  counterparty_id: string;
  direction: Direction;
  amount: number;
  amount_currency: Currency;
  rate?: number | null;
};

export type Receipt = {
  id: string;
  transaction_id: string;
  uploader_id: string;
  storage_path: string;
  side: ReceiptSide;
  amount_claimed: number | null;
  currency: Currency;
  created_at: string;
  ocr_status: "pending" | "parsed" | "failed" | null;
  ocr_data: unknown | null;
  ocr_confidence: number | null;
  verified: boolean;
};

export type ReceiptInsert = {
  transaction_id: string;
  uploader_id: string;
  storage_path: string;
  side: ReceiptSide;
  amount_claimed: number | null;
  currency: Currency;
};

export const RATING_TAGS = [
  "Быстро",
  "Чётко",
  "Дружелюбно",
  "Курс честный",
  "Без проблем",
] as const;

export type RatingTag = (typeof RATING_TAGS)[number];

export type Rating = {
  id: string;
  transaction_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number;
  tags: string[];
  comment: string | null;
  created_at: string;
};

export type RatingInsert = {
  transaction_id: string;
  rater_id: string;
  ratee_id: string;
  stars: number;
  tags: string[];
  comment: string | null;
};

export const directionFrom = (d: Direction): Currency =>
  d === "kzt_to_krw" ? "KZT" : "KRW";
export const directionTo = (d: Direction): Currency =>
  d === "kzt_to_krw" ? "KRW" : "KZT";
