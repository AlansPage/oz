"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signAvatars } from "@/lib/avatar-url";
import {
  ProfileGateSheet,
  PROFILE_GATE_DISMISS_KEY,
} from "@/components/ProfileGateSheet";
import { PROFILE_COLUMNS } from "@/lib/profile-columns";
import { ListingCard } from "./ListingCard";
import { FilterBar, type DirectionFilter, type SortOption } from "./FilterBar";
import { Fab } from "./Fab";
import { PostListingSheet } from "./PostListingSheet";
import { SkeletonCard } from "./SkeletonCard";
import { EmptyState } from "./EmptyState";
import type { ListingInsert, ListingWithProfile, Profile } from "@/lib/types";

const PAGE_SIZE = 50;
const PULSE_MS = 1200;

type Props = {
  currentUserId: string;
  currentProfile: Profile;
};

export function FeedClient({ currentUserId, currentProfile }: Props) {
  const supabase = createClient();
  const router = useRouter();
  const [filter, setFilter] = useState<DirectionFilter>("all");
  const [sort, setSort] = useState<SortOption>("new");
  const [items, setItems] = useState<ListingWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>(currentProfile);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const scrollAnchor = useRef<HTMLDivElement>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("listings")
      .select(`*, profiles(${PROFILE_COLUMNS})`)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(PAGE_SIZE);

    if (filter !== "all") q = q.eq("direction", filter);

    if (sort === "new") {
      q = q.order("created_at", { ascending: false });
    } else if (sort === "rate") {
      q = q.order("rate", { ascending: false, nullsFirst: false });
    } else if (sort === "active") {
      q = q.order("last_active_at", {
        ascending: false,
        referencedTable: "profiles",
      });
    }

    const { data, error } = await q;
    if (!error && data) {
      const rows = data as unknown as ListingWithProfile[];
      const urlMap = await signAvatars(
        supabase,
        rows.map((r) => r.profiles?.avatar_url),
      );
      for (const r of rows) {
        const path = r.profiles?.avatar_url;
        if (path && urlMap.has(path)) {
          r.profiles.avatar_url = urlMap.get(path) ?? null;
        }
      }
      setItems(rows);
    }
    setLoading(false);
  }, [supabase, filter, sort]);

  const gateNeeded =
    !profile.display_name || !profile.avatar_url;

  function gateOrOpenPostSheet() {
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
    setSheetOpen(true);
  }

  async function refreshProfileAfterGate() {
    const { data } = await supabase
      .from("profiles")
      .select(PROFILE_COLUMNS)
      .eq("id", currentUserId)
      .maybeSingle();
    // phone is not selectable; preserve the owner's number from state.
    if (data)
      setProfile((prev) => ({ ...(data as Profile), phone: prev.phone }));
  }

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const onContact = useCallback(
    (id: string) => {
      router.push(`/listing/${id}`);
    },
    [router],
  );

  const onEdit = useCallback(
    (id: string) => {
      router.push(`/listing/${id}`);
    },
    [router],
  );

  const onWithdraw = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("listings")
        .update({ status: "withdrawn" })
        .eq("id", id);
      if (!error) setItems((prev) => prev.filter((x) => x.id !== id));
    },
    [supabase],
  );

  const onPost = useCallback(
    async (payload: Omit<ListingInsert, "user_id">) => {
      const { data, error } = await supabase
        .from("listings")
        .insert({ ...payload, user_id: currentUserId })
        .select(`*, profiles(${PROFILE_COLUMNS})`)
        .single();
      if (error) throw error;
      const newRow = data as unknown as ListingWithProfile;
      setItems((prev) => [newRow, ...prev]);
      setPulseId(newRow.id);
      window.setTimeout(() => setPulseId(null), PULSE_MS);
      scrollAnchor.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [supabase, currentUserId],
  );

  return (
    <>
      <FilterBar
        filter={filter}
        sort={sort}
        onFilterChange={setFilter}
        onSortChange={setSort}
      />
      <div ref={scrollAnchor} />
      <section className="px-4 lg:px-6 py-4 max-w-[960px] mx-auto w-full">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            variant="no-match"
            onCreate={gateOrOpenPostSheet}
            secondary={
              filter === "all"
                ? undefined
                : {
                    label: "Создать оповещение для этого направления",
                    onClick: () =>
                      router.push(`/alerts?direction=${filter}&create=1`),
                  }
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {items.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                currentUserId={currentUserId}
                pulse={listing.id === pulseId}
                onContact={onContact}
                onEdit={onEdit}
                onWithdraw={onWithdraw}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="oz-feed__disclaimer">
        öz — сообщество для прямого обмена. Платформа не участвует в передаче средств.{" "}
        <Link href="/terms">условия</Link>
        {" "}/{" "}
        <Link href="/privacy">конфиденциальность</Link>
      </footer>

      <Fab onClick={gateOrOpenPostSheet} />
      <PostListingSheet
        open={sheetOpen}
        userId={currentUserId}
        onClose={() => setSheetOpen(false)}
        onSubmit={onPost}
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
          setSheetOpen(true);
        }}
        onDefer={() => {
          setGateOpen(false);
          setSheetOpen(true);
        }}
      />
    </>
  );
}
