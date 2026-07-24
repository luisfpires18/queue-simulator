import { notFound } from "next/navigation";
import { getBnetSession } from "@/server/http";
import { isAdminBattletag } from "@/lib/admin";
import { listUsers } from "@/data/admin";
import { listFeatureFlags } from "@/data/featureFlags";
import { getCurrentSeasonId } from "@/data/appSettings";
import { SEASONS } from "@/game/season";
import { AdminClient } from "@/components/admin/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getBnetSession();
  // 404 rather than a login prompt - no page for anyone else to even notice.
  if (!isAdminBattletag(session?.battletag)) notFound();

  const [initial, flags, currentSeasonId] = await Promise.all([
    listUsers({ page: 1, pageSize: 20, filter: "all" }),
    listFeatureFlags(),
    getCurrentSeasonId(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Admin</h1>
        <p className="text-gray-400 text-sm">Internal tools.</p>
      </div>
      <AdminClient
        initialUsers={initial.rows}
        initialTotal={initial.total}
        initialFlags={flags}
        seasons={SEASONS}
        initialCurrentSeasonId={currentSeasonId}
      />
    </div>
  );
}
