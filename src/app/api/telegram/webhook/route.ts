import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  sendTelegramMessage,
  contactRequestKeyboard,
  removeKeyboard,
} from "@/lib/telegram";
import { logSecurityEvent } from "@/lib/security-log";
import { secretsMatch } from "@/lib/secure-compare";
import { canonicalPhone } from "@/lib/phone";

export const dynamic = "force-dynamic";

const PHONE_RE = /^\+7\d{10}$/;

type TelegramUser = {
  id: number;
  username?: string;
};

type TelegramChat = {
  id: number;
};

type TelegramContact = {
  phone_number: string;
  // Present only when the user shares their OWN number via a request_contact
  // button; equals message.from.id. Absent/different for third-party contacts.
  user_id?: number;
};

type TelegramMessage = {
  from?: TelegramUser;
  chat?: TelegramChat;
  text?: string;
  contact?: TelegramContact;
};

type TelegramUpdate = {
  message?: TelegramMessage;
};

const SHARE_BUTTON = "📱 Поделиться номером";

const START_REPLY =
  "Привет! Я бот авторизации öz.\n\n" +
  "Чтобы войти:\n" +
  "1. Откройте приложение öz и введите номер телефона\n" +
  "2. Нажмите кнопку «" +
  SHARE_BUTTON +
  "» ниже — я проверю номер и пришлю код для входа.\n\n" +
  "Команды: /alerts — мои оповещения.";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const DIR_SYMBOL: Record<string, string> = {
  kzt_to_krw: "₸ → ₩",
  krw_to_kzt: "₩ → ₸",
};

function rangeText(
  amountMin: number | null,
  amountMax: number | null,
  fromCurrency: "KZT" | "KRW",
): string {
  const symbol = fromCurrency === "KZT" ? "₸" : "₩";
  const fmt = (n: number) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
  if (amountMin != null && amountMax != null)
    return `${fmt(amountMin)} — ${fmt(amountMax)} ${symbol}`;
  if (amountMin != null) return `от ${fmt(amountMin)} ${symbol}`;
  if (amountMax != null) return `до ${fmt(amountMax)} ${symbol}`;
  return "любая сумма";
}

async function handleMute(chatId: number, fromId: number, alertId: string) {
  if (!UUID_RE.test(alertId)) {
    await trySend(
      chatId,
      "Не удалось отключить оповещение. Откройте приложение öz и проверьте настройки.",
    );
    return;
  }

  const { data: alert } = await supabaseAdmin
    .from("alert_subscriptions")
    .select("id, user_id")
    .eq("id", alertId)
    .maybeSingle();
  if (!alert) {
    await trySend(
      chatId,
      "Не удалось отключить оповещение. Откройте приложение öz и проверьте настройки.",
    );
    return;
  }

  const { data: owner } = await supabaseAdmin
    .from("profiles")
    .select("phone")
    .eq("id", alert.user_id)
    .maybeSingle();
  const ownerPhone = owner?.phone ?? null;
  if (!ownerPhone) {
    await trySend(
      chatId,
      "Не удалось отключить оповещение. Откройте приложение öz и проверьте настройки.",
    );
    return;
  }

  const { data: link } = await supabaseAdmin
    .from("telegram_links")
    .select("telegram_user_id")
    .eq("phone", ownerPhone)
    .maybeSingle();
  if (!link || Number(link.telegram_user_id) !== fromId) {
    await trySend(
      chatId,
      "Не удалось отключить оповещение. Откройте приложение öz и проверьте настройки.",
    );
    return;
  }

  const { error: updateErr } = await supabaseAdmin
    .from("alert_subscriptions")
    .update({ active: false })
    .eq("id", alertId);
  if (updateErr) {
    console.error("mute alert update failed", updateErr);
    await trySend(
      chatId,
      "Не удалось отключить оповещение. Откройте приложение öz и проверьте настройки.",
    );
    return;
  }

  await trySend(
    chatId,
    "Оповещение отключено. Включить обратно можно в приложении öz.",
  );
}

async function handleListAlerts(chatId: number, fromId: number) {
  const { data: link } = await supabaseAdmin
    .from("telegram_links")
    .select("phone")
    .eq("telegram_user_id", fromId)
    .maybeSingle();
  if (!link?.phone) {
    await trySend(
      chatId,
      "У вас нет аккаунта в öz. Используйте /verify +7… чтобы войти.",
    );
    return;
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("phone", link.phone)
    .maybeSingle();
  if (!profile) {
    await trySend(
      chatId,
      "У вас нет аккаунта в öz. Используйте /verify +7… чтобы войти.",
    );
    return;
  }

  const { data: alerts } = await supabaseAdmin
    .from("alert_subscriptions")
    .select(
      "id, direction, amount_min, amount_max, rate_better_than, cooldown_minutes",
    )
    .eq("user_id", profile.id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (!alerts || alerts.length === 0) {
    await trySend(
      chatId,
      "У вас нет оповещений. Создайте их в приложении öz.",
    );
    return;
  }

  const lines: string[] = ["Ваши активные оповещения:", ""];
  for (const a of alerts) {
    const direction = a.direction as string;
    const symbol = DIR_SYMBOL[direction] ?? direction;
    const fromCcy: "KZT" | "KRW" = direction === "kzt_to_krw" ? "KZT" : "KRW";
    const range = rangeText(
      a.amount_min != null ? Number(a.amount_min) : null,
      a.amount_max != null ? Number(a.amount_max) : null,
      fromCcy,
    );
    const rateLine =
      a.rate_better_than != null
        ? `курс не хуже ${String(a.rate_better_than).replace(".", ",")}`
        : "любой курс";
    lines.push(
      `• ${symbol}  ${range}\n  ${rateLine}\n  пауза ${a.cooldown_minutes} мин`,
    );
  }
  lines.push("");
  lines.push("Управление: https://oz.exchange/alerts");

  await trySend(chatId, lines.join("\n"));
}

// Prompt the user to share their Telegram-verified phone number. This is the
// only way to start a binding now — typing a phone is no longer accepted,
// because the typed number is not proof of ownership.
async function handleShareContactPrompt(chatId: number) {
  await trySend(chatId, START_REPLY, contactRequestKeyboard(SHARE_BUTTON));
}

// The binding path. Telegram guarantees the shared number is the one verified
// for the sender's account (and carries user_id === from.id). We deliver the
// pending login code ONLY to the owner of that verified number, which closes
// the takeover: an attacker can only ever share their own number.
async function handleContactShared(
  chatId: number,
  fromId: number,
  username: string | undefined,
  contact: TelegramContact,
) {
  // Reject anything that is not the sender's own verified number (e.g. a
  // third-party contact shared from the address book).
  if (contact.user_id !== fromId) {
    void logSecurityEvent({
      event_type: "webhook_contact_mismatch",
      detail: { from_id: fromId, contact_user_id: contact.user_id ?? null },
    });
    await trySend(
      chatId,
      "Пожалуйста, поделитесь своим собственным номером через кнопку ниже.",
      contactRequestKeyboard(SHARE_BUTTON),
    );
    return;
  }

  const phone = canonicalPhone(String(contact.phone_number));
  if (!phone || !PHONE_RE.test(phone)) {
    await trySend(
      chatId,
      "Этот номер не поддерживается. Используйте номер +7…",
      removeKeyboard,
    );
    return;
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
    await trySend(chatId, "Внутренняя ошибка. Попробуйте ещё раз.", removeKeyboard);
    return;
  }

  if (!pending) {
    await trySend(
      chatId,
      `У вас нет ожидающего входа для ${phone}. Откройте приложение öz и запросите код для этого номера.`,
      removeKeyboard,
    );
    return;
  }

  // Bind the verified number to this Telegram account, then deliver the code.
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
    await trySend(chatId, "Внутренняя ошибка. Попробуйте ещё раз.", removeKeyboard);
    return;
  }

  const { error: updateError } = await supabaseAdmin
    .from("auth_codes")
    .update({ telegram_user_id: fromId, delivered: true })
    .eq("id", pending.id);
  if (updateError) {
    console.error("auth_codes update failed", updateError);
    await trySend(chatId, "Внутренняя ошибка. Попробуйте ещё раз.", removeKeyboard);
    return;
  }

  await trySend(
    chatId,
    `öz: ваш код для входа: <b>${pending.code}</b>\n\nКод действителен 5 минут.`,
    removeKeyboard,
  );
}

function replyOk() {
  return NextResponse.json({ ok: true });
}

async function trySend(
  chatId: number,
  text: string,
  replyMarkup?: Parameters<typeof sendTelegramMessage>[2],
) {
  try {
    await sendTelegramMessage(chatId, text, replyMarkup);
  } catch (err) {
    console.error("telegram reply failed", err);
  }
}

export async function POST(req: Request) {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  const provided = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secretsMatch(provided, expected)) {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    void logSecurityEvent({
      event_type: "webhook_auth_failed",
      ip,
      detail: { provided_secret_prefix: provided?.slice(0, 4) ?? null },
    });
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return replyOk();
  }

  const msg = update.message;
  if (!msg || !msg.from || !msg.chat) {
    return replyOk();
  }

  const chatId = msg.chat.id;
  const fromId = msg.from.id;
  const username = msg.from.username;

  try {
    // Contact share (no text) is the binding path.
    if (msg.contact) {
      await handleContactShared(chatId, fromId, username, msg.contact);
      return replyOk();
    }

    if (typeof msg.text !== "string") {
      return replyOk();
    }
    const text = msg.text.trim();

    // Deep link to mute an alert — operates on an already-linked account.
    if (text.startsWith("/start mute_")) {
      const alertId = text.slice("/start mute_".length).trim();
      await handleMute(chatId, fromId, alertId);
      return replyOk();
    }

    if (text === "/alerts") {
      await handleListAlerts(chatId, fromId);
      return replyOk();
    }

    // Everything else (/start, /start verify…, /verify, free text) now leads to
    // the verified-contact prompt. Typing a phone number no longer binds.
    await handleShareContactPrompt(chatId);
    return replyOk();
  } catch (err) {
    console.error("telegram webhook error", err);
    return replyOk();
  }
}
