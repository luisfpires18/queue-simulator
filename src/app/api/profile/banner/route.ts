import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, notAuthenticated } from "@/server/http";
import { deleteBanner, MAX_BANNER_BYTES, sniffImageType, writeBanner } from "@/server/uploads";

export const dynamic = "force-dynamic";

/** Upload a banner image. Body is multipart/form-data with a single `file` part. */
export async function POST(req: Request) {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.size > MAX_BANNER_BYTES) {
    return NextResponse.json({ error: "Image is too large (max 2 MB)." }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffImageType(bytes)) {
    return NextResponse.json({ error: "That file is not a WebP, JPEG or PNG image." }, { status: 400 });
  }

  const name = await writeBanner(ctx.user.id, bytes);
  const previous = ctx.user.bannerImage;

  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { bannerImage: name, bannerType: "upload" },
  });
  // Only after the row points at the new file - a crash between the two
  // leaves an orphan on disk rather than a profile pointing at nothing.
  await deleteBanner(previous);

  return NextResponse.json({ bannerType: "upload", bannerImage: name });
}

/** Drop the uploaded image and fall back to the generated class banner. */
export async function DELETE() {
  const ctx = await getSessionUser();
  if (!ctx) return notAuthenticated();

  await prisma.user.update({
    where: { id: ctx.user.id },
    data: { bannerImage: null, bannerType: "class" },
  });
  await deleteBanner(ctx.user.bannerImage);

  return NextResponse.json({ bannerType: "class", bannerImage: null });
}
