"use client";

import type { Currency, TransactionStatus } from "@/lib/types";
import { formatAmount } from "@/lib/format";
import type { ViewerRole } from "./TransactionDetailClient";

type Tone = "primary" | "warning" | "neutral";

type Props = {
  status: TransactionStatus;
  viewerRole: ViewerRole;
  amount: number;
  from: Currency;
  to: Currency;
  equivalent: number | null;
};

type Copy = { tone: Tone; title: string; body: string };

function copyFor({
  status,
  viewerRole,
  amount,
  from,
  to,
  equivalent,
}: Props): Copy {
  const a1 = formatAmount(amount, from);
  const a2 = equivalent !== null ? formatAmount(equivalent, to) : "—";

  if (status === "pending_sender_payment") {
    return viewerRole === "initiator"
      ? {
          tone: "primary",
          title: "Вы отправляете первым",
          body: `Переведите ${a1} контрагенту, затем загрузите чек.`,
        }
      : {
          tone: "neutral",
          title: "Ожидаем отправки от контрагента",
          body: "Как только контрагент загрузит чек, вы увидите его здесь.",
        };
  }

  if (status === "sender_paid") {
    return viewerRole === "initiator"
      ? {
          tone: "primary",
          title: "Чек отправлен",
          body: "Ожидаем подтверждения от контрагента.",
        }
      : {
          tone: "primary",
          title: `Контрагент отправил ${a1}`,
          body: "Проверьте получение и подтвердите.",
        };
  }

  if (status === "counterparty_confirmed") {
    return viewerRole === "counterparty"
      ? {
          tone: "primary",
          title: "Подтверждено — ваша очередь",
          body: `Отправьте ${a2} контрагенту и загрузите чек.`,
        }
      : {
          tone: "primary",
          title: "Контрагент подтвердил получение",
          body: "Ожидаем встречного перевода.",
        };
  }

  if (status === "counterparty_paid") {
    return viewerRole === "initiator"
      ? {
          tone: "primary",
          title: `Контрагент отправил ${a2}`,
          body: "Проверьте получение и подтвердите.",
        }
      : {
          tone: "primary",
          title: "Чек отправлен",
          body: "Ожидаем подтверждения от контрагента.",
        };
  }

  if (status === "completed") {
    return {
      tone: "primary",
      title: "Сделка завершена",
      body: "Оба перевода подтверждены.",
    };
  }

  if (status === "disputed") {
    return {
      tone: "warning",
      title: "Спор открыт",
      body: "Мы свяжемся с обеими сторонами в течение 24 часов.",
    };
  }

  return {
    tone: "neutral",
    title: "Сделка отменена",
    body: "Объявление снова доступно в ленте.",
  };
}

function bgFor(tone: Tone): string {
  if (tone === "primary") return "var(--primary-soft)";
  if (tone === "warning") return "var(--warning-soft)";
  return "var(--surface)";
}

function inkFor(tone: Tone): string {
  if (tone === "primary") return "var(--primary-ink)";
  if (tone === "warning") return "var(--warning)";
  return "var(--text)";
}

export function StatusBanner(props: Props) {
  const { tone, title, body } = copyFor(props);
  return (
    <div
      style={{
        background: bgFor(tone),
        color: inkFor(tone),
        borderRadius: "var(--r-lg)",
        padding: "var(--s-4)",
        display: "flex",
        flexDirection: "column",
        gap: 4,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
      <div style={{ fontSize: 14, color: "var(--text-2)" }}>{body}</div>
    </div>
  );
}
