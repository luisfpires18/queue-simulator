import { describe, it, expect } from "vitest";
import { normalizeTwitchHandle, normalizeDiscordHandle } from "./social";

describe("normalizeTwitchHandle", () => {
  it("returns null for empty/whitespace input", () => {
    expect(normalizeTwitchHandle("")).toBeNull();
    expect(normalizeTwitchHandle("   ")).toBeNull();
  });

  it("passes a plain handle through, lowercased", () => {
    expect(normalizeTwitchHandle("SomeStreamer")).toBe("somestreamer");
  });

  it("strips a full profile URL", () => {
    expect(normalizeTwitchHandle("https://www.twitch.tv/some_streamer")).toBe("some_streamer");
    expect(normalizeTwitchHandle("twitch.tv/some_streamer")).toBe("some_streamer");
  });

  it("strips a leading @ and trailing path/query", () => {
    expect(normalizeTwitchHandle("@some_streamer")).toBe("some_streamer");
    expect(normalizeTwitchHandle("twitch.tv/some_streamer?foo=bar")).toBe("some_streamer");
  });
});

describe("normalizeDiscordHandle", () => {
  it("returns null for empty/whitespace input", () => {
    expect(normalizeDiscordHandle("")).toBeNull();
    expect(normalizeDiscordHandle("  ")).toBeNull();
  });

  it("strips a leading @ for the new username format", () => {
    expect(normalizeDiscordHandle("@someuser")).toBe("someuser");
  });

  it("leaves the legacy name#discriminator format untouched", () => {
    expect(normalizeDiscordHandle("SomeUser#1234")).toBe("SomeUser#1234");
  });
});
