import { NextResponse } from "next/server";
import { z } from "zod";
import { runOpsAction } from "@/server/adminOps";
import { getAdminUser, notFoundForNonAdmin } from "@/server/admin";
import { parseBody } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  action: z.enum(["sweep", "clear_wcl_cache"]),
});

/** Each action reports what it actually did, so the dashboard can show a
 * result rather than a hopeful "done". */
export async function POST(req: Request) {
  const admin = await getAdminUser();
  if (!admin) return notFoundForNonAdmin();

  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;

  try {
    return NextResponse.json({ result: await runOpsAction(body.data.action) });
  } catch (err) {
    console.error("admin ops failed", body.data.action, err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "That action failed." },
      { status: 500 }
    );
  }
}
