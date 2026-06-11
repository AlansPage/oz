"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Receipt } from "@/lib/types";

type Props = {
  receipt: Receipt;
  emphasize?: boolean;
};

export function ReceiptThumbnail({ receipt, emphasize }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.storage
      .from("receipts")
      .createSignedUrl(receipt.storage_path, 600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [receipt.storage_path]);

  const isPdf = receipt.storage_path.toLowerCase().endsWith(".pdf");
  const maxHeight = emphasize ? 360 : 160;

  if (!url) {
    return (
      <div
        className="oz-skeleton"
        style={{ height: maxHeight, borderRadius: "var(--r-md)" }}
      />
    );
  }

  if (isPdf) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="oz-btn oz-btn--ghost"
        style={{ alignSelf: "flex-start" }}
      >
        Открыть PDF
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer">
      <img
        src={url}
        alt="Чек"
        style={{
          maxWidth: "100%",
          maxHeight,
          borderRadius: "var(--r-md)",
          border: "1px solid var(--border)",
          display: "block",
        }}
      />
    </a>
  );
}
