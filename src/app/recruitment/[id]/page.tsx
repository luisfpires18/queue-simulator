import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { ensureUser } from "@/data/users";
import { getUserCharacters } from "@/data/characters";
import { getMPlusPost } from "@/data/mplusRecruitment";
import { getMyApplication, listApplicationsForTarget } from "@/data/recruitmentApplications";
import { PostDetail } from "@/components/recruitment/PostDetail";
import { PostOwnerActions } from "@/components/recruitment/PostOwnerActions";
import { ApplySection } from "@/components/recruitment/ApplySection";
import { TargetApplications } from "@/components/recruitment/TargetApplications";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { TANK: "Tank", HEALER: "Healer", DPS: "DPS" };

export default async function RecruitmentPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [post, session] = await Promise.all([getMPlusPost(id), auth()]);
  if (!post) notFound();

  const s = session as (typeof session & { bnetId?: string; battletag?: string }) | null;
  const user = s?.bnetId ? await ensureUser(s.bnetId, s.battletag) : null;
  const isOwner = user?.id === post.ownerUserId;

  // The owner gets their applicant queue; everyone else gets their own
  // application state and the characters they could apply with.
  const [characters, myApplication, applications] = await Promise.all([
    user && !isOwner ? getUserCharacters(user.id) : Promise.resolve([]),
    user && !isOwner ? getMyApplication("mplus", post.id, user.id) : Promise.resolve(null),
    user && isOwner ? listApplicationsForTarget("mplus", post.id, user.id) : Promise.resolve([]),
  ]);

  const positions = post.positions
    .filter((p) => !p.isFilled)
    .map((p) => ({
      id: p.id,
      role: p.role,
      label: `${ROLE_LABEL[p.role] ?? p.role}${p.isPermanent ? "" : " (substitute)"}`,
    }));

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/recruitment"
        className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-widest text-gray-500 hover:text-gray-300"
      >
        Back to recruitment
      </Link>

      <h1 className="text-xl font-black uppercase tracking-tight text-white">
        {post.teamName || post.title}
      </h1>
      {post.teamName && post.title !== post.teamName && (
        <p className="mt-1 text-sm text-gray-500">{post.title}</p>
      )}
      <div className="mb-5" />

      {isOwner && <PostOwnerActions post={post} />}

      {isOwner && <TargetApplications post={post} initialApplications={applications} />}

      <PostDetail
        post={post}
        applySlot={
          <ApplySection
            recruitmentType="mplus"
            targetId={post.id}
            targetName={post.teamName || post.title}
            ownerUserId={post.ownerUserId}
            positions={positions}
            characters={characters.filter((c) => c.bucket !== "hidden")}
            initialApplication={myApplication}
            signedIn={!!user}
            isOwner={isOwner}
          />
        }
      />
    </div>
  );
}
