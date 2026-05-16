import type { AuthError } from "@supabase/supabase-js";

// Match against Supabase's English message / known error codes and return Russian copy.
// Falls back to a generic message rather than leaking provider text to users.
export function translateAuthError(
  err: AuthError | { message?: string; code?: string } | null,
  context: "send" | "verify",
): string {
  const msg = (err?.message ?? "").toLowerCase();
  const code = (err as { code?: string })?.code ?? "";

  if (
    msg.includes("invalid phone") ||
    msg.includes("phone_number") ||
    code === "validation_failed"
  ) {
    return "Неверный формат номера телефона.";
  }

  if (
    msg.includes("rate") ||
    msg.includes("too many") ||
    msg.includes("for security purposes")
  ) {
    return "Слишком много попыток. Подождите немного и попробуйте снова.";
  }

  if (
    msg.includes("expired") ||
    msg.includes("invalid token") ||
    msg.includes("token has expired") ||
    msg.includes("otp_expired")
  ) {
    return "Код устарел. Запросите новый.";
  }

  if (
    msg.includes("invalid otp") ||
    msg.includes("otp_invalid") ||
    msg.includes("invalid_otp") ||
    (context === "verify" && msg.includes("invalid"))
  ) {
    return "Неверный код. Проверьте и попробуйте снова.";
  }

  if (
    msg.includes("provider") ||
    msg.includes("not configured") ||
    msg.includes("unsupported phone provider")
  ) {
    return "SMS-сервис временно недоступен. Попробуйте позже.";
  }

  return context === "send"
    ? "Не удалось отправить код. Попробуйте ещё раз."
    : "Не удалось подтвердить код. Попробуйте ещё раз.";
}
