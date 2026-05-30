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

// Defined manually until the next `npm run gen:types` after the
// chat migration is applied to the linked project.
export type ChatMessage = {
  id: string;
  transaction_id: string;
  sender_id: string;
  body: string;
  flagged: boolean;
  flagged_reason: string | null;
  created_at: string;
  read_at: string | null;
};

// Defined manually until the next `npm run gen:types` after the
// alerts migration is applied to the linked project.
export type AlertSubscription = {
  id: string;
  user_id: string;
  direction: Direction;
  amount_min: number | null;
  amount_max: number | null;
  rate_better_than: number | null;
  cooldown_minutes: number;
  active: boolean;
  last_notified_at: string | null;
  created_at: string;
};

export type AlertSubscriptionInsert = {
  user_id: string;
  direction: Direction;
  amount_min?: number | null;
  amount_max?: number | null;
  rate_better_than?: number | null;
  cooldown_minutes?: number;
  active?: boolean;
};

export type NotificationChannel = "telegram" | "sms" | "push";
export type NotificationStatus =
  | "queued"
  | "sent"
  | "failed"
  | "capped"
  | "silenced";

export type NotificationLog = {
  id: string;
  user_id: string;
  alert_id: string | null;
  listing_id: string | null;
  channel: NotificationChannel;
  status: NotificationStatus;
  external_id: string | null;
  error_detail: string | null;
  created_at: string;
};

// Defined manually until the next `npm run gen:types` after the
// payment_methods migration is applied to the linked project.
export type PaymentMethod = {
  id: string;
  user_id: string;
  currency: Currency;
  bank_name: string;
  holder_name: string;
  account_number: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type CounterpartyPaymentMethod = {
  bank_name: string;
  holder_name: string;
  account_number: string;
  currency: Currency;
};

export const directionFrom = (d: Direction): Currency =>
  d === "kzt_to_krw" ? "KZT" : "KRW";
export const directionTo = (d: Direction): Currency =>
  d === "kzt_to_krw" ? "KRW" : "KZT";
