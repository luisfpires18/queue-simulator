import { OPS_ACTIONS } from "@/server/adminOps";
import { OpsPanel } from "@/components/admin/OpsPanel";

export const dynamic = "force-dynamic";

export default function AdminOpsPage() {
  // Descriptions come from the server module so the warning travels with the
  // action rather than being duplicated in the UI copy.
  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Maintenance actions. Each says what it did afterwards. Nothing here deletes user content.
      </p>
      <OpsPanel actions={OPS_ACTIONS} />
      <p className="mt-5 text-xs text-gray-600">
        The run collector stays a CLI (<code className="text-gray-500">npm run collect:runs</code>): it can
        run for minutes against Blizzard&apos;s API, which a single request would time out on with no
        progress to show.
      </p>
    </div>
  );
}
