"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/feed/Avatar";
import { getWebApp } from "@/lib/telegram/webapp";

type Props = {
  displayName: string | null;
  phone: string | null;
  avatarUrl: string | null;
};

export function HeaderAvatarMenu({ displayName, phone, avatarUrl }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  // Resolved after mount to avoid an SSR/hydration mismatch (window-only check).
  const [miniApp, setMiniApp] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMiniApp(Boolean(getWebApp()?.initData));
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleLogout() {
    setLoggingOut(true);
    // Inside Telegram a user IS their Telegram account — there's no web login to
    // return to, and reopening re-auths via initData. So just close the Mini App
    // instead of routing to the web landing page.
    if (miniApp) {
      getWebApp()?.close();
      return;
    }
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="oz-headeravatar" ref={wrapRef}>
      <button
        type="button"
        className="oz-headeravatar__btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Меню профиля"
      >
        <Avatar
          url={avatarUrl}
          name={displayName}
          phone={phone}
          size="sm"
        />
      </button>
      {open && (
        <div className="oz-headeravatar__menu" role="menu">
          <button
            type="button"
            role="menuitem"
            className="oz-headeravatar__item"
            onClick={() => {
              setOpen(false);
              router.push("/profile");
            }}
          >
            Профиль
          </button>
          <button
            type="button"
            role="menuitem"
            className="oz-headeravatar__item"
            onClick={() => {
              setOpen(false);
              router.push("/alerts");
            }}
          >
            Оповещения
          </button>
          <button
            type="button"
            role="menuitem"
            className="oz-headeravatar__item"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {miniApp ? "Закрыть" : loggingOut ? "Выходим…" : "Выйти"}
          </button>
        </div>
      )}
    </div>
  );
}
