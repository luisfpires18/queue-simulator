import Link from "next/link";
import { auth, signIn, bnetEnabled, devLoginEnabled } from "@/auth";
import { redirect } from "next/navigation";
import { WowIcon } from "@/components/WowIcon";
import { MISC_ICON } from "@/game/icons";
import { SEASON } from "@/game/season";

export const dynamic = "force-dynamic";

const PITCH = [
  { icon: MISC_ICON.roster, text: "Sync your characters and share one roster link" },
  { icon: MISC_ICON.keystone, text: "List or apply to keys and raids" },
  { icon: MISC_ICON.bell, text: "Get pushed the moment a matching group opens" },
];

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/profile");

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8">
      <div className="panel w-full max-w-md p-8 text-center space-y-6 relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 50% 0%, #5fd0c5, transparent 70%)" }}
        />

        <div className="relative space-y-3">
          <div className="inline-flex items-center justify-center rounded-2xl bg-panel2 p-3 ring-1 ring-panelborder">
            <WowIcon slug={MISC_ICON.keystone} size={40} cdnSize="medium" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">
              <span className="text-accent">Queue</span> Simulator
            </h1>
            <p className="text-[11px] uppercase tracking-widest text-gray-500 mt-1">
              {SEASON.expansion} · Season {SEASON.season}
            </p>
          </div>
        </div>

        <ul className="relative space-y-2.5 text-left max-w-xs mx-auto">
          {PITCH.map((p) => (
            <li key={p.text} className="flex items-center gap-3 text-sm text-gray-300">
              <WowIcon slug={p.icon} size={22} cdnSize="small" rounded="sm" className="opacity-80 shrink-0" />
              {p.text}
            </li>
          ))}
        </ul>

        <div className="relative space-y-3 pt-1">
          {bnetEnabled ? (
            <form
              action={async () => {
                "use server";
                await signIn("battlenet", { redirectTo: "/profile" });
              }}
            >
              <button className="btn bg-[#00aeff] text-black hover:brightness-110 w-full py-2.5 text-sm">
                Continue with Battle.net
              </button>
            </form>
          ) : (
            <p className="text-amber-400 text-xs">
              Battle.net login needs credentials to be configured (see .env) before this works.
            </p>
          )}

          {devLoginEnabled && (
            <form
              action={async () => {
                "use server";
                await signIn("dev-login", { bnetId: "dev-fake-1", redirectTo: "/profile" });
              }}
              className="pt-2 border-t border-panelborder/60"
            >
              <button className="btn-ghost text-xs px-3 py-1.5 w-full">
                Dev login as TestHero#1111 (fake, seeded, ALLOW_DEV_LOGIN=1)
              </button>
            </form>
          )}

          <Link href="/" className="block text-xs text-gray-500 hover:text-gray-300 pt-1">
            ← Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
