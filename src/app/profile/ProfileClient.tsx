"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { signAvatar } from "@/lib/avatar-url";
import { AvatarPicker } from "@/components/AvatarPicker";
import { VerificationBadge } from "@/components/feed/VerificationBadge";
import { PaymentMethodsSection } from "@/components/profile/PaymentMethodsSection";
import { formatPhoneFull } from "@/lib/format";
import type { Profile, VerificationTier } from "@/lib/types";

type Props = {
  userId: string;
  profile: Profile;
  initialAvatarUrl: string | null;
};

const fullDate = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const NAME_SAVE_FAILED = "Не удалось сохранить имя. Попробуйте ещё раз.";

export function ProfileClient({ userId, profile, initialAvatarUrl }: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [displayName, setDisplayName] = useState<string | null>(
    profile.display_name,
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [editingName, setEditingName] = useState<boolean>(
    !profile.display_name,
  );
  const [nameDraft, setNameDraft] = useState<string>(profile.display_name ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [savingName, setSavingName] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const tier = profile.verification_tier as VerificationTier;
  const ratingLine =
    profile.rating_count > 0 && profile.rating_avg !== null
      ? `★ ${Number(profile.rating_avg).toFixed(1)} · ${profile.rating_count} оценок`
      : "Новый пользователь";
  const memberSince = `Дата регистрации: ${fullDate.format(new Date(profile.created_at))}`;

  async function handleAvatarUploaded(path: string) {
    setAvatarError(null);
    const { error } = await supabase.rpc("update_profile_identity", {
      p_display_name: null,
      p_avatar_path: path,
    });
    if (error) {
      setAvatarError("Не удалось сохранить фото. Попробуйте ещё раз.");
      return;
    }
    const signed = await signAvatar(supabase, path);
    setAvatarUrl(signed);
  }

  async function saveName() {
    const trimmed = nameDraft.trim();
    if (trimmed.length < 2 || trimmed.length > 30) {
      setNameError("Имя должно быть от 2 до 30 символов.");
      return;
    }
    setSavingName(true);
    setNameError(null);
    const { error } = await supabase.rpc("update_profile_identity", {
      p_display_name: trimmed,
      p_avatar_path: null,
    });
    setSavingName(false);
    if (error) {
      setNameError(NAME_SAVE_FAILED);
      return;
    }
    setDisplayName(trimmed);
    setEditingName(false);
  }

  async function handleLogout() {
    setLoggingOut(true);
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <section className="oz-profile">
      <div className="oz-profile__heading">Профиль</div>

      <div className="oz-profile__avatar-block">
        <AvatarPicker
          userId={userId}
          currentUrl={avatarUrl}
          displayName={displayName}
          phone={profile.phone}
          onUploaded={handleAvatarUploaded}
          onError={setAvatarError}
          size="xl"
          ctaLabel="Изменить фото"
        />
        {avatarError && <p className="oz-profile__error">{avatarError}</p>}
      </div>

      <div className="oz-profile__field">
        <div className="oz-profile__field-label">Имя</div>
        {editingName ? (
          <>
            <input
              type="text"
              className="oz-input"
              placeholder="Ваше имя"
              value={nameDraft}
              maxLength={30}
              autoFocus
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void saveName();
                }
              }}
              disabled={savingName}
            />
            {nameError && <p className="oz-profile__error">{nameError}</p>}
          </>
        ) : (
          <div className="oz-profile__field-row">
            <span className="oz-profile__name">{displayName}</span>
            <button
              type="button"
              className="oz-profile__link"
              onClick={() => {
                setNameDraft(displayName ?? "");
                setEditingName(true);
              }}
            >
              Изменить
            </button>
          </div>
        )}
      </div>

      <div className="oz-profile__field">
        <div className="oz-profile__field-label">Номер телефона</div>
        <div className="oz-profile__phone">{formatPhoneFull(profile.phone)}</div>
      </div>

      <div className="oz-profile__field">
        <VerificationBadge tier={tier} full />
      </div>

      <div className="oz-profile__rating">{ratingLine}</div>
      <div className="oz-profile__meta">{memberSince}</div>

      <div className="oz-profile__divider" />

      <PaymentMethodsSection userId={userId} />

      <div className="oz-profile__divider" />

      <a href="/feed" className="oz-profile__row-link">
        Мои объявления
      </a>

      <button
        type="button"
        className="oz-btn oz-btn--secondary oz-btn--full oz-profile__logout"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? "Выходим…" : "Выйти"}
      </button>
    </section>
  );
}
