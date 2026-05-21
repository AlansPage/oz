import type { SupabaseClient } from "@supabase/supabase-js";

const SIGN_TTL_SECONDS = 60 * 60;

export async function signAvatar(
  client: SupabaseClient,
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await client.storage
    .from("avatars")
    .createSignedUrl(path, SIGN_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export async function signAvatars(
  client: SupabaseClient,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = Array.from(
    new Set(paths.filter((p): p is string => Boolean(p))),
  );
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const { data, error } = await client.storage
    .from("avatars")
    .createSignedUrls(unique, SIGN_TTL_SECONDS);
  if (error || !data) return out;
  for (const item of data) {
    if (item.path && item.signedUrl) {
      out.set(item.path, item.signedUrl);
    }
  }
  return out;
}
