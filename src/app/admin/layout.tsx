import { notFound } from "next/navigation";
import { getAdminUser } from "@/server/admin";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin | M+ Queue Simulator" };

/** Gates every /admin route in one place - a layout wraps all nested pages, so
 * a new admin page cannot be added without the check.
 *
 * 404 rather than 403: a 403 would confirm the dashboard exists. To anyone
 * outside ADMIN_BNET_IDS this whole tree simply is not there. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getAdminUser();
  if (!admin) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5">
        <h1 className="text-xl font-black uppercase tracking-tight text-white">Admin</h1>
        <p className="mt-1 text-sm text-gray-500">
          Signed in as {admin.session.battletag ?? admin.session.bnetId}. Admins come from
          ADMIN_BNET_IDS and cannot be changed from here.
        </p>
      </header>

      <AdminNav />
      <div className="mt-5">{children}</div>
    </div>
  );
}
