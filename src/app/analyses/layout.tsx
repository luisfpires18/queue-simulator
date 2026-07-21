import { requireFeature } from "@/server/features";

// Gates /analyses. This one also protects a shared resource rather than just
// an unfinished surface: the applicant scan spends the app's single Warcraft
// Logs token budget, and it scans ANY character, not only owned ones.
export const dynamic = "force-dynamic";

export default async function AnalysesLayout({ children }: { children: React.ReactNode }) {
  await requireFeature("analyses");
  return <>{children}</>;
}
