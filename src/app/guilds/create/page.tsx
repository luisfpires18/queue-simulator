import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { GuildForm } from "@/components/guilds/GuildForm";

export const dynamic = "force-dynamic";

export default async function CreateGuildPage() {
  const session = await auth();
  const s = session as (typeof session & { bnetId?: string }) | null;
  if (!s?.bnetId) redirect("/guilds");

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/guilds"
        className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300"
      >
        Back to guilds
      </Link>
      <h1 className="mb-1 text-xl font-black uppercase tracking-tight text-white">
        Create guild recruitment
      </h1>
      <p className="mb-5 text-sm text-gray-500">
        Set up your guild and its first raid team. You can add more teams afterwards.
      </p>

      <GuildForm />
    </div>
  );
}
