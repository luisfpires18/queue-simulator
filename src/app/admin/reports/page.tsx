import { listReports } from "@/data/moderation";
import { ReportQueue } from "@/components/admin/ReportQueue";

export const dynamic = "force-dynamic";

/** Moderation queue. The admin gate now lives in src/app/admin/layout.tsx,
 * which wraps every /admin route - so this page no longer checks for itself,
 * and no future admin page can forget to. */
export default async function AdminReportsPage() {
  const reports = await listReports({ status: "open" });

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        User-submitted reports. Reviewing one only files it - no action is taken automatically.
      </p>

      {/* listReports already returns the client-ready shape (flat, ISO dates),
          so there is nothing to serialize here - and no second shape to drift. */}
      <ReportQueue initial={reports} />
    </div>
  );
}
