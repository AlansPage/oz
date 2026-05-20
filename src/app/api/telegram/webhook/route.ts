import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "@/lib/telegram";

export const dynamic = "force-dynamic";

const PHONE_RE = /^\+7\d{10}$/;

type TelegramUser = {
  id: number;
  username?: string;
};

type TelegramChat = {
  id: number;
};

type TelegramMessage = {
  from?: TelegramUser;
  chat?: TelegramChat;
  text?: string;
};

type TelegramUpdate = {
  message?: TelegramMessage;
};

const START_REPLY =
  "Привет! Я бот авторизации öz.\n\n" +
  "Чтобы войти:\n" +
  "1. Откройте приложение öz и введите номер телефона\n" +
  "2. Вернитесь сюда и отправьте: /verify +7XXXXXXXXXX";

const FALLBACK_REPLY = "Используйте /verify +7XXXXXXXXXX для входа в öz.";

function replyOk() {
  return NextResponse.json({ ok: true });
}

async function trySend(chatId: number, text: string) {
  try {
    await sendTelegramMessage(chatId, text);
  } catch (err) {
    console.error("telegram reply failed", err);
  }
}

export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const provided = req.headers.get("x-telegram-bot-api-secret-token");
  if (!expected || provided !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return replyOk();
  }

  const msg = update.message;
  if (!msg || !msg.from || !msg.chat || typeof msg.text !== "string") {
    return replyOk();
  }

  const chatId = msg.chat.id;
  const fromId = msg.from.id;
  const username = msg.from.username;
  const text = msg.text.trim();

  try {
    if (text === "/start" || text.startsWith("/start ")) {
      await trySend(chatId, START_REPLY);
      return replyOk();
    }

    if (text.startsWith("/verify")) {
      const parts = text.split(/\s+/);
      const phone = parts[1] ?? "";
      if (!PHONE_RE.test(phone)) {
        await trySend(chatId, "Неверный формат. Пример: /verify +77051234567");
        return replyOk();
      }

      const nowIso = new Date().toISOString();
      const { data: pending, error: lookupError } = await supabaseAdmin
        .from("auth_codes")
        .select("id, code")
        .eq("phone", phone)
        .eq("used", false)
        .eq("delivered", false)
        .gt("expires_at", nowIso)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (lookupError) {
        console.error("auth_codes lookup failed", lookupError);
        await trySend(chatId, "Внутренняя ошибка. Попробуйте ещё раз.");
        return replyOk();
      }

      if (!pending) {
        await trySend(
          chatId,
          "Сначала запросите код в приложении öz по этому номеру.",
        );
        return replyOk();
      }

      const { error: updateError } = await supabaseAdmin
        .from("auth_codes")
        .update({ telegram_user_id: fromId, delivered: true })
        .eq("id", pending.id);
      if (updateError) {
        console.error("auth_codes update failed", updateError);
        await trySend(chatId, "Внутренняя ошибка. Попробуйте ещё раз.");
        return replyOk();
      }

      const { error: linkError } = await supabaseAdmin
        .from("telegram_links")
        .upsert(
          {
            phone,
            telegram_user_id: fromId,
            telegram_username: username ?? null,
            linked_at: new Date().toISOString(),
          },
          { onConflict: "phone" },
        );
      if (linkError) {
        console.error("telegram_links upsert failed", linkError);
      }

      await trySend(
        chatId,
        `öz: ваш код для входа: <b>${pending.code}</b>\n\nКод действителен 5 минут.`,
      );
      return replyOk();
    }

    await trySend(chatId, FALLBACK_REPLY);
    return replyOk();
  } catch (err) {
    console.error("telegram webhook error", err);
    return replyOk();
  }
}
