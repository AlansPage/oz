// Columns of `public.profiles` that the `authenticated` / `anon` roles are
// allowed to read. The raw `phone` column is NOT granted to clients (PII);
// use `phone_masked` for displaying OTHER users, and the auth session
// (user.phone) for the signed-in user's own number.
//
// Use this anywhere you would otherwise write `select("*")` or
// `profiles(*)` against profiles — selecting `*` errors with
// "permission denied for column phone" once 20260532 is applied.
export const PROFILE_COLUMNS =
  "id, display_name, avatar_url, verification_tier, rating_avg, rating_count, deals_count, created_at, last_active_at, phone_masked";

// Same set as a PostgREST embed: `listings.select(profileEmbed())`.
export const profileEmbed = (alias?: string, fk?: string): string => {
  const head = alias && fk ? `${alias}:profiles!${fk}` : "profiles";
  return `${head}(${PROFILE_COLUMNS})`;
};
