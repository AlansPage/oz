"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  directionFrom,
  directionTo,
  type Currency,
  type Profile,
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
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);

  const fetchTx = useCallback(async () => {
    const { data } = await supabase
      .from("transactions")
      .select(
        "*, initiator:profiles!initiator_id(*), counterparty:profiles!counterparty_id(*)",
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([fetchTx(), fetchReceipts()]);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchTx, fetchReceipts]);

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, id, fetchTx, fetchReceipts]);

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

  return (
    <section className="oz-listing-page">
      <button className="oz-listing-back" onClick={() => router.push("/feed")}>
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

      {showDispute && (
        <button
          className="oz-btn oz-btn--ghost"
          onClick={() => setDisputeOpen(true)}
        >
          Сообщить о проблеме
        </button>
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
    </section>
  );
}
