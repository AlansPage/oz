"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import type { Receipt } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  receipt: Receipt | null;
};

// Full-receipt viewer. The redesigned screens show a structured summary or a
// hero image inline; this sheet reveals the full screenshot (or a PDF link)
// via a freshly-signed URL.
export function ReceiptViewerSheet({ open, onClose, receipt }: Props) {
  const [mounted, setMounted] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !receipt) {
      setUrl(null);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    void supabase.storage
      .from("receipts")
      .createSignedUrl(receipt.storage_path, 600)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [open, receipt]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mounted || !receipt) return null;

  const isPdf = receipt.storage_path.toLowerCase().endsWith(".pdf");

  return createPortal(
    <>
      <div className="oz-sheet-scrim" onClick={onClose} aria-hidden />
      <div
        className="oz-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oz-receipt-view-title"
      >
        <div className="oz-sheet__handle" />
        <h2 id="oz-receipt-view-title" className="oz-sheet__title">
          Чек
        </h2>

        {!url ? (
          <div
            className="oz-skeleton"
            style={{ height: 320, borderRadius: "var(--r-md)" }}
          />
        ) : isPdf ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="oz-btn oz-btn--ghost"
            style={{ alignSelf: "flex-start" }}
          >
            Открыть PDF
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Чек"
            style={{
              width: "100%",
              height: "auto",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border)",
              display: "block",
            }}
          />
        )}
      </div>
    </>,
    document.body,
  );
}
