import { NextResponse } from "next/server";
import { z } from "zod";
import { listReports, setReportStatus } from "@/data/moderation";
import { getAdminUser, notFoundForNonAdmin } from "@/server/admin";
import { parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
  reportId: z.string().min(1),
  status: z.enum(["open", "reviewed", "actioned", "dismissed"]),
});

export async function GET(req: Request) {
  // 404 rather than 401/403 for non-admins - see notFoundForNonAdmin. This
  // also covers the signed-out case, so an anonymous probe learns nothing.
  const admin = await getAdminUser();
  if (!admin) return notFoundForNonAdmin();

  const status = new URL(req.url).searchParams.get("status");
  return NextResponse.json({
    reports: await listReports({ status: status === "all" ? null : status ?? "open" }),
  });
}

export async function PATCH(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return notFoundForNonAdmin();

  const body = await parseBody(req, statusSchema);
  if (!body.ok) return body.response;

  await setReportStatus(body.data.reportId, body.data.status);
  return NextResponse.json({ ok: true });
}
