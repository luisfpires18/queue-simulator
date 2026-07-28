"use client";

import { useEffect, useState } from "react";
import type { CurrentSelectionDTO, LastDeclineDTO, MyTeamApplicationStateDTO, TeamApplicationDTO, TeamDTO } from "@/data/dto";
import { specById, type Role } from "@/game/classes";
import { languageByCode } from "@/game/languages";
import { MAX_APPLICATION_DECLINES } from "@/game/applications";
import { ApiClientError, apiFetch, apiPost } from "@/lib/api-client";
import { Modal } from "@/components/ui/Modal";
import { RoleIcon } from "@/components/RoleIcon";
import { SpecIcon } from "@/components/SpecIcon";
import { WowIcon } from "@/components/WowIcon";
import { ROLE_LABEL } from "@/components/GroupFormShared";

export function TeamApplyModal({
  team, current, open, onClose, onApplied,
}: {
  team: TeamDTO;
  current: CurrentSelectionDTO | null;
  open: boolean;
  onClose: () => void;
  onApplied?: (application: TeamApplicationDTO) => void;
}) {
  const [note, setNote] = useState("");
  const [existing, setExisting] = useState<TeamApplicationDTO | null | undefined>(undefined); // undefined = loading
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Why the last application was turned down - shown before the form, so it's
  // read before re-applying rather than after.
  const [lastDecline, setLastDecline] = useState<LastDeclineDTO | null>(null);
  const [declinedCount, setDeclinedCount] = useState(0);
  // A pending application shows as a receipt, not a form - editing is a
  // second, deliberate click. Also true when reopening the modal later, so
  // there's no editable field to change by accident.
  const [editing, setEditing] = useState(false);
  // Distinguishes "you just sent this" from "you had already applied", which
  // is the whole point of the confirmation.
  const [justSent, setJustSent] = useState(false);

  useEffect(() => {
    if (!open) return;
    setErr(null);
    setExisting(undefined);
    setNote("");
    setEditing(false);
    setJustSent(false);
    setLastDecline(null);
    setDeclinedCount(0);
    apiFetch<MyTeamApplicationStateDTO>(`/api/teams/${team.id}/my-application`)
      .then((data) => {
        setExisting(data.application);
        setLastDecline(data.lastDecline ?? null);
        setDeclinedCount(data.declinedCount ?? 0);
        if (data.application?.status === "pending" && data.application.note) setNote(data.application.note);
      })
      .catch(() => setExisting(null));
  }, [open, team.id]);

  const character = current?.character;
  const specId = current?.specId ?? "";
  const role = (specById(specId)?.role ?? "DPS") as Role;
  const openForRole = team.slots.filter((s) => s.role === role);
  const hasOpenSlot = Boolean(character) && openForRole.length > 0;

  const submit = async () => {
    if (!character) return;
    setErr(null);
    setSubmitting(true);
    try {
      const data = await apiPost<{ application: TeamApplicationDTO }>(`/api/teams/${team.id}/apply`, {
        characterId: character.id,
        specId,
        role,
        note: note.trim() || null,
      });
      setExisting(data.application);
      setEditing(false);
      setJustSent(true);
      onApplied?.(data.application);
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : "Apply failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const pending = existing?.status === "pending";
  // The receipt view: there's a live application and the viewer hasn't asked
  // to change it.
  const showReceipt = pending && !editing;
  // Same two-attempt cap as a key listing - the server enforces it too.
  const outOfChances = existing?.status === "declined" && declinedCount >= MAX_APPLICATION_DECLINES;

  return (
    <Modal open={open} onClose={onClose} panelClassName="panel w-full max-w-md max-h-[85vh] overflow-y-auto p-4 space-y-4">
      <div className="flex items-center gap-2.5">
        <WowIcon slug={team.iconSlug} size={36} cdnSize="medium" />
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{team.name}</div>
          <div className="text-[11px] text-gray-500 truncate">
            {[
              `${team.members.length} member${team.members.length === 1 ? "" : "s"}`,
              team.language ? languageByCode(team.language)?.name : null,
              team.voiceChat,
            ]
              .filter(Boolean)
              .join(" - ")}
          </div>
        </div>
        <button onClick={onClose} className="ml-auto text-gray-500 hover:text-white text-lg leading-none">✕</button>
      </div>

      {!character ? (
        <p className="text-sm text-gray-400">Pick a character in the navbar before applying.</p>
      ) : (
        <>
          <div className="flex items-center gap-3 rounded-md border border-panelborder bg-panel2/60 p-2.5">
            <SpecIcon specId={specId} size={36} />
            <div>
              <div className="text-sm font-semibold">
                {character.name} <span className="text-gray-500 text-xs">- {character.realm}</span>
              </div>
              <p className="text-[11px] text-gray-500 flex items-center gap-1.5">
                Applying as <RoleIcon role={role} size={12} rounded="sm" />
                <span className="text-gray-300 font-semibold">{ROLE_LABEL[role]}</span>
              </p>
            </div>
          </div>

          {lastDecline && !showReceipt && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 p-2.5 space-y-1">
              <div className="text-xs text-rose-200">
                <span className="font-semibold">Declined:</span> {lastDecline.reasonLabel}
              </div>
              {lastDecline.note && <p className="text-xs text-gray-300 italic">&ldquo;{lastDecline.note}&rdquo;</p>}
              <p className="text-xs text-gray-400">
                {outOfChances
                  ? "Declined twice - no more attempts."
                  : `You can apply again (${MAX_APPLICATION_DECLINES - declinedCount} attempt${MAX_APPLICATION_DECLINES - declinedCount === 1 ? "" : "s"} left).`}
              </p>
            </div>
          )}

          {!hasOpenSlot && !showReceipt && (
            <p className="text-sm text-amber-300">
              This team isn&apos;t recruiting a {ROLE_LABEL[role].toLowerCase()} right now. Switch character or spec in the navbar.
            </p>
          )}

          {showReceipt ? (
            <>
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-start gap-2.5">
                <span className="text-emerald-300 text-lg leading-none">✓</span>
                <div>
                  <p className="text-sm font-semibold text-emerald-300">
                    {justSent ? "Application sent" : "Application pending"}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Waiting on {team.name} to review it. You&apos;ll get a notification either way.
                  </p>
                </div>
              </div>

              {existing?.note && (
                <div>
                  <div className="text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Your note</div>
                  <p className="text-sm text-gray-300 rounded-md border border-panelborder bg-panel2/40 p-2 whitespace-pre-wrap italic">
                    &ldquo;{existing.note}&rdquo;
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="btn-ghost flex-1">
                  Edit application
                </button>
                <button onClick={onClose} className="btn-gold flex-1">
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              {/* No point offering a note they can no longer send. */}
              <div className={outOfChances ? "hidden" : undefined}>
                <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wide">Note to the team</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={4}
                  maxLength={500}
                  disabled={submitting}
                  className="w-full bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm outline-none focus:border-accent resize-y"
                />
              </div>

              {err && <p className="text-xs text-rose-400 rounded-md border border-rose-500/40 bg-rose-500/10 p-2">{err}</p>}

              {existing?.status === "accepted" ? (
                <p className="text-sm text-emerald-300">You&apos;re on this team.</p>
              ) : outOfChances ? (
                <div className="rounded-md border border-rose-500/50 bg-rose-500/10 px-3 py-2 text-center text-sm font-semibold uppercase tracking-wide text-rose-300">
                  Declined twice - no more attempts
                </div>
              ) : (
                <div className="flex gap-2">
                  {editing && (
                    <button
                      // Discards the edit rather than keeping it staged - the
                      // receipt would otherwise show a note that was never sent.
                      onClick={() => { setNote(existing?.note ?? ""); setErr(null); setEditing(false); }}
                      disabled={submitting}
                      className="btn-ghost"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    onClick={submit}
                    disabled={submitting || !hasOpenSlot || existing === undefined}
                    className="btn-gold flex-1 disabled:opacity-50"
                  >
                    {submitting ? "Sending…" : editing ? "Save changes" : existing?.status === "declined" ? "Apply again" : "Apply"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}
