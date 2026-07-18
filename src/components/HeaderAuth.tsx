import { auth, signIn, signOut, bnetEnabled } from "@/auth";
import Link from "next/link";

// Server component: shows BattleTag + logout when signed in, else a Battle.net login button.
export async function HeaderAuth() {
  const session = await auth();
  const battletag = (session as { battletag?: string } | null)?.battletag ?? session?.user?.name;
  const name = battletag?.split("#")[0]; // drop the "#1234" discriminator for display

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/profile" className="chip bg-panel2 border border-panelborder text-gray-200 hover:border-accent/50">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00aeff]" />
          {name ?? "Account"}
        </Link>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button className="text-[11px] uppercase tracking-wide text-gray-500 hover:text-white">Logout</button>
        </form>
      </div>
    );
  }

  if (!bnetEnabled) {
    return (
      <Link
        href="/profile"
        title="Battle.net login needs credentials - see /profile"
        className="chip border border-panelborder text-gray-500 hover:text-gray-300"
      >
        Login (setup)
      </Link>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("battlenet", { redirectTo: "/profile" });
      }}
    >
      <button className="btn bg-[#00aeff] text-black hover:brightness-110 px-3 py-1.5 text-xs">
        Login with Battle.net
      </button>
    </form>
  );
}
