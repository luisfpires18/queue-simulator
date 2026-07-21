import { requireFeature } from "@/server/features";

// Gates EVERY route under /recruitment - browse, detail, create - in one
// place. A layout wraps all nested pages, so this cannot be forgotten when a
// new page is added under here, unlike a per-page check.
//
// Does not cover /api/recruitment/*: route handlers are not children of a
// layout, so those assert individually.
export const dynamic = "force-dynamic";

export default async function RecruitmentLayout({ children }: { children: React.ReactNode }) {
  await requireFeature("recruitment");
  return <>{children}</>;
}
