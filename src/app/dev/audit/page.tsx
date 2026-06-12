"use client";

// Dev-only screenshot harness for the Phase 3-5 visual-consistency audit.
// Renders one audited surface per ?s= value with mock data so Playwright can
// capture states that need auth + specific DB rows in the real app. Network
// is stubbed at the Playwright layer (route interception of /rest/v1/*).
// Returns 404 outside development; never linked from the product.

import "@/styles/transaction.css";
import { notFound, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { PaymentMethodForm } from "@/components/profile/PaymentMethodForm";
import { ListingCard } from "@/components/feed/ListingCard";
import { RateProvider } from "@/components/feed/RateContext";
import { SendScreen } from "@/app/transaction/[id]/screens/SendScreen";
import { NameMismatchPanel } from "@/app/transaction/[id]/NameMismatchPanel";
import { ConfirmTransactionSheet } from "@/app/listing/[id]/ConfirmTransactionSheet";
import { ContactActions } from "@/app/listing/[id]/ContactActions";
import { ListingHero } from "@/app/listing/[id]/ListingHero";
import { AboutUser } from "@/app/listing/[id]/AboutUser";
import type { Profile, ListingWithProfile } from "@/lib/types";
import type { TransactionWithProfiles } from "@/app/transaction/[id]/TransactionDetailClient";
import { formatAmount } from "@/lib/format";

const NOW = "2026-06-01T10:00:00Z";

const profile = (over: Partial<Profile> = {}): Profile =>
  ({
    id: "00000000-0000-0000-0000-000000000001",
    display_name: "Айгерим Н.",
    phone: null,
    phone_masked: "+7 700 *** ** 47",
    avatar_url: null,
    rating_avg: 4.8,
    deals_count: 12,
    verification_tier: "phone_id",
    created_at: "2025-11-12T10:00:00Z",
    ...over,
  }) as unknown as Profile;

const listing = (over: Record<string, unknown> = {}): ListingWithProfile =>
  ({
    id: "00000000-0000-0000-0000-00000000000a",
    user_id: "00000000-0000-0000-0000-000000000001",
    direction: "kzt_to_krw",
    amount: 750000,
    amount_currency: "KZT",
    rate: 3.42,
    note: "Перевод сегодня до 18:00, Kaspi.",
    status: "active",
    created_at: NOW,
    expires_at: "2026-06-01T22:00:00Z",
    profiles: profile(),
    ...over,
  }) as unknown as ListingWithProfile;

const tx = (over: Record<string, unknown> = {}): TransactionWithProfiles =>
  ({
    id: "00000000-0000-0000-0000-00000000000b",
    listing_id: "00000000-0000-0000-0000-00000000000a",
    initiator_id: "00000000-0000-0000-0000-000000000002",
    counterparty_id: "00000000-0000-0000-0000-000000000001",
    direction: "kzt_to_krw",
    amount: 750000,
    amount_currency: "KZT",
    rate: 3.42,
    status: "pending_sender_payment",
    created_at: NOW,
    rate_locked_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    name_mismatch_at: NOW,
    name_mismatch_by: "00000000-0000-0000-0000-000000000002",
    initiator: profile({ id: "00000000-0000-0000-0000-000000000002", display_name: "Бек Т." }),
    counterparty: profile(),
    ...over,
  }) as unknown as TransactionWithProfiles;

const noop = () => {};
const noopAsync = async () => {};

function Surface() {
  const params = useSearchParams();
  const s = params.get("s") ?? "";

  // tx-* layer surfaces render inside the real route container so the tint,
  // column width and gutters match production.
  const txWrap = (node: React.ReactNode) => (
    <div className="tx-route" style={{ minHeight: "100dvh" }}>
      <div className="tx-route__col">{node}</div>
    </div>
  );
  // oz-* listing surfaces render inside the real page container.
  const listWrap = (node: React.ReactNode) => (
    <section className="oz-listing-page">{node}</section>
  );

  switch (s) {
    case "pm-form":
      return (
        <div
          className="oz-sheet"
          style={{
            position: "static",
            animation: "none",
            transform: "none",
            margin: "0 auto",
          }}
        >
          <h2 className="oz-sheet__title">Реквизиты (KZT)</h2>
          <PaymentMethodForm currency="KZT" onSaved={noop} onCancel={noop} />
        </div>
      );
    case "send":
    case "send-frozen":
    case "send-changed":
    case "send-nopm":
      return txWrap(
        <SendScreen
          shortId="0000000b"
          transactionId="00000000-0000-0000-0000-00000000000b"
          counterparty={profile()}
          amount={750000}
          equivalent={2565000}
          from="KZT"
          to="KRW"
          rateLockedAt={new Date(Date.now() + 10 * 60_000).toISOString()}
          nameMismatchAt={s === "send-frozen" ? NOW : null}
          onReportMismatch={noopAsync}
          onConfirmSent={noop}
          onCancel={noop}
          onBack={noop}
        />,
      );
    case "mismatch-panel":
      return txWrap(
        <>
          <NameMismatchPanel
            tx={tx()}
            currentUserId="00000000-0000-0000-0000-000000000001"
            onResolved={noop}
          />
          <div className="tx-card">
            <div className="tx-twoside">
              <div className="tx-twoside__side">
                <div className="tx-twoside__label">Вы отправляете</div>
                <div className="tx-twoside__value">2 565 000 ₩</div>
              </div>
              <div className="tx-twoside__arrow">→</div>
              <div className="tx-twoside__side tx-twoside__side--receive">
                <div className="tx-twoside__label">Получаете</div>
                <div className="tx-twoside__value">750 000 ₸</div>
              </div>
            </div>
          </div>
        </>,
      );
    case "cap-button":
      return listWrap(
        <ContactActions
          onStartDeal={noop}
          capNotice={`Лимит первой сделки — ${formatAmount(500_000, "KZT")}`}
        />,
      );
    case "confirm-sheet":
      return (
        <RateProvider>
          <ConfirmTransactionSheet open onClose={noop} listing={listing()} />
        </RateProvider>
      );
    case "listing-card":
      return (
        <RateProvider>
          <div style={{ maxWidth: 560, margin: "0 auto", padding: 16 }}>
            <ListingCard
              listing={listing()}
              currentUserId="other"
              onContact={noop}
              onEdit={noop}
              onWithdraw={noop}
            />
          </div>
        </RateProvider>
      );
    case "listing-hero":
      return (
        <RateProvider>
          {listWrap(
            <>
              <ListingHero listing={listing()} editForm={null} onEditChange={noop} />
              <AboutUser profile={profile()} />
            </>,
          )}
        </RateProvider>
      );
    default:
      return <p style={{ padding: 24 }}>unknown surface: {s}</p>;
  }
}

export default function AuditPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <Suspense fallback={null}>
      <Surface />
    </Suspense>
  );
}
