"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/lib/types";

type Params = {
  transactionId: string;
  currentUserId: string;
};

type UseTransactionChat = {
  messages: ChatMessage[];
  /** Count of the counterparty's messages that are still unread. */
  unreadCount: number;
  /** Merge a just-sent message into the thread without waiting for a refetch. */
  appendMessage: (msg: ChatMessage) => void;
  /** Force a re-read of the thread from the database. */
  refresh: () => void;
};

const POLL_INTERVAL_MS = 15000;

/**
 * Owns everything needed to keep a transaction's chat thread live and in sync.
 *
 * Chat must never depend on a single socket staying healthy, so this hook runs
 * three redundant delivery paths, mirroring the rest of the transaction page:
 *   1. A realtime postgres_changes subscription on chat_messages INSERTs.
 *   2. realtime.setAuth() so the socket carries the user's JWT — postgres_changes
 *      are RLS-filtered by the token on the socket, and an anon/stale token makes
 *      the chat_messages SELECT policy yield zero rows, so the socket silently
 *      delivers nothing (the asymmetric "one side never receives" bug).
 *   3. A focus/visibility + light-interval refetch fallback that self-heals when
 *      realtime misses an INSERT.
 *
 * It runs on its own channel (separate from the transaction/receipts/ratings
 * channel) so the chat concern is fully self-contained.
 */
export function useTransactionChat({
  transactionId,
  currentUserId,
}: Params): UseTransactionChat {
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("transaction_id", transactionId)
      .order("created_at", { ascending: true });
    setMessages((data as unknown as ChatMessage[] | null) ?? []);
  }, [supabase, transactionId]);

  // Initial load.
  useEffect(() => {
    void fetchMessages();
  }, [fetchMessages]);

  // Realtime delivery + socket auth.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const refreshRealtimeAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      await supabase.realtime.setAuth(session?.access_token ?? null);
    };

    (async () => {
      await refreshRealtimeAuth();
      if (cancelled) return;

      channel = supabase
        .channel(`transaction-chat:${transactionId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `transaction_id=eq.${transactionId}`,
          },
          () => {
            void fetchMessages();
          },
        )
        .subscribe((status) => {
          // A postgres_changes subscription only starts delivering once it
          // reaches SUBSCRIBED, and with RLS a stale socket can silently deliver
          // nothing. Catch up on every (re)subscribe so the thread self-heals
          // after reconnects.
          if (status === "SUBSCRIBED") {
            void fetchMessages();
          }
        });
    })();

    // A refresh rotates the access token; a stale token on the socket would
    // quietly stop RLS-gated delivery, so keep the socket's token current.
    const { data: authSub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "TOKEN_REFRESHED" || event === "SIGNED_IN") {
        void refreshRealtimeAuth();
      }
    });

    return () => {
      cancelled = true;
      authSub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, transactionId, fetchMessages]);

  // Fallback sync: re-read when the tab regains focus/visibility, and on a light
  // interval while the tab is visible, in case realtime missed an INSERT.
  useEffect(() => {
    const syncWhileVisible = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      void fetchMessages();
    };
    const onFocus = () => {
      void fetchMessages();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") void fetchMessages();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(syncWhileVisible, POLL_INTERVAL_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [fetchMessages]);

  const unreadCount = useMemo(
    () =>
      messages.filter(
        (m) => m.sender_id !== currentUserId && m.read_at === null,
      ).length,
    [messages, currentUserId],
  );

  const appendMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) =>
      prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
    );
  }, []);

  return { messages, unreadCount, appendMessage, refresh: fetchMessages };
}
