"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signAvatar } from "@/lib/avatar-url";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import {
  directionFrom,
  directionTo,
  type ChatMessage,
  type Currency,
  type Profile,
  type Rating,
  type Receipt,
  type Transaction,
  type TransactionStatus,
} from "@/lib/types";
import { equivalentAmount, formatAmount, formatRate } from "@/lib/format";
import { StatusBanner } from "./StatusBanner";
import { ActionArea } from "./ActionArea";
import { ReceiptThumbnail } from "./ReceiptThumbnail";
import { ReceiptUploadSheet } from "./ReceiptUploadSheet";
import { DisputeSheet } from "./DisputeSheet";
import { RateForm, RatingReadOnly } from "./RatingCard";
import { ChatThread } from "./ChatThread";
import { ReceiptViewerSheet } from "./ReceiptViewerSheet";
import { SendScreen } from "./screens/SendScreen";
import { WaitScreen } from "./screens/WaitScreen";
import { ConfirmScreen } from "./screens/ConfirmScreen";
import { CompleteScreen } from "./screens/CompleteScreen";

type Props = {
  id: string;
  currentUserId: string;
};

export type TransactionWithProfiles = Transaction & {
  initiator: Profile;
  counterparty: Profile;
};

export type ViewerRole = "initiator" | "counterparty";

const STATUSES_HIDE_DISPUTE: TransactionStatus[] = [
  "completed",
  "cancelled",
  "disputed",
];

const SYMBOL: Record<Currency, string> = { KZT: "₸", KRW: "₩" };

export function TransactionDetailClient({ id, currentUserId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [tx, setTx] = useState<TransactionWithProfiles | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [counterpartyAvatarUrl, setCounterpartyAvatarUrl] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [viewerReceipt, setViewerReceipt] = useState<Receipt | null>(null);

  const fetchTx = useCallback(async () => {
    const { data } = await supabase
      .from("transactions")
      .select(
        `*, initiator:profiles!initiator_id(${PROFILE_COLUMNS}), counterparty:profiles!counterparty_id(${PROFILE_COLUMNS})`,
      )
      .eq("id", id)
      .maybeSingle();
    setTx((data as unknown as TransactionWithProfiles | null) ?? null);
  }, [supabase, id]);

  const fetchReceipts = useCallback(async () => {
    const { data } = await supabase
      .from("receipts")
      .select("*")
      .eq("transaction_id", id)
      .order("created_at", { ascending: true });
    setReceipts((data as unknown as Receipt[] | null) ?? []);
  }, [supabase, id]);

  const fetchRatings = useCallback(async () => {
    const { data } = await supabase
      .from("ratings")
      .select("*")
      .eq("transaction_id", id);
    setRatings((data as unknown as Rating[] | null) ?? []);
  }, [supabase, id]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("transaction_id", id)
      .order("created_at", { ascending: true });
    setMessages((data as unknown as ChatMessage[] | null) ?? []);
  }, [supabase, id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([
        fetchTx(),
        fetchReceipts(),
        fetchRatings(),
        fetchMessages(),
      ]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchTx, fetchReceipts, fetchRatings, fetchMessages]);

  useEffect(() => {
    const channel = supabase
      .channel(`transaction:${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "transactions",
          filter: `id=eq.${id}`,
        },
        () => {
          fetchTx();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "receipts",
          filter: `transaction_id=eq.${id}`,
        },
        () => {
          fetchReceipts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ratings",
          filter: `transaction_id=eq.${id}`,
        },
        () => {
          fetchRatings();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `transaction_id=eq.${id}`,
        },
        () => {
          fetchMessages();
        },
      )
      .subscribe((status) => {
        // Realtime is the primary live-update path, but a postgres_changes
        // subscription only starts delivering once it reaches SUBSCRIBED — and
        // with RLS, an unauthenticated/stale socket can silently deliver
        // nothing. On every (re)subscribe, catch up on anything that arrived
        // before the channel was live so the thread self-heals after reconnects.
        if (status === "SUBSCRIBED") {
          fetchMessages();
          fetchTx();
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, id, fetchTx, fetchReceipts, fetchRatings, fetchMessages]);

  // Fallback sync: chat must never depend on a single socket staying healthy.
  // If realtime silently misses an INSERT (dropped/unauthenticated socket), the
  // receiving party would otherwise never see the message until a full reload —
  // the asymmetric "one side can't receive" bug. Re-sync when the tab regains
  // focus/visibility, and on a light interval while the tab is visible.
  useEffect(() => {
    const syncMessages = () => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      fetchMessages();
    };
    const syncOnFocus = () => {
      fetchMessages();
      fetchTx();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") syncOnFocus();
    };
    window.addEventListener("focus", syncOnFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const interval = window.setInterval(syncMessages, 15000);
    return () => {
      window.removeEventListener("focus", syncOnFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [fetchMessages, fetchTx]);

  useEffect(() => {
    if (!tx) {
      setCounterpartyAvatarUrl(null);
      return;
    }
    const role: ViewerRole =
      tx.initiator_id === currentUserId ? "initiator" : "counterparty";
    const path =
      role === "initiator" ? tx.counterparty.avatar_url : tx.initiator.avatar_url;
    let cancelled = false;
    void signAvatar(supabase, path).then((url) => {
      if (!cancelled) setCounterpartyAvatarUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [supabase, tx, currentUserId]);

  if (loading) {
    return (
      <section className="oz-listing-page">
        <div className="oz-skeleton" style={{ height: 18, width: 120 }} />
        <div className="oz-skeleton" style={{ height: 96 }} />
        <div className="oz-skeleton" style={{ height: 240 }} />
      </section>
    );
  }

  if (!tx) {
    return (
      <section className="oz-listing-page">
        <button className="oz-listing-back" onClick={() => router.push("/feed")}>
          <span className="oz-listing-back__arrow" aria-hidden>
            ←
          </span>
          <span>Сделка</span>
        </button>
        <div className="oz-listing-empty">
          <div className="oz-listing-empty__title">Сделка не найдена</div>
          <div className="oz-listing-empty__copy">
            Возможно, у вас нет доступа к этой сделке.
          </div>
          <button
            className="oz-btn oz-btn--primary"
            onClick={() => router.push("/feed")}
          >
            Вернуться к ленте
          </button>
        </div>
      </section>
    );
  }

  const viewerRole: ViewerRole =
    tx.initiator_id === currentUserId ? "initiator" : "counterparty";
  const counterpartyProfile =
    viewerRole === "initiator" ? tx.counterparty : tx.initiator;

  const from = directionFrom(tx.direction);
  const to = directionTo(tx.direction);
  const amount = Number(tx.amount);
  const rate = tx.rate !== null ? Number(tx.rate) : null;
  const equivalent =
    rate !== null ? equivalentAmount(amount, from, rate, rate) : null;
  const shortId = tx.id.slice(0, 8);

  const initiatorReceipt = receipts.find((r) => r.side === "initiator") ?? null;
  const counterpartyReceipt =
    receipts.find((r) => r.side === "counterparty") ?? null;

  const showDispute = !STATUSES_HIDE_DISPUTE.includes(tx.status);

  const counterpartyId =
    viewerRole === "initiator" ? tx.counterparty_id : tx.initiator_id;
  const myRating = ratings.find((r) => r.rater_id === currentUserId) ?? null;
  const theirRating =
    ratings.find((r) => r.rater_id === counterpartyId) ?? null;

  const chatClosedReason: "completed" | "cancelled" | "disputed" | null =
    tx.status === "completed"
      ? "completed"
      : tx.status === "cancelled"
        ? "cancelled"
        : tx.status === "disputed"
          ? "disputed"
          : null;
  const counterpartyUnreadCount = messages.filter(
    (m) => m.sender_id !== currentUserId && m.read_at === null,
  ).length;

  const onBack = () => router.push("/feed");
  const onDispute = () => setDisputeOpen(true);
  const handleCancel = async () => {
    await supabase.rpc("advance_transaction", {
      p_transaction_id: tx.id,
      p_action: "cancel",
    });
    fetchTx();
  };
  const handleConfirmReceived = async () => {
    await supabase.rpc("advance_transaction", {
      p_transaction_id: tx.id,
      p_action: "counterparty_confirm",
    });
    fetchTx();
  };
  const handleSubmitRating = async (stars: number) => {
    await supabase.from("ratings").insert({
      transaction_id: tx.id,
      rater_id: currentUserId,
      ratee_id: counterpartyId,
      stars,
      tags: [],
      comment: null,
    });
    await fetchRatings();
  };

  // v0.4 redesigned visual layers. Other status × viewer combinations keep
  // the legacy layout below.
  const isSend =
    tx.status === "pending_sender_payment" && viewerRole === "initiator";
  const isWait = tx.status === "sender_paid" && viewerRole === "initiator";
  const isConfirm =
    tx.status === "sender_paid" && viewerRole === "counterparty";
  const isComplete = tx.status === "completed";
  const isRedesigned = isSend || isWait || isConfirm || isComplete;

  let screen: ReactNode = null;
  if (isSend) {
    screen = (
      <SendScreen
        shortId={shortId}
        transactionId={tx.id}
        counterparty={counterpartyProfile}
        amount={amount}
        equivalent={equivalent}
        from={from}
        to={to}
        rateLockedAt={tx.rate_locked_at}
        onConfirmSent={() => setUploadOpen(true)}
        onCancel={handleCancel}
        onBack={onBack}
      />
    );
  } else if (isWait) {
    screen = (
      <WaitScreen
        shortId={shortId}
        counterparty={counterpartyProfile}
        receipt={initiatorReceipt}
        amount={amount}
        from={from}
        equivalent={equivalent}
        to={to}
        rate={rate}
        onOpenReceipt={() =>
          initiatorReceipt && setViewerReceipt(initiatorReceipt)
        }
        onDispute={onDispute}
        onBack={onBack}
      />
    );
  } else if (isConfirm) {
    screen = (
      <ConfirmScreen
        shortId={shortId}
        counterparty={counterpartyProfile}
        receipt={initiatorReceipt}
        amount={amount}
        from={from}
        rate={rate}
        paidAt={tx.initiator_paid_at}
        onConfirmReceived={handleConfirmReceived}
        onDispute={onDispute}
        onBack={onBack}
      />
    );
  } else if (isComplete) {
    const gaveValue =
      viewerRole === "initiator"
        ? formatAmount(amount, from)
        : equivalent !== null
          ? formatAmount(equivalent, to)
          : "—";
    const gotValue =
      viewerRole === "initiator"
        ? equivalent !== null
          ? formatAmount(equivalent, to)
          : "—"
        : formatAmount(amount, from);
    const completeReceipt = initiatorReceipt ?? counterpartyReceipt;
    screen = (
      <CompleteScreen
        shortId={shortId}
        otherName={counterpartyProfile.display_name ?? "контрагента"}
        gaveValue={gaveValue}
        gotValue={gotValue}
        rate={rate}
        completedAt={tx.completed_at}
        alreadyRated={myRating !== null}
        myStars={myRating?.stars ?? null}
        hasReceipt={completeReceipt !== null}
        onSubmitRating={handleSubmitRating}
        onOpenReceipt={() =>
          completeReceipt && setViewerReceipt(completeReceipt)
        }
        onDone={onBack}
      />
    );
  }

  const chatSection = (
    <section className="oz-listing-about" aria-label="Чат">
      <div className="oz-chat__header">
        <span className="oz-chat__title">Чат с контрагентом</span>
        {counterpartyUnreadCount > 0 && (
          <span className="oz-chat__unread">{counterpartyUnreadCount}</span>
        )}
      </div>
      <ChatThread
        transactionId={tx.id}
        currentUserId={currentUserId}
        counterpartyAvatarUrl={counterpartyAvatarUrl}
        counterpartyName={counterpartyProfile.display_name}
        counterpartyPhone={counterpartyProfile.phone_masked}
        messages={messages}
        isClosed={chatClosedReason !== null}
        closedReason={chatClosedReason}
        onSent={(msg) =>
          setMessages((prev) =>
            prev.some((m) => m.id === msg.id) ? prev : [...prev, msg],
          )
        }
      />
    </section>
  );

  return (
    <>
      {isRedesigned ? (
        <div className="tx-route">
          <div className="tx-route__col">
            {screen}
            {chatSection}
          </div>
        </div>
      ) : (
        <section className="oz-listing-page">
          {/* TODO: v0.4 design pending for this status × viewer combination */}
          <button
            className="oz-listing-back"
            onClick={() => router.push("/feed")}
          >
            <span className="oz-listing-back__arrow" aria-hidden>
              ←
            </span>
            <span>Сделка #{shortId}</span>
          </button>

      <StatusBanner
        status={tx.status}
        viewerRole={viewerRole}
        amount={amount}
        from={from}
        to={to}
        equivalent={equivalent}
      />

      <div className="oz-listing-about">
        <div className="oz-listing-about__title">Контрагент</div>
        <div className="oz-listing-about__line" style={{ fontWeight: 600 }}>
          {counterpartyProfile.display_name ?? "Без имени"}
        </div>
        <div className="oz-listing-about__line">
          {counterpartyProfile.rating_count > 0
            ? `${counterpartyProfile.rating_count} оценок`
            : "Пока без отзывов"}
        </div>
      </div>

      <div className="oz-listing-hero">
        <div className="oz-listing-hero__direction">
          {SYMBOL[from]} → {SYMBOL[to]}
        </div>
        <div className="oz-listing-hero__amount">
          {formatAmount(amount, from)}
        </div>
        {rate !== null && (
          <div className="oz-listing-hero__rateline">
            Курс {formatRate(rate)} ₩/₸
          </div>
        )}
        {equivalent !== null && (
          <div className="oz-listing-hero__equivalent">
            ≈ {formatAmount(equivalent, to)}
          </div>
        )}
      </div>

      {/* Receipt previews — visible whenever a receipt for that side exists */}
      {(initiatorReceipt || counterpartyReceipt) && (
        <div
          className="oz-listing-about"
          style={{ gap: "var(--s-3)" }}
        >
          <div className="oz-listing-about__title">Чеки</div>
          {initiatorReceipt && (
            <div
              className="oz-listing-about__line"
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span>
                {viewerRole === "initiator"
                  ? "Ваш чек"
                  : `Чек от ${counterpartyProfile.display_name ?? "контрагента"}`}
              </span>
              <ReceiptThumbnail
                receipt={initiatorReceipt}
                emphasize={
                  tx.status === "sender_paid" && viewerRole === "counterparty"
                }
              />
            </div>
          )}
          {counterpartyReceipt && (
            <div
              className="oz-listing-about__line"
              style={{ display: "flex", flexDirection: "column", gap: 6 }}
            >
              <span>
                {viewerRole === "counterparty"
                  ? "Ваш чек"
                  : `Чек от ${counterpartyProfile.display_name ?? "контрагента"}`}
              </span>
              <ReceiptThumbnail
                receipt={counterpartyReceipt}
                emphasize={
                  tx.status === "counterparty_paid" && viewerRole === "initiator"
                }
              />
            </div>
          )}
        </div>
      )}

      {tx.status === "completed" && !myRating && (
        <RateForm
          transactionId={tx.id}
          raterId={currentUserId}
          rateeId={counterpartyId}
          onSubmitted={() => fetchRatings()}
        />
      )}

      {tx.status === "completed" && myRating && (
        <RatingReadOnly title="Ваша оценка" rating={myRating} />
      )}

      {tx.status === "completed" && theirRating && (
        <RatingReadOnly title="Контрагент оценил вас" rating={theirRating} />
      )}

      <ActionArea
        status={tx.status}
        viewerRole={viewerRole}
        disputeReason={tx.dispute_reason}
        disputeDescription={tx.dispute_description}
        disputedByYou={tx.disputed_by === currentUserId}
        onUpload={() => setUploadOpen(true)}
        onConfirmCounterpartyReceived={async () => {
          await supabase.rpc("advance_transaction", {
            p_transaction_id: tx.id,
            p_action: "counterparty_confirm",
          });
          fetchTx();
        }}
        onConfirmInitiatorReceived={async () => {
          await supabase.rpc("advance_transaction", {
            p_transaction_id: tx.id,
            p_action: "initiator_confirm",
          });
          fetchTx();
        }}
        onCancel={async () => {
          await supabase.rpc("advance_transaction", {
            p_transaction_id: tx.id,
            p_action: "cancel",
          });
          fetchTx();
        }}
      />

      {chatSection}

      {showDispute && (
        <button
          className="oz-btn oz-btn--ghost"
          onClick={() => setDisputeOpen(true)}
        >
          Сообщить о проблеме
        </button>
      )}
        </section>
      )}

      <ReceiptUploadSheet
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        transactionId={tx.id}
        side={
          tx.status === "pending_sender_payment" ? "initiator" : "counterparty"
        }
        expectedAmount={
          tx.status === "pending_sender_payment"
            ? amount
            : equivalent ?? amount
        }
        currency={tx.status === "pending_sender_payment" ? from : to}
        uploaderId={currentUserId}
        onUploaded={() => {
          // The realtime channel will fire; refetch eagerly too in case
          // the local writer beats the realtime delivery.
          fetchReceipts();
          fetchTx();
        }}
      />

      <DisputeSheet
        open={disputeOpen}
        onClose={() => setDisputeOpen(false)}
        transactionId={tx.id}
        onOpened={() => fetchTx()}
      />

      <ReceiptViewerSheet
        open={viewerReceipt !== null}
        onClose={() => setViewerReceipt(null)}
        receipt={viewerReceipt}
      />
    </>
  );
}
