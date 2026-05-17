"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ListingCard } from "./ListingCard";
import { FilterBar, type DirectionFilter, type SortOption } from "./FilterBar";
import { Fab } from "./Fab";
import { PostListingSheet } from "./PostListingSheet";
import { SkeletonCard } from "./SkeletonCard";
import { EmptyState } from "./EmptyState";
import type { ListingInsert, ListingWithProfile } from "@/lib/types";

const PAGE_SIZE = 50;
const PULSE_MS = 1200;

type Props = {
  currentUserId: string;
};

export function FeedClient({ currentUserId }: Props) {
  const supabase = createClient();
  const [filter, setFilter] = useState<DirectionFilter>("all");
  const [sort, setSort] = useState<SortOption>("new");
  const [items, setItems] = useState<ListingWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const scrollAnchor = useRef<HTMLDivElement>(null);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("listings")
      .select("*, profiles(*)")
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
      setItems(data as unknown as ListingWithProfile[]);
    }
    setLoading(false);
  }, [supabase, filter, sort]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const onContact = useCallback((id: string) => {
    console.log("contact", id);
  }, []);

  const onEdit = useCallback((id: string) => {
    console.log("edit", id);
    setSheetOpen(true);
  }, []);

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
        .select("*, profiles(*)")
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
            onCreate={() => setSheetOpen(true)}
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

      <Fab onClick={() => setSheetOpen(true)} />
      <PostListingSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSubmit={onPost}
      />
    </>
  );
}
