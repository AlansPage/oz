const TG_API = "https://api.telegram.org";

// Minimal subset of Telegram reply_markup we use: a one-time keyboard with a
// single "share my phone number" button, or an instruction to remove it.
type ReplyMarkup =
  | {
      keyboard: { text: string; request_contact?: true }[][];
      resize_keyboard?: boolean;
      one_time_keyboard?: boolean;
    }
  | { remove_keyboard: true };

export async function sendTelegramMessage(
  chatId: number,
  text: string,
  replyMarkup?: ReplyMarkup,
) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not set");
  const res = await fetch(`${TG_API}/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram sendMessage failed: ${res.status} ${body}`);
  }
  return res.json() as Promise<{ ok: boolean; result: unknown }>;
}

// One-time reply keyboard prompting the user to share their Telegram-verified
// phone number. Telegram only lets the user share their OWN number via this
// button, and the resulting contact carries user_id === from.id — that verified
// number is what proves phone ownership for binding.
export function contactRequestKeyboard(buttonText: string): ReplyMarkup {
  return {
    keyboard: [[{ text: buttonText, request_contact: true }]],
    resize_keyboard: true,
    one_time_keyboard: true,
  };
}

// Removes the share-contact keyboard once the code has been delivered.
export const removeKeyboard: ReplyMarkup = { remove_keyboard: true };

export function generateOtp(): string {
  const buf = new Uint8Array(4);
  crypto.getRandomValues(buf);
  const n = ((buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3]) >>> 0;
  return String(n % 1_000_000).padStart(6, "0");
}
