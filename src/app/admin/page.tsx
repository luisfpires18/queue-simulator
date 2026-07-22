import { notFound } from "next/navigation";
import { getBnetSession } from "@/server/http";
import { isAdminBattletag } from "@/lib/admin";
import { listUsers } from "@/data/admin";
import { AdminClient } from "@/components/admin/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getBnetSession();
  // 404 rather than a login prompt - no page for anyone else to even notice.
  if (!isAdminBattletag(session?.battletag)) notFound();

  const initial = await listUsers({ page: 1, pageSize: 20, filter: "all" });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Admin</h1>
        <p className="text-gray-400 text-sm">Internal tools.</p>
      </div>
      <AdminClient initialUsers={initial.rows} initialTotal={initial.total} />
    </div>
  );
}
