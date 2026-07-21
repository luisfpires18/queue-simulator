import { NextResponse } from "next/server";
import { listAdminUsers } from "@/data/admin";
import { getAdminUser, notFoundForNonAdmin } from "@/server/admin";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return notFoundForNonAdmin();

  const search = new URL(req.url).searchParams.get("q") ?? undefined;
  return NextResponse.json({ users: await listAdminUsers({ search }) });
}
