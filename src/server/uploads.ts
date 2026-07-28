// Filesystem side of profile banner uploads. Files live OUTSIDE public/ so
// that serving them goes through a route handler we control (cache headers,
// no directory listing, no chance of a stray file becoming a static asset).
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/** Absolute path of the banner directory. Overridable so deploys can point at a volume. */
export function bannerDir(): string {
  return path.resolve(process.env.UPLOAD_DIR ?? "./data/uploads", "banners");
}

export const MAX_BANNER_BYTES = 2 * 1024 * 1024;

/** Every name we generate; anything else is rejected before touching the disk. */
const SAFE_NAME = /^[A-Za-z0-9_-]+\.webp$/;

/**
 * True only for a plain filename we could have written ourselves. Rejects
 * traversal (`..`), separators, absolute paths and any other extension —
 * `path.join` on an unchecked segment is the whole vulnerability here.
 */
export function isSafeBannerName(name: string): boolean {
  return SAFE_NAME.test(name);
}

/** Resolved path for a stored banner, or null when the name is not ours. */
export function bannerPath(name: string): string | null {
  if (!isSafeBannerName(name)) return null;
  return path.join(bannerDir(), name);
}

type Sniffed = "webp" | "jpeg" | "png";

/**
 * Identifies the image by its header bytes. The multipart part's own
 * Content-Type is attacker-supplied and never consulted.
 */
export function sniffImageType(bytes: Uint8Array): Sniffed | null {
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
      bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return "webp"; // "RIFF"…"WEBP"
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) {
    return "png";
  }
  return null;
}

/** Writes the bytes under a fresh name and returns it. Creates the dir on first use. */
export async function writeBanner(userId: string, bytes: Uint8Array): Promise<string> {
  const dir = bannerDir();
  await mkdir(dir, { recursive: true });
  // Content-unique name: lets the served response be cached immutably, and
  // means a re-upload never collides with the file the old page is still
  // requesting.
  const name = `${userId}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}.webp`;
  await writeFile(path.join(dir, name), bytes);
  return name;
}

/** Best-effort delete of a superseded banner - a missing file is not an error. */
export async function deleteBanner(name: string | null | undefined): Promise<void> {
  if (!name) return;
  const target = bannerPath(name);
  if (!target) return;
  await unlink(target).catch(() => {});
}
