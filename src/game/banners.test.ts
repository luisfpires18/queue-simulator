import { describe, it, expect } from "vitest";
import { BANNER_OPTIONS, bannerSpec, isBannerClassId } from "./banners";
import { CLASSES } from "./classes";

describe("bannerSpec", () => {
  it("returns a gradient and a class watermark for every class", () => {
    for (const c of CLASSES) {
      const spec = bannerSpec(c.id);
      expect(spec.background).toContain("gradient");
      expect(spec.color).toBe(c.color);
      expect(spec.watermarkSlug).toBe(`classicon_${c.id}`);
    }
  });

  it("falls back to the neutral banner for null, empty and unknown class ids", () => {
    const neutral = bannerSpec(null);
    expect(neutral.watermarkSlug).toBeNull();
    expect(neutral.background).toContain("gradient");
    expect(bannerSpec(undefined)).toEqual(neutral);
    expect(bannerSpec("")).toEqual(neutral);
    expect(bannerSpec("tinker")).toEqual(neutral);
  });
});

describe("isBannerClassId", () => {
  it("accepts every real class id", () => {
    for (const c of CLASSES) expect(isBannerClassId(c.id)).toBe(true);
  });

  it("rejects anything else", () => {
    expect(isBannerClassId("tinker")).toBe(false);
    expect(isBannerClassId(null)).toBe(false);
    expect(isBannerClassId(7)).toBe(false);
  });
});

describe("BANNER_OPTIONS", () => {
  it("offers the follow-my-main option plus one per class", () => {
    expect(BANNER_OPTIONS).toHaveLength(CLASSES.length + 1);
    expect(BANNER_OPTIONS[0].classId).toBeNull();
  });
});
