"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signAvatar } from "@/lib/avatar-url";
import {
  ProfileGateSheet,
  PROFILE_GATE_DISMISS_KEY,
} from "@/components/ProfileGateSheet";
import type { ListingWithProfile, Profile } from "@/lib/types";
import { ListingHero } from "./ListingHero";
import { ContactActions } from "./ContactActions";
import { EditActions } from "./EditActions";
import { AboutUser } from "./AboutUser";
import { ConfirmTransactionSheet } from "./ConfirmTransactionSheet";
import { formatAmountInput } from "@/lib/format";

type Props = {
  id: string;
  currentUserId: string;
  currentProfile: Profile;
};

export type EditForm = {
  amountStr: string;
  rateStr: string;
  note: string;
};

function initialEditForm(listing: ListingWithProfile): EditForm {
  return {
    amountStr: formatAmountInput(String(listing.amount)),
    rateStr:
      listing.rate !== null
        ? String(listing.rate).replace(".", ",")
        : "",
    note: listing.note ?? "",
  };
}

export function ListingDetailClient({
  id,
  currentUserId,
  currentProfile,
}: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [listing, setListing] = useState<ListingWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>(currentProfile);
  const [editForm, setEditForm] = useState<EditForm | null>(null);

  const fetchListing = useCallback(async () => {
    const { data } = await supabase
      .from("listings")
      .select("*, profiles(*)")
      .eq("id", id)
      .maybeSingle();
    let fetched = (data as unknown as ListingWithProfile | null) ?? null;
    if (fetched?.profiles?.avatar_url) {
      const signed = await signAvatar(supabase, fetched.profiles.avatar_url);
      fetched = {
        ...fetched,
        profiles: { ...fetched.profiles, avatar_url: signed },
      };
    }
    setListing(fetched);
    if (fetched && fetched.user_id === currentUserId) {
      setEditForm(initialEditForm(fetched));
    }
    setLoading(false);
  }, [supabase, id, currentUserId]);

  const gateNeeded = !profile.display_name || !profile.avatar_url;

  function startDealOrGate() {
    let dismissed = false;
    try {
      dismissed =
        typeof window !== "undefined" &&
        window.sessionStorage.getItem(PROFILE_GATE_DISMISS_KEY) === "1";
    } catch {
      dismissed = false;
    }
    if (gateNeeded && !dismissed) {
      setGateOpen(true);
      return;
    }
    setConfirmOpen(true);
  }

  async function refreshProfileAfterGate() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUserId)
      .maybeSingle();
    if (data) setProfile(data as Profile);
  }

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  const isOwner = listing?.user_id === currentUserId;

  if (loading) {
    return (
      <section className="oz-listing-page">
        <div className="oz-skeleton" style={{ height: 18, width: 120 }} />
        <div className="oz-skeleton" style={{ height: 280 }} />
        <div className="oz-skeleton" style={{ height: 56 }} />
      </section>
    );
  }

  if (!listing) {
    return (
      <section className="oz-listing-page">
        <button className="oz-listing-back" onClick={() => router.back()}>
          <span className="oz-listing-back__arrow" aria-hidden>←</span>
          <span>Объявление</span>
        </button>
        <div className="oz-listing-empty">
          <div className="oz-listing-empty__title">Объявление не найдено</div>
          <div className="oz-listing-empty__copy">
            Возможно, оно было снято или истекло.
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

  if (listing.status !== "active") {
    return (
      <section className="oz-listing-page">
        <button className="oz-listing-back" onClick={() => router.back()}>
          <span className="oz-listing-back__arrow" aria-hidden>←</span>
          <span>Объявление</span>
        </button>
        <div className="oz-listing-empty">
          <div className="oz-listing-empty__title">
            Это объявление уже неактивно
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

  return (
    <section className="oz-listing-page">
      <button className="oz-listing-back" onClick={() => router.back()}>
        <span className="oz-listing-back__arrow" aria-hidden>←</span>
        <span>Объявление</span>
      </button>

      <ListingHero
        listing={listing}
        editForm={isOwner ? editForm : null}
        onEditChange={setEditForm}
      />

      {isOwner && editForm ? (
        <EditActions
          listing={listing}
          editForm={editForm}
          onSaved={(updated) => {
            setListing(updated);
            setEditForm(initialEditForm(updated));
          }}
          onWithdrawn={() => router.push("/feed")}
        />
      ) : (
        <ContactActions onStartDeal={startDealOrGate} />
      )}

      <AboutUser profile={listing.profiles} />

      {!isOwner && (
        <>
          <ConfirmTransactionSheet
            open={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            listing={listing}
            currentUserId={currentUserId}
          />
          <ProfileGateSheet
            open={gateOpen}
            userId={currentUserId}
            phone={profile.phone}
            currentDisplayName={profile.display_name}
            currentAvatarPath={profile.avatar_url}
            onComplete={async () => {
              await refreshProfileAfterGate();
              setGateOpen(false);
              setConfirmOpen(true);
            }}
            onDefer={() => {
              setGateOpen(false);
              setConfirmOpen(true);
            }}
          />
        </>
      )}
    </section>
  );
}
