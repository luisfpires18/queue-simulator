"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api-client";
import { formatExpiry, isStale } from "@/game/expiry";
import { RECRUITMENT_STATUS_LABEL } from "@/game/recruitmentTypes";
import type { MPlusRecruitmentPostDTO } from "@/data/recruitmentDto";

/** Owner-only controls on a post's detail page: refresh, pause/reopen, delete.
 * Rendered above the read-only detail so the owner sees the state of their own
 * listing before its contents. */
export function PostOwnerActions({ post: initial }: { post: MPlusRecruitmentPostDTO }) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const stale = isStale(post, "mplus");

  async function run(fn: () => Promise<MPlusRecruitmentPostDTO>) {
    setBusy(true);
    setError(null);
    try {
      setPost(await fn());
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const refresh = () =>
    run(async () => (await apiPost<{ post: MPlusRecruitmentPostDTO }>(`/api/recruitment/mplus/${post.id}/refresh`)).post);

  const setStatus = (status: string) =>
    run(
      async () =>
        (
          await apiPost<{ post: MPlusRecruitmentPostDTO }>(
            `/api/recruitment/mplus/${post.id}/status`,
            { status },
            "PATCH"
          )
        ).post
    );

  async function remove() {
    setBusy(true);
    try {
      await apiPost(`/api/recruitment/mplus/${post.id}`, undefined, "DELETE");
      router.push("/recruitment?tab=mine");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete the post.");
      setBusy(false);
    }
  }

  return (
    <div className="panel mb-5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">Your post</p>
          <p className="mt-0.5 text-sm text-gray-300">
            {RECRUITMENT_STATUS_LABEL[post.status as keyof typeof RECRUITMENT_STATUS_LABEL]} ·{" "}
            <span className={stale ? "text-gold" : "text-gray-500"}>{formatExpiry(post)}</span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={`/recruitment/create?edit=${post.id}`} className="btn-ghost">
            Edit
          </Link>
          <button type="button" onClick={refresh} disabled={busy} className="btn-ghost">
            Refresh
          </button>
          {post.status === "open" ? (
            <button type="button" onClick={() => setStatus("paused")} disabled={busy} className="btn-ghost">
              Pause
            </button>
          ) : (
            <button type="button" onClick={() => setStatus("open")} disabled={busy} className="btn-gold">
              Reopen
            </button>
          )}
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy}
            className="btn-ghost hover:text-rose-300"
          >
            Delete
          </button>
        </div>
      </div>

      {stale && post.status === "open" && (
        <p className="mt-3 text-xs text-gray-500">
          This post is past halfway through its life. Refresh it to keep it near the top of browse.
        </p>
      )}

      {confirmingDelete && (
        <div className="mt-3 rounded-md border border-rose-500/40 bg-rose-500/5 p-3">
          <p className="text-sm text-gray-200">Delete this post permanently?</p>
          <div className="mt-2 flex gap-2">
            <button type="button" onClick={remove} disabled={busy} className="btn-gold">
              Yes, delete it
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} className="btn-ghost">
              Keep it
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
