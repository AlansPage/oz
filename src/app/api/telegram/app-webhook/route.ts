/**
 * App-bot webhook (Phase 2). Receives updates from the *Mini App's* bot —
 * separate from @ozauth_bot's webhook (src/app/api/telegram/webhook/route.ts),
 * which is untouched. Its one job: when a user shares their contact from the
 * Mini App's binding step (`WebApp.requestContact()`), Telegram delivers the
 * verified number here server-side; we bind it to telegram_links via the shared
 * `bindTelegramContact` helper. The Mini App client then re-calls
 * /api/auth/telegram to mint the session.
 *
 * Auth: x-telegram-bot-api-secret-token must equal TELEGRAM_APP_WEBHOOK_SECRET
 * (set when registering the webhook), checked with a constant-time compare.
 */
import { NextResponse } from "next/server";
import { secretsMatch } from "@/lib/secure-compare";
import { logSecurityEvent } from "@/lib/security-log";
import { bindTelegramContact } from "@/lib/auth/telegram-binding";
import { sendAppBotMessage } from "@/lib/telegram/app-bot";

export const dynamic = "force-dynamic";

type TgUser = { id: number; username?: string };
type TgChat = { id: number };
type TgContact = { phone_number: string; user_id?: number };
type TgMessage = {
  from?: TgUser;
  chat?: TgChat;
  text?: string;
  contact?: TgContact;
};
type TgUpdate = { message?: TgMessage };

const OPEN_APP_HINT =
  "Откройте öz через кнопку меню, чтобы войти и подтвердить номер.";

function replyOk() {
  return NextResponse.json({ ok: true });
}

async function trySend(
  chatId: number,
  text: string,
  replyMarkup?: { remove_keyboard: true },
) {
  try {
    await sendAppBotMessage(chatId, text, replyMarkup);
  } catch (err) {
    console.error("[app-webhook] reply failed", err);
  }
}

export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_APP_WEBHOOK_SECRET;
  const provided = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secretsMatch(provided, expected)) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    void logSecurityEvent({
      event_type: "app_webhook_auth_failed",
      ip,
      detail: { provided_secret_prefix: provided?.slice(0, 4) ?? null },
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return replyOk();
  }

  const msg = update.message;
  if (!msg || !msg.from || !msg.chat) return replyOk();

  const chatId = msg.chat.id;

  try {
    // The only meaningful update: a shared contact = the binding path.
    if (msg.contact) {
      const result = await bindTelegramContact({
        telegramUserId: msg.from.id,
        username: msg.from.username,
        contactUserId: msg.contact.user_id,
        phoneNumber: msg.contact.phone_number,
      });

      if (result.ok) {
        await trySend(
          chatId,
          "✅ Номер подтверждён. Вернитесь в приложение öz — вход завершится автоматически.",
          { remove_keyboard: true },
        );
      } else if (result.reason === "ownership") {
        await trySend(
          chatId,
          "Пожалуйста, поделитесь своим собственным номером — так мы убедимся, что он принадлежит вам.",
        );
      } else if (result.reason === "not_kz") {
        await trySend(
          chatId,
          "öz работает с казахстанскими номерами +7. Ваш Telegram привязан к другому номеру.",
          { remove_keyboard: true },
        );
      } else {
        await trySend(chatId, "Внутренняя ошибка. Попробуйте ещё раз.");
      }
      return replyOk();
    }

    // Anything else (/start, free text): nudge them back into the Mini App.
    await trySend(chatId, OPEN_APP_HINT);
    return replyOk();
  } catch (err) {
    console.error("[app-webhook] error", err);
    return replyOk();
  }
}
