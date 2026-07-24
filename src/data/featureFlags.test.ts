import { describe, it, expect } from "vitest";
import { mergeFlagState } from "./featureFlags";

describe("mergeFlagState", () => {
  it("defaults to enabled when a registered flag has no DB row", () => {
    const state = mergeFlagState([]);
    const soloQueue = state.find((f) => f.key === "soloQueue");
    expect(soloQueue?.enabled).toBe(true);
  });

  it("uses the DB row's value when one exists", () => {
    const state = mergeFlagState([{ id: "soloQueue", enabled: false }]);
    expect(state.find((f) => f.key === "soloQueue")?.enabled).toBe(false);
  });

  it("ignores DB rows for keys not in the registry", () => {
    const state = mergeFlagState([{ id: "notARealFlag", enabled: false }]);
    expect(state.some((f) => f.key === "notARealFlag")).toBe(false);
  });

  it("carries the registry's label/description through unchanged", () => {
    const state = mergeFlagState([]);
    const soloQueue = state.find((f) => f.key === "soloQueue");
    expect(soloQueue?.label).toBe("Solo Queue");
    expect(soloQueue?.description.length).toBeGreaterThan(0);
  });
});
