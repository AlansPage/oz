/**
 * Resolve a Telegram Mini App `start_param` (from a `?startapp=<param>` deep
 * link, read via WebApp.initDataUnsafe.start_param) into an in-app path.
 *
 * start_param is UNSIGNED (it rides on initDataUnsafe), so it is treated as
 * untrusted navigation input only — never for authorization. We whitelist a
 * small set of shapes and validate the id, so a crafted param can't open-
 * redirect or route anywhere arbitrary. Telegram also restricts start_param to
 * [A-Za-z0-9_-], but we validate regardless.
 */

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Returns a safe in-app path, or null if the param is absent/unrecognized
 * (caller should fall back to the default landing route).
 *
 * Supported: `tx_<uuid>` → `/transaction/<uuid>`.
 */
export function resolveStartParam(
  param: string | null | undefined,
): string | null {
  if (!param) return null;

  if (param.startsWith("tx_")) {
    const id = param.slice(3);
    if (UUID_RE.test(id)) return `/transaction/${id}`;
  }

  return null;
}
