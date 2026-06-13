/**
 * Outbound messaging for the *app bot* (the Mini App's bot), kept separate from
 * src/lib/telegram.ts (which is bound to @ozauth_bot / TELEGRAM_BOT_TOKEN) so
 * the two channels never cross. Uses TELEGRAM_APP_BOT_TOKEN.
 */
const TG_API = "https://api.telegram.org";

type ReplyMarkup = { remove_keyboard: true };

export async function sendAppBotMessage(
  chatId: number,
  text: string,
  replyMarkup?: ReplyMarkup,
): Promise<void> {
  const token = process.env.TELEGRAM_APP_BOT_TOKEN;
  if (!token) throw new Error("TELEGRAM_APP_BOT_TOKEN not set");
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
    throw new Error(`app-bot sendMessage failed: ${res.status} ${body}`);
  }
}
