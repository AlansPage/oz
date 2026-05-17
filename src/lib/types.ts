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
  | "completed"
  | "disputed"
  | "cancelled";

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

export const directionFrom = (d: Direction): Currency =>
  d === "kzt_to_krw" ? "KZT" : "KRW";
export const directionTo = (d: Direction): Currency =>
  d === "kzt_to_krw" ? "KRW" : "KZT";
