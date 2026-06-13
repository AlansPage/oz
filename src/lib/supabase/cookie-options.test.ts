import { describe, it, expect } from "vitest";
import { embeddableCookieOptions } from "./cookie-options";

// Telegram Web loads the Mini App in a cross-site iframe, where browsers drop
// SameSite=Lax cookies. The session persists with SameSite=None; Secure (which
// cleanly overwrites the old Lax cookie). Secure is rejected over
// http://localhost, so this must apply in production only.
describe("embeddableCookieOptions", () => {
  it("forces None/Secure in production, preserving other options", () => {
    const out = embeddableCookieOptions(
      { path: "/", sameSite: "lax", maxAge: 100 },
      true,
    );
    expect(out.sameSite).toBe("none");
    expect(out.secure).toBe(true);
    expect(out.path).toBe("/");
    expect(out.maxAge).toBe(100);
  });

  it("leaves cookies untouched outside production (Secure breaks localhost http)", () => {
    const input = { path: "/", sameSite: "lax" as const };
    expect(embeddableCookieOptions(input, false)).toEqual(input);
  });
});
