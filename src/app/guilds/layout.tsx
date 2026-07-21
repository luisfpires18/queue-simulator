import { requireFeature } from "@/server/features";

// Gates every route under /guilds - see the note in the recruitment layout.
export const dynamic = "force-dynamic";

export default async function GuildsLayout({ children }: { children: React.ReactNode }) {
  await requireFeature("guilds");
  return <>{children}</>;
}
