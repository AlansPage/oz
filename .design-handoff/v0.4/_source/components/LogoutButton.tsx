"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useSupabase } from "@/components/SupabaseProvider";

export function LogoutButton() {
  const { supabase } = useSupabase();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="oz-btn oz-btn--secondary"
    >
      {loading ? "Выходим…" : "Выйти"}
    </button>
  );
}
