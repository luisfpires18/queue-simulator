import { describe, it, expect } from "vitest";
import { isSafeBannerName, bannerPath, sniffImageType } from "./uploads";

describe("isSafeBannerName", () => {
  it("accepts the names writeBanner generates", () => {
    expect(isSafeBannerName("clx1abc-lq9k3f2b7z.webp")).toBe(true);
    expect(isSafeBannerName("A_b-9.webp")).toBe(true);
  });

  it("rejects traversal, separators and absolute paths", () => {
    expect(isSafeBannerName("../../.env")).toBe(false);
    expect(isSafeBannerName("..%2F..%2Fsecret.webp")).toBe(false);
    expect(isSafeBannerName("sub/dir.webp")).toBe(false);
    expect(isSafeBannerName("sub\\dir.webp")).toBe(false);
    expect(isSafeBannerName("/etc/passwd")).toBe(false);
    expect(isSafeBannerName("C:\\Windows\\win.ini")).toBe(false);
  });

  it("rejects any extension other than .webp", () => {
    expect(isSafeBannerName("banner.png")).toBe(false);
    expect(isSafeBannerName("banner.webp.js")).toBe(false);
    expect(isSafeBannerName("banner")).toBe(false);
    expect(isSafeBannerName("")).toBe(false);
  });
});

describe("bannerPath", () => {
  it("is null for a name we would never have written", () => {
    expect(bannerPath("../../.env")).toBeNull();
  });

  it("resolves inside the banner directory for a safe name", () => {
    const p = bannerPath("abc.webp");
    expect(p).not.toBeNull();
    expect(p!.replace(/\\/g, "/")).toMatch(/\/banners\/abc\.webp$/);
  });
});

describe("sniffImageType", () => {
  const webp = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50]);
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

  it("identifies the three accepted formats by their header bytes", () => {
    expect(sniffImageType(webp)).toBe("webp");
    expect(sniffImageType(jpeg)).toBe("jpeg");
    expect(sniffImageType(png)).toBe("png");
  });

  it("rejects a text file no matter what it claims to be", () => {
    expect(sniffImageType(new TextEncoder().encode("<?php system($_GET['c']); ?>"))).toBeNull();
  });

  it("rejects a RIFF container that isn't WEBP (e.g. a wav)", () => {
    const wav = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]);
    expect(sniffImageType(wav)).toBeNull();
  });

  it("rejects a truncated header rather than reading past the end", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
    expect(sniffImageType(new Uint8Array([]))).toBeNull();
  });
});
