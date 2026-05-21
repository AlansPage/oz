"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/feed/Avatar";
import type { ChatMessage } from "@/lib/types";

type ClosedReason = "completed" | "cancelled" | "disputed";

type Props = {
  transactionId: string;
  currentUserId: string;
  counterpartyAvatarUrl: string | null;
  counterpartyName: string | null;
  counterpartyPhone: string | null;
  messages: ChatMessage[];
  isClosed: boolean;
  closedReason: ClosedReason | null;
  onSent: (msg: ChatMessage) => void;
};

type OptimisticMessage = {
  tempId: string;
  body: string;
  sentAt: string;
};

const timeFmt = new Intl.DateTimeFormat("ru-RU", {
  hour: "2-digit",
  minute: "2-digit",
});

const NEAR_BOTTOM_PX = 80;
const MARK_READ_DEBOUNCE_MS = 1000;

const ERROR_COPY: Record<string, string> = {
  rate_limited: "Слишком много сообщений. Подождите минуту.",
  transaction_closed: "Чат закрыт. Сделка завершена.",
  empty_message: "Не удалось отправить.",
  message_too_long: "Не удалось отправить.",
};

const CLOSED_BANNER: Record<ClosedReason, string> = {
  completed: "Сделка завершена. Чат недоступен.",
  cancelled: "Сделка завершена. Чат недоступен.",
  disputed: "Открыт спор. Чат недоступен.",
};

function mapRpcError(message: string | null | undefined): string {
  const m = (message ?? "").toLowerCase();
  for (const key of Object.keys(ERROR_COPY)) {
    if (m.includes(key)) return ERROR_COPY[key];
  }
  return "Не удалось отправить. Попробуйте ещё раз.";
}

export function ChatThread({
  transactionId,
  currentUserId,
  counterpartyAvatarUrl,
  counterpartyName,
  counterpartyPhone,
  messages,
  isClosed,
  closedReason,
  onSent,
}: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [composer, setComposer] = useState("");
  const [sending, setSending] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [optimistic, setOptimistic] = useState<OptimisticMessage[]>([]);
  const [showNewPill, setShowNewPill] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const nearBottomRef = useRef<boolean>(true);
  const lastMarkedAtRef = useRef<number>(0);
  const prevCounterpartyCountRef = useRef<number>(0);
  const didInitialScrollRef = useRef<boolean>(false);

  const counterpartyUnread = useMemo(
    () =>
      messages.filter(
        (m) => m.sender_id !== currentUserId && m.read_at === null,
      ).length,
    [messages, currentUserId],
  );

  const counterpartyCount = useMemo(
    () => messages.filter((m) => m.sender_id !== currentUserId).length,
    [messages, currentUserId],
  );

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setShowNewPill(false);
  }, []);

  const markReadIfNeeded = useCallback(
    (force = false) => {
      if (counterpartyUnread === 0) return;
      const now = Date.now();
      if (!force && now - lastMarkedAtRef.current < MARK_READ_DEBOUNCE_MS) return;
      lastMarkedAtRef.current = now;
      void supabase.rpc("mark_messages_read", {
        p_transaction_id: transactionId,
      });
    },
    [supabase, transactionId, counterpartyUnread],
  );

  // First-load scroll + mark-as-read
  useEffect(() => {
    if (didInitialScrollRef.current) return;
    if (messages.length === 0) return;
    didInitialScrollRef.current = true;
    scrollToBottom("auto");
    if (typeof document === "undefined" || document.visibilityState === "visible") {
      markReadIfNeeded(true);
    }
  }, [messages.length, scrollToBottom, markReadIfNeeded]);

  // React to incoming counterparty messages: auto-scroll or show pill
  useEffect(() => {
    const prev = prevCounterpartyCountRef.current;
    if (counterpartyCount > prev) {
      if (nearBottomRef.current) {
        scrollToBottom("smooth");
      } else {
        setShowNewPill(true);
      }
      if (
        typeof document === "undefined" ||
        document.visibilityState === "visible"
      ) {
        markReadIfNeeded();
      }
    }
    prevCounterpartyCountRef.current = counterpartyCount;
  }, [counterpartyCount, scrollToBottom, markReadIfNeeded]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    nearBottomRef.current = distanceFromBottom < NEAR_BOTTOM_PX;
    if (nearBottomRef.current && showNewPill) setShowNewPill(false);
  }

  function autosize() {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
  }

  useEffect(() => {
    autosize();
  }, [composer]);

  async function send() {
    const trimmed = composer.trim();
    if (!trimmed || sending) return;
    if (trimmed.length > 1000) {
      setInlineError("Не удалось отправить.");
      return;
    }
    const tempId =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `tmp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticEntry: OptimisticMessage = {
      tempId,
      body: trimmed,
      sentAt: new Date().toISOString(),
    };
    setOptimistic((prev) => [...prev, optimisticEntry]);
    setComposer("");
    setInlineError(null);
    setSending(true);

    const { data, error } = await supabase.rpc("send_chat_message", {
      p_transaction_id: transactionId,
      p_body: trimmed,
    });

    setSending(false);
    setOptimistic((prev) => prev.filter((o) => o.tempId !== tempId));

    if (error) {
      setInlineError(mapRpcError(error.message));
      // Keep the unsent body in the composer so the user can retry/edit
      setComposer(trimmed);
      return;
    }
    if (data) {
      onSent(data as ChatMessage);
    }
    scrollToBottom("smooth");
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const composerDisabled = isClosed || sending;

  const renderedMessages = messages.slice();
  const hasContent = renderedMessages.length > 0 || optimistic.length > 0;

  return (
    <div className="oz-chat">
      <div
        className="oz-chat__list"
        ref={listRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
      >
        {!hasContent && !isClosed && (
          <div className="oz-chat__empty">
            Напишите контрагенту, чтобы согласовать детали перевода.
          </div>
        )}
        {!hasContent && isClosed && (
          <div className="oz-chat__empty">Сообщений не было.</div>
        )}
        {renderedMessages.map((m) => {
          const own = m.sender_id === currentUserId;
          return (
            <div
              key={m.id}
              className={`oz-chat__row ${own ? "oz-chat__row--own" : "oz-chat__row--other"}`}
            >
              {!own && (
                <Avatar
                  url={counterpartyAvatarUrl}
                  name={counterpartyName}
                  phone={counterpartyPhone}
                  size="xs"
                />
              )}
              <div
                className={
                  "oz-chat__bubble " +
                  (own ? "oz-chat__bubble--own" : "oz-chat__bubble--other") +
                  (m.flagged ? " oz-chat__bubble--flagged" : "")
                }
              >
                <span>{m.body}</span>
                <span className="oz-chat__timestamp">
                  {timeFmt.format(new Date(m.created_at))}
                </span>
              </div>
            </div>
          );
        })}
        {optimistic.map((o) => (
          <div
            key={o.tempId}
            className="oz-chat__row oz-chat__row--own"
          >
            <div className="oz-chat__bubble oz-chat__bubble--own oz-chat__bubble--pending">
              <span>{o.body}</span>
              <span className="oz-chat__timestamp">
                {timeFmt.format(new Date(o.sentAt))}
              </span>
            </div>
          </div>
        ))}
      </div>

      {showNewPill && (
        <button
          type="button"
          className="oz-chat__newpill"
          onClick={() => scrollToBottom("smooth")}
        >
          ↓ Новое сообщение
        </button>
      )}

      {isClosed && closedReason && (
        <div className="oz-chat__banner">{CLOSED_BANNER[closedReason]}</div>
      )}

      {!isClosed && (
        <>
          <div className="oz-chat__composer">
            <textarea
              ref={textareaRef}
              className="oz-chat__textarea"
              placeholder="Сообщение..."
              value={composer}
              maxLength={1000}
              rows={1}
              disabled={composerDisabled}
              onChange={(e) => setComposer(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <button
              type="button"
              className="oz-btn oz-btn--primary oz-chat__send"
              onClick={() => void send()}
              disabled={composerDisabled || composer.trim().length === 0}
            >
              {sending ? "…" : "Отправить"}
            </button>
          </div>
          {inlineError && (
            <p className="oz-chat__error">{inlineError}</p>
          )}
        </>
      )}
    </div>
  );
}
