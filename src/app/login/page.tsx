import Link from "next/link";
import { auth, signIn, bnetEnabled, devLoginEnabled } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { WowIcon } from "@/components/WowIcon";
import { MISC_ICON } from "@/game/icons";
import { seasonById } from "@/game/season";
import { getCurrentSeasonId } from "@/data/appSettings";

export const dynamic = "force-dynamic";

const PITCH = [
  { icon: MISC_ICON.roster, text: "Sync your characters and share one roster link" },
  { icon: MISC_ICON.keystone, text: "List or apply to keys and raids" },
  { icon: MISC_ICON.bell, text: "Get pushed the moment a matching group opens" },
];

// The actual Battle.net swirl mark (Simple Icons project, MIT-licensed SVG
// path data for the brand's official logo - https://simpleicons.org).
const BattleNetIcon = () => (
  <svg viewBox="0 0 24 24" className="w-8 h-8">
    <path
      fill="white"
      d="M18.94 8.296C15.9 6.892 11.534 6 7.426 6.332c.206-1.36.714-2.308 1.548-2.508 1.148-.275 2.4.48 3.594 1.854.782.102 1.71.28 2.355.429C12.747 2.013 9.828-.282 7.607.565c-1.688.644-2.553 2.97-2.448 6.094-2.2.468-3.915 1.3-5.013 2.495-.056.065-.181.227-.137.305.034.058.146-.008.194-.04 1.274-.89 2.904-1.373 5.027-1.676.303 3.333 1.713 7.56 4.055 10.952-1.28.502-2.356.536-2.946-.087-.812-.856-.784-2.318-.19-4.04a26.764 26.764 0 0 1-.807-2.254c-2.459 3.934-2.986 7.61-1.143 9.11 1.402 1.14 3.847.725 6.502-.926 1.505 1.672 3.083 2.74 4.667 3.094.084.015.287.043.332-.034.034-.06-.08-.124-.131-.149-1.408-.657-2.64-1.828-3.964-3.515 2.735-1.929 5.691-5.263 7.457-8.988 1.076.86 1.64 1.773 1.398 2.595-.336 1.131-1.615 1.84-3.403 2.185a27.697 27.697 0 0 1-1.548 1.826c4.634.16 8.08-1.22 8.458-3.565.286-1.786-1.295-3.696-4.053-5.17.696-2.139.832-4.04.346-5.588-.029-.08-.106-.27-.196-.27-.068 0-.067.13-.063.187.135 1.547-.263 3.2-1.062 5.19zm-8.533 9.869c-1.96-3.145-3.09-6.849-3.082-10.594 3.702-.124 7.474.748 10.714 2.627-1.743 3.269-4.385 6.1-7.633 7.966h.001z"
    />
  </svg>
);

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/profile");

  const season = seasonById(await getCurrentSeasonId());

  // Queried live (not hardcoded) so this dropdown always matches whatever's
  // actually seeded — see prisma/seed.ts's dev-fake-* users.
  const devUsers = devLoginEnabled
    ? await prisma.user.findMany({
        where: { bnetId: { startsWith: "dev-fake-" } },
        select: { bnetId: true, battletag: true },
        orderBy: { bnetId: "asc" },
      })
    : [];

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
              {season.expansion} · Season {season.season}
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
              <button className="group flex flex-col items-center gap-1.5 mx-auto">
                <span className="w-16 h-16 rounded-full bg-[#148eff] grid place-items-center shadow-lg transition-all group-hover:brightness-110 group-active:scale-95">
                  <BattleNetIcon />
                </span>
                <span className="text-xs font-bold uppercase tracking-widest text-gray-300 group-hover:text-white">
                  Login
                </span>
              </button>
            </form>
          ) : (
            <p className="text-amber-400 text-xs">
              Battle.net login needs credentials to be configured (see .env) before this works.
            </p>
          )}

          {devLoginEnabled && devUsers.length > 0 && (
            <form
              action={async (formData: FormData) => {
                "use server";
                const bnetId = String(formData.get("bnetId") ?? "");
                if (bnetId) await signIn("dev-login", { bnetId, redirectTo: "/profile" });
              }}
              className="pt-2 border-t border-panelborder/60 space-y-1.5"
            >
              <select
                name="bnetId"
                defaultValue={devUsers[0].bnetId}
                className="w-full rounded-md border border-panelborder bg-panel2 px-2.5 py-1.5 text-xs text-gray-200 outline-none focus:border-accent"
              >
                {devUsers.map((u) => (
                  <option key={u.bnetId} value={u.bnetId}>
                    {u.battletag ?? u.bnetId}
                  </option>
                ))}
              </select>
              <button className="btn-ghost text-xs px-3 py-1.5 w-full">
                Dev login (fake, seeded, ALLOW_DEV_LOGIN=1)
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
