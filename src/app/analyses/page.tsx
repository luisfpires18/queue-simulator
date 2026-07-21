import { auth, signIn, bnetEnabled, devLoginEnabled } from "@/auth";
import { AnalysesClient } from "@/components/analyses/AnalysesClient";

export const dynamic = "force-dynamic";

// BETA — applicant scan. Requires a signed-in user (light gate on the shared WCL
// token budget) but scans ANY character, not just owned ones.
export default async function AnalysesPage() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string }) | null;

  if (!s?.bnetId) {
    return (
      <div className="max-w-xl mx-auto panel p-8 text-center space-y-4">
        <h1 className="text-2xl font-black">Applicant Analyses <span className="text-accent text-sm align-top">BETA</span></h1>
        <p className="text-gray-400">Log in to scan a Mythic+ applicant against the field.</p>
        {bnetEnabled ? (
          <form action={async () => { "use server"; await signIn("battlenet", { redirectTo: "/analyses" }); }}>
            <button className="btn bg-[#00aeff] text-black hover:brightness-110">Login with Battle.net</button>
          </form>
        ) : (
          <p className="text-amber-400 text-sm">Battle.net login needs credentials (see .env).</p>
        )}
        {devLoginEnabled && (
          <form
            action={async () => { "use server"; await signIn("dev-login", { bnetId: "dev-fake-1", redirectTo: "/analyses" }); }}
            className="pt-3 border-t border-panelborder/60"
          >
            <button className="btn-ghost text-xs px-3 py-1.5">Dev login (ALLOW_DEV_LOGIN=1)</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black">Applicant Analyses <span className="text-accent text-sm align-top">BETA</span></h1>
        <p className="text-gray-400 text-sm">
          Scan any character&apos;s Mythic+ logs per dungeon and score fit for a key apply. First scan of a
          character is slow (pulls every run&apos;s combat detail from Warcraft Logs); repeats are cached.
        </p>
      </div>
      <AnalysesClient />
    </div>
  );
}
