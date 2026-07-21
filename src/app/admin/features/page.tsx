import { listFeatureStates, listGrants } from "@/data/features";
import { FeatureControls } from "@/components/admin/FeatureControls";

export const dynamic = "force-dynamic";

export default async function AdminFeaturesPage() {
  const features = await listFeatureStates();
  const grants = Object.fromEntries(
    await Promise.all(features.map(async (f) => [f.feature.key, await listGrants(f.feature.key)] as const))
  );

  return (
    <div>
      <p className="mb-4 text-sm text-gray-500">
        Control who can reach each area. Admins always have access regardless of the setting - this only
        ever widens it.
      </p>
      <FeatureControls initialFeatures={features} initialGrants={grants} />
    </div>
  );
}
