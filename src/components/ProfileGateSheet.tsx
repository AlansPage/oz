"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { signAvatar } from "@/lib/avatar-url";
import { AvatarPicker } from "@/components/AvatarPicker";

export const PROFILE_GATE_DISMISS_KEY = "oz:profile-gate:dismissed";

type Props = {
  open: boolean;
  userId: string;
  phone: string | null;
  currentDisplayName: string | null;
  currentAvatarPath: string | null;
  onComplete: () => void;
  onDefer: () => void;
};

const SAVE_FAILED = "Не удалось сохранить. Попробуйте ещё раз.";

export function ProfileGateSheet({
  open,
  userId,
  phone,
  currentDisplayName,
  currentAvatarPath,
  onComplete,
  onDefer,
}: Props) {
  const supabase = createClient();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState<string>(currentDisplayName ?? "");
  const [avatarPath, setAvatarPath] = useState<string | null>(
    currentAvatarPath,
  );
  const [avatarPreviewUrl, setAvatarPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeferOpen, setConfirmDeferOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setError(null);
      setConfirmDeferOpen(false);
    }
  }, [open]);

  useEffect(() => {
    let cancelled = false;
    if (!avatarPath) {
      setAvatarPreviewUrl(null);
      return;
    }
    void signAvatar(supabase, avatarPath).then((url) => {
      if (!cancelled) setAvatarPreviewUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarPath, supabase]);

  if (!open || !mounted) return null;

  const trimmed = name.trim();
  const canSubmit = Boolean(avatarPath) && trimmed.length >= 2 && trimmed.length <= 30;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("update_profile_identity", {
      p_display_name: trimmed,
      p_avatar_path: avatarPath,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(SAVE_FAILED);
      return;
    }
    onComplete();
  }

  function defer() {
    try {
      sessionStorage.setItem(PROFILE_GATE_DISMISS_KEY, "1");
    } catch {
      // sessionStorage unavailable — proceed anyway
    }
    onDefer();
  }

  return createPortal(
    <>
      <div className="oz-sheet-scrim" aria-hidden />
      <div
        className="oz-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="oz-gate-title"
      >
        <div className="oz-sheet__handle" />
        <h2 id="oz-gate-title" className="oz-sheet__title">
          Сначала покажите контрагенту, кто вы
        </h2>
        <p className="oz-sheet__subtitle">
          Имя и аватар помогают строить доверие. Это видят только пользователи öz.
        </p>

        <div className="oz-gate__block">
          <AvatarPicker
            userId={userId}
            currentUrl={avatarPreviewUrl}
            displayName={trimmed || null}
            phone={phone}
            onUploaded={(path) => {
              setError(null);
              setAvatarPath(path);
            }}
            onError={setError}
            size="xl"
            ctaLabel="Загрузить фото"
          />
        </div>

        <div className="oz-gate__block">
          <label className="oz-profile__field-label" htmlFor="oz-gate-name">
            Имя
          </label>
          <input
            id="oz-gate-name"
            type="text"
            className="oz-input"
            placeholder="Ваше имя"
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
          />
        </div>

        {error && <p className="oz-sheet__error">{error}</p>}

        <div className="oz-confirm__actions">
          <button
            type="button"
            className="oz-btn oz-btn--ghost"
            onClick={() => setConfirmDeferOpen(true)}
            disabled={submitting}
          >
            Позже
          </button>
          <button
            type="button"
            className="oz-btn oz-btn--primary"
            onClick={submit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? "Сохраняем…" : "Готово"}
          </button>
        </div>
      </div>

      {confirmDeferOpen && (
        <>
          <div
            className="oz-sheet-scrim oz-sheet-scrim--stacked"
            onClick={() => setConfirmDeferOpen(false)}
            aria-hidden
          />
          <div
            className="oz-sheet oz-sheet--stacked"
            role="dialog"
            aria-modal="true"
            aria-labelledby="oz-gate-confirm-title"
          >
            <div className="oz-sheet__handle" />
            <h2 id="oz-gate-confirm-title" className="oz-sheet__title">
              Точно отложить?
            </h2>
            <p className="oz-sheet__subtitle">
              Без имени и аватара ваши объявления реже выбирают.
            </p>
            <div className="oz-confirm__actions">
              <button
                type="button"
                className="oz-btn oz-btn--ghost"
                onClick={() => setConfirmDeferOpen(false)}
              >
                Назад
              </button>
              <button
                type="button"
                className="oz-btn oz-btn--primary"
                onClick={defer}
              >
                Отложить
              </button>
            </div>
          </div>
        </>
      )}
    </>,
    document.body,
  );
}
