import { describe, it, expect } from "vitest";
import { resolveStartParam } from "./start-param";

const UUID = "11111111-2222-3333-4444-555555555555";

describe("resolveStartParam", () => {
  it("maps tx_<uuid> to the transaction route", () => {
    expect(resolveStartParam(`tx_${UUID}`)).toBe(`/transaction/${UUID}`);
  });

  it("returns null for absent params", () => {
    expect(resolveStartParam(null)).toBeNull();
    expect(resolveStartParam(undefined)).toBeNull();
    expect(resolveStartParam("")).toBeNull();
  });

  it("rejects a tx_ prefix with a non-uuid id", () => {
    expect(resolveStartParam("tx_not-a-uuid")).toBeNull();
    expect(resolveStartParam("tx_123")).toBeNull();
    expect(resolveStartParam(`tx_${UUID}extra`)).toBeNull();
  });

  it("rejects unknown prefixes and never open-redirects", () => {
    expect(resolveStartParam(UUID)).toBeNull();
    expect(resolveStartParam("feed")).toBeNull();
    expect(resolveStartParam("https://evil.example.com")).toBeNull();
    expect(resolveStartParam("../../admin")).toBeNull();
    expect(resolveStartParam(`profile_${UUID}`)).toBeNull();
  });
});
