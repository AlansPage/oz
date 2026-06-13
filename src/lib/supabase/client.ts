import { createBrowserClient } from "@supabase/ssr";
import { IS_PROD } from "./cookie-options";

export function createClient() {
  // In production, match the server's embedded-iframe cookie attributes (see
  // cookie-options.ts) so the browser client's token-refresh writes don't
  // clobber the session with SameSite=Lax inside Telegram Web's iframe. Dev
  // keeps defaults (Secure is rejected over http://localhost).
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    IS_PROD
      ? {
          cookieOptions: {
            sameSite: "none",
            secure: true,
          },
        }
      : undefined,
  );
}
