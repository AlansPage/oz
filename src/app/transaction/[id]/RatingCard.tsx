"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { RATING_TAGS, type Rating } from "@/lib/types";

const COMMENT_MAX = 240;

type RateProps = {
  transactionId: string;
  raterId: string;
  rateeId: string;
  onSubmitted: () => void;
};

export function RateForm({
  transactionId,
  raterId,
  rateeId,
  onSubmitted,
}: RateProps) {
  const supabase = createClient();
  const [stars, setStars] = useState<number>(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTag = (t: string) => {
    setTags((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  };

  const submit = async () => {
    if (stars < 1) return;
    setSubmitting(true);
    setError(null);
    const { error: insertErr } = await supabase.from("ratings").insert({
      transaction_id: transactionId,
      rater_id: raterId,
      ratee_id: rateeId,
      stars,
      tags,
      comment: comment.trim() ? comment.trim() : null,
    });
    if (insertErr) {
      setSubmitting(false);
      setError(insertErr.message);
      return;
    }
    onSubmitted();
  };

  return (
    <div className="oz-listing-about" style={{ gap: "var(--s-3)" }}>
      <div className="oz-listing-about__title">Оцените контрагента</div>

      <div
        role="radiogroup"
        aria-label="Оценка"
        style={{ display: "flex", gap: 6 }}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= stars;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              onClick={() => setStars(n)}
              disabled={submitting}
              style={{
                background: "transparent",
                border: 0,
                cursor: submitting ? "default" : "pointer",
                fontSize: 28,
                lineHeight: 1,
                color: filled ? "var(--gold)" : "var(--border-strong)",
                padding: "4px 6px",
              }}
            >
              ★
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {RATING_TAGS.map((t) => {
          const on = tags.includes(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleTag(t)}
              disabled={submitting}
              style={{
                background: on ? "var(--primary-soft)" : "var(--surface-2)",
                color: on ? "var(--primary-ink)" : "var(--text-2)",
                border: `1px solid ${on ? "var(--primary)" : "var(--border-strong)"}`,
                borderRadius: "var(--r-full)",
                padding: "6px 12px",
                fontSize: 13,
                fontWeight: 500,
                cursor: submitting ? "default" : "pointer",
              }}
            >
              {t}
            </button>
          );
        })}
      </div>

      <div>
        <textarea
          className="oz-textarea"
          maxLength={COMMENT_MAX}
          placeholder="Комментарий (необязательно)"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          disabled={submitting}
        />
        <div className="oz-charcount">
          {comment.length}/{COMMENT_MAX}
        </div>
      </div>

      {error && <p className="oz-sheet__error">{error}</p>}

      <button
        className="oz-btn oz-btn--primary oz-btn--full oz-btn--lg"
        onClick={submit}
        disabled={submitting || stars < 1}
      >
        {submitting ? "Отправляем…" : "Оставить отзыв"}
      </button>
    </div>
  );
}

export function RatingReadOnly({
  title,
  rating,
}: {
  title: string;
  rating: Rating;
}) {
  return (
    <div className="oz-listing-about" style={{ gap: "var(--s-2)" }}>
      <div className="oz-listing-about__title">{title}</div>
      <div
        className="oz-listing-about__line"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 18,
          fontWeight: 600,
        }}
      >
        <span style={{ color: "var(--gold)" }}>
          {"★".repeat(rating.stars)}
          <span style={{ color: "var(--border-strong)" }}>
            {"★".repeat(5 - rating.stars)}
          </span>
        </span>
      </div>
      {rating.tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {rating.tags.map((t) => (
            <span
              key={t}
              style={{
                background: "var(--primary-soft)",
                color: "var(--primary-ink)",
                borderRadius: "var(--r-full)",
                padding: "4px 10px",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {t}
            </span>
          ))}
        </div>
      )}
      {rating.comment && (
        <div
          className="oz-listing-about__line"
          style={{ fontStyle: "italic", color: "var(--text-2)" }}
        >
          “{rating.comment}”
        </div>
      )}
    </div>
  );
}
