import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { bannerPath } from "@/server/uploads";

// Public by design: a banner is part of a public profile. The only guard
// needed is that `file` names a banner we wrote (see isSafeBannerName).
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const target = bannerPath(file);
  if (!target) return new NextResponse(null, { status: 404 });

  const bytes = await readFile(target).catch(() => null);
  if (!bytes) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "image/webp",
      // Names are content-unique (see writeBanner), so a stored banner never
      // changes under a given URL.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
