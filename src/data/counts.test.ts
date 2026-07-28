import { describe, it, expect } from "vitest";
import { mergeCounts } from "./counts";

// This backs the server-seeded pending badge and the team decline cap. The
// zero-vs-undefined distinction is the whole point: undefined leaves a badge
// waiting on a client fetch, which is the latency this was written to remove.
describe("mergeCounts", () => {
  it("reports 0 for an id with no rows, not undefined", () => {
    const out = mergeCounts(["a", "b"], [{ id: "a", count: 3 }]);
    expect(out).toEqual({ a: 3, b: 0 });
    expect(out.b).toBe(0);
  });

  it("maps every counted id", () => {
    expect(mergeCounts(["a", "b"], [{ id: "a", count: 1 }, { id: "b", count: 2 }])).toEqual({ a: 1, b: 2 });
  });

  it("is empty for no ids", () => {
    expect(mergeCounts([], [])).toEqual({});
  });

  it("ignores counts for ids that weren't asked about", () => {
    // Guards the owner-only contract: a stray row can't smuggle in a count
    // for a listing the caller doesn't own.
    expect(mergeCounts(["a"], [{ id: "a", count: 1 }, { id: "z", count: 9 }])).toEqual({ a: 1 });
  });
});
