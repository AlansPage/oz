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

export const directionFrom = (d: Direction): Currency =>
  d === "kzt_to_krw" ? "KZT" : "KRW";
export const directionTo = (d: Direction): Currency =>
  d === "kzt_to_krw" ? "KRW" : "KZT";
