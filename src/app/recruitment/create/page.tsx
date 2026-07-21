import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { getUserCharacters } from "@/data/characters";
import { getMPlusPost } from "@/data/mplusRecruitment";
import { RecruitmentPostForm } from "@/components/recruitment/RecruitmentPostForm";

export const dynamic = "force-dynamic";

/** `?edit=<id>` switches the form to editing an existing post, matching how
 * /list handles the same job for key listings. */
export default async function CreateRecruitmentPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const [{ edit }, session] = await Promise.all([searchParams, auth()]);
  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  if (!s?.bnetId) redirect("/recruitment");

  const user = await ensureUser(s.bnetId, s.battletag);
  const [characters, editPost] = await Promise.all([
    getUserCharacters(user.id),
    edit ? getMPlusPost(edit) : Promise.resolve(null),
  ]);

  // Editing someone else's post is a redirect, not an error page - the only
  // way to land here is a hand-edited URL.
  if (editPost && editPost.ownerUserId !== user.id) redirect("/recruitment");

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/recruitment"
        className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300"
      >
        Back to recruitment
      </Link>
      <h1 className="mb-1 text-xl font-black uppercase tracking-tight text-white">
        {editPost ? "Edit recruitment post" : "Create recruitment post"}
      </h1>
      <p className="mb-5 text-sm text-gray-500">
        This is a standing post for finding regular teammates. For a single key right now, use{" "}
        <Link href="/list" className="text-accent hover:brightness-110">
          list a key
        </Link>{" "}
        instead.
      </p>

      <RecruitmentPostForm
        characters={characters.filter((c) => c.bucket !== "hidden")}
        editPost={editPost}
      />
    </div>
  );
}
