import { createClient } from "@supabase/supabase-js";

// Service-role client. Bypasses RLS — must never reach the browser.
if (typeof window !== "undefined") {
  throw new Error("supabase/admin.ts must not be imported in browser code");
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);
