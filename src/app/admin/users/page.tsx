import { listAdminUsers } from "@/data/admin";
import { UserList } from "@/components/admin/UserList";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Every account, newest first. Search by battletag or Battle.net id.
      </p>
      <UserList initial={await listAdminUsers()} />
    </div>
  );
}
