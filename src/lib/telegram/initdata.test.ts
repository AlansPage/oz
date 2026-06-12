import { describe, it, expect } from "vitest";
import { createHmac } from "crypto";
import { validateInitData } from "./initdata";

const TOKEN = "123456:TEST_app_bot_token";

// Independent reference signer (encodes Telegram's documented algorithm in the
// test, NOT imported from the implementation) so the "valid" case proves the
// validator, not itself. Builds the data_check_string from DECODED values, then
// URL-encodes into the query string exactly as Telegram's client does.
function signInitData(
  fields: Record<string, string>,
  token = TOKEN,
): string {
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(token).digest();
  const hash = createHmac("sha256", secret).update(dcs).digest("hex");
  const params = new URLSearchParams({ ...fields, hash });
  return params.toString();
}

const NOW = 1_750_000_000; // fixed reference "now" in seconds
const freshFields = () => ({
  auth_date: String(NOW - 60),
  query_id: "AAH_test",
  user: JSON.stringify({ id: 777000, username: "alan", first_name: "Alan" }),
});

describe("validateInitData", () => {
  it("accepts a correctly signed, fresh payload and parses the user", () => {
    const raw = signInitData(freshFields());
    const result = validateInitData(raw, TOKEN, { nowSeconds: NOW });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.id).toBe(777000);
    expect(result.user.username).toBe("alan");
    expect(result.authDate).toBe(NOW - 60);
  });

  it("rejects a payload whose hash was tampered with", () => {
    const raw = signInitData(freshFields());
    const tampered = raw.replace(/hash=[0-9a-f]+/, "hash=deadbeef");
    const result = validateInitData(tampered, TOKEN, { nowSeconds: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("bad_hash");
  });

  it("rejects a payload signed with a different bot token", () => {
    const raw = signInitData(freshFields(), "999999:OTHER_bot_token");
    const result = validateInitData(raw, TOKEN, { nowSeconds: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("bad_hash");
  });

  it("rejects a stale payload (auth_date older than maxAge)", () => {
    const stale = { ...freshFields(), auth_date: String(NOW - 3600) };
    const raw = signInitData(stale);
    const result = validateInitData(raw, TOKEN, {
      nowSeconds: NOW,
      maxAgeSeconds: 900,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("stale");
  });

  it("rejects a correctly signed payload that carries no user", () => {
    const noUser = { auth_date: String(NOW - 60), query_id: "AAH_test" };
    const raw = signInitData(noUser);
    const result = validateInitData(raw, TOKEN, { nowSeconds: NOW });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_user");
  });

  it("rejects a payload with no hash field at all", () => {
    const params = new URLSearchParams(freshFields());
    const result = validateInitData(params.toString(), TOKEN, {
      nowSeconds: NOW,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("no_hash");
  });
});
