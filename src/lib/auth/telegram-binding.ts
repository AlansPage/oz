/**
 * Telegram contact → öz phone binding (Phase 2).
 *
 * The trust model is identical to the @ozauth_bot webhook's `handleContactShared`
 * (src/app/api/telegram/webhook/route.ts): a phone is only bound when Telegram
 * itself delivers it server-side with `contact.user_id === from.id`, which it
 * only does when the user shares their OWN number via a request_contact button
 * / Mini App `requestContact()`. The client never supplies the phone, so it
 * can't bind a number it doesn't own.
 *
 * This module is used by the *app bot* webhook (the Mini App's bot). It does NOT
 * modify the @ozauth_bot webhook — that flow stays code-delivery only.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { derivePassword } from "@/lib/auth/password";
import { canonicalPhone } from "@/lib/phone";
import { logSecurityEvent } from "@/lib/security-log";

const PHONE_RE = /^\+7\d{10}$/;

export type BindResult =
  | { ok: true; phone: string; created: boolean }
  | { ok: false; reason: "ownership" | "not_kz" | "server_error" };

export type BindParams = {
  /** message.from.id — the Telegram account sharing the contact. */
  telegramUserId: number;
  /** message.from.username, if any. */
  username?: string;
  /** contact.user_id — present and === telegramUserId only for own-number shares. */
  contactUserId?: number;
  /** contact.phone_number as Telegram delivered it. */
  phoneNumber: string;
};

/**
 * Validate ownership, require a +7 number, ensure an auth user exists (so the
 * subsequent Mini App sign-in succeeds), and upsert the telegram_links row.
 * Returns the canonical phone on success.
 */
export async function bindTelegramContact(
  params: BindParams,
): Promise<BindResult> {
  const { telegramUserId, username, contactUserId, phoneNumber } = params;

  // 1. Ownership: reject anything that isn't the sender's own verified number.
  if (contactUserId !== telegramUserId) {
    void logSecurityEvent({
      event_type: "miniapp_binding_mismatch",
      detail: {
        from_id: telegramUserId,
        contact_user_id: contactUserId ?? null,
      },
    });
    return { ok: false, reason: "ownership" };
  }

  // 2. Canonicalize and require a Kazakhstan +7 number (the trust anchor).
  const phone = canonicalPhone(String(phoneNumber));
  if (!phone || !PHONE_RE.test(phone)) {
    return { ok: false, reason: "not_kz" };
  }

  // 3. Ensure an auth.users row exists for this phone, mirroring verify-code:
  //    existing web user → reuse; brand-new phone → createUser with the
  //    deterministic password so the Mini App sign-in resolves.
  let created = false;
  try {
    created = await ensureAuthUser(phone);
  } catch (err) {
    console.error("[telegram-binding] ensureAuthUser failed", err);
    return { ok: false, reason: "server_error" };
  }

  // 4. Bind the verified number to this Telegram account.
  const { error: linkError } = await supabaseAdmin.from("telegram_links").upsert(
    {
      phone,
      telegram_user_id: telegramUserId,
      telegram_username: username ?? null,
      linked_at: new Date().toISOString(),
    },
    { onConflict: "phone" },
  );
  if (linkError) {
    console.error("[telegram-binding] telegram_links upsert failed", linkError);
    return { ok: false, reason: "server_error" };
  }

  void logSecurityEvent({
    event_type: "miniapp_binding",
    phone,
    detail: { telegram_user_id: telegramUserId, created },
  });

  return { ok: true, phone, created };
}

/**
 * Returns true if a new auth user was created, false if one already existed.
 * Mirrors verify-code's listUsers→find→createUser stopgap (auth.users.phone is
 * stored WITHOUT the leading +). A pre-existing user with a legacy password is
 * left untouched — the sign-in route surfaces that as account_needs_migration.
 */
async function ensureAuthUser(phone: string): Promise<boolean> {
  const phoneNoPlus = phone.startsWith("+") ? phone.slice(1) : phone;

  const { data: usersPage, error: listError } =
    await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;

  const existing =
    usersPage?.users.find((u) => u.phone === phoneNoPlus) ?? null;
  if (existing) return false;

  const { error: createError } = await supabaseAdmin.auth.admin.createUser({
    phone,
    password: derivePassword(phone),
    phone_confirm: true,
  });
  if (createError) {
    const msg = (createError.message ?? "").toLowerCase();
    const code = (createError as { code?: string }).code ?? "";
    // listUsers race/pagination edge — the user actually exists. Treat as
    // existing rather than failing the bind.
    if (
      code === "phone_exists" ||
      msg.includes("already been registered") ||
      msg.includes("already registered")
    ) {
      return false;
    }
    throw createError;
  }
  return true;
}
