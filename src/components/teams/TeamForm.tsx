"use client";

import { useEffect, useRef, useState } from "react";
import type { CurrentSelectionDTO, TeamDTO } from "@/data/dto";
import { specById, type Role } from "@/game/classes";
import { openRoleSlots } from "@/game/teamRoster";
import { ROLE_LABEL, RoleSlotPrefPickers, Field, type FormSlot } from "@/components/GroupFormShared";
import { SpecIcon } from "@/components/SpecIcon";
import { RoleIcon } from "@/components/RoleIcon";
import { ErrorModal } from "@/components/ErrorModal";
import { LanguageSelect } from "@/components/LanguageSelect";
import { ApiClientError, apiPost } from "@/lib/api-client";
import { cn } from "@/lib/utils";

const MIN_KEY = 2;
const MAX_KEY = 40;

/** "Who you're listing as": the navbar's current character for a new team,
 * but an existing team keeps the owner's own membership row - editing must
 * not silently reassign the team to whatever the navbar happens to hold. */
function resolveTeamOwner(current: CurrentSelectionDTO, editTeam: TeamDTO | null | undefined) {
  const member = editTeam?.members.find((m) => m.isOwner) ?? null;
  const ownerSpecId = member?.specId ?? current.specId;
  const ownerRole = (specById(ownerSpecId)?.role ?? "DPS") as Role;
  // Owner membership stores an id + display fields, not a full character row.
  const owner = member
    ? { id: member.characterId, name: member.characterName, realm: member.characterRealm }
    : { id: current.character.id, name: current.character.name, realm: current.character.realm };
  return { owner, ownerSpecId, ownerRole, isEdit: Boolean(editTeam) };
}

export function TeamForm({ current, editTeam }: { current: CurrentSelectionDTO; editTeam?: TeamDTO | null }) {
  const { owner, ownerSpecId, ownerRole } = resolveTeamOwner(current, editTeam);

  const [name, setName] = useState(editTeam?.name ?? "");
  const [description, setDescription] = useState(editTeam?.description ?? "");
  const [language, setLanguage] = useState<string | null>(editTeam?.language ?? null);
  const [voiceChat, setVoiceChat] = useState(editTeam?.voiceChat ?? "");

  const [requirementType, setRequirementType] = useState<"none" | "rating" | "resilient" | "custom">(
    (editTeam?.requirementType as "rating" | "resilient" | "custom" | null) ?? "none"
  );
  const [reqRating, setReqRating] = useState(editTeam?.reqRating ?? 3000);
  const [reqLevel, setReqLevel] = useState(editTeam?.reqLevel ?? 21);
  const [reqExtraCount, setReqExtraCount] = useState(editTeam?.reqExtraCount ?? 1);
  const [reqExtraLevel, setReqExtraLevel] = useState(editTeam?.reqExtraLevel ?? 22);

  // A team is a fixed 5-man party, so the open slots aren't chosen - they're
  // the party minus whoever is already on the roster. Editing keeps the
  // team's own stored slots: accepting someone trims a slot (see
  // trimSlotForRole), and re-deriving here would resurrect filled ones.
  const [slots, setSlots] = useState<FormSlot[]>(() =>
    editTeam
      ? editTeam.slots.map((s) => ({ role: s.role as Role, prefs: s.prefs }))
      : openRoleSlots([ownerRole]).map((role) => ({ role, prefs: [] }))
  );

  // Only fires while creating: the navbar picker can switch the leader's spec
  // (and so their role) mid-form, which changes which slot is theirs. Editing
  // pins the leader to their existing membership row, so ownerRole is stable
  // there. Comparing against the last-seen role rather than a "have we run
  // yet" flag keeps this safe under Strict Mode's double-invoked effects.
  const prevOwnerRole = useRef(ownerRole);
  useEffect(() => {
    if (editTeam || prevOwnerRole.current === ownerRole) return;
    prevOwnerRole.current = ownerRole;
    setSlots(openRoleSlots([ownerRole]).map((role) => ({ role, prefs: [] })));
  }, [ownerRole, editTeam]);

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!name.trim()) { setErr("Give the team a name."); return; }
    if (!ownerSpecId) { setErr("Pick a spec to play."); return; }

    setSubmitting(true);
    try {
      await apiPost(
        editTeam ? `/api/teams/${editTeam.id}` : "/api/teams",
        {
          name: name.trim(),
          description: description.trim() || null,
          language,
          voiceChat: voiceChat.trim() || null,
          ownerRole,
          ownerCharacterId: owner.id,
          ownerSpecId,
          slots: slots.map((s) => ({ role: s.role, prefs: s.prefs })),
          requirementType: requirementType === "none" ? null : requirementType,
          reqRating: requirementType === "rating" ? reqRating : null,
          reqLevel: requirementType === "resilient" || requirementType === "custom" ? reqLevel : null,
          reqExtraCount: requirementType === "custom" ? reqExtraCount : null,
          reqExtraLevel: requirementType === "custom" ? reqExtraLevel : null,
        },
        editTeam ? "PATCH" : "POST"
      );
    } catch (e) {
      setErr(e instanceof ApiClientError ? e.message : `${editTeam ? "Update" : "List"} failed.`);
      setSubmitting(false);
      return;
    }
    // Full navigation so a stale client bundle can't leave us hanging.
    window.location.assign("/teams");
  };

  return (
    <div className="space-y-6">
      <div className="panel p-4 space-y-4">
        <Field label="Team name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            className="w-full bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>

        <Field label="Language">
          <LanguageSelect value={language} onChange={setLanguage} />
        </Field>

        <Field label="Voice chat">
          <input
            type="text"
            value={voiceChat}
            onChange={(e) => setVoiceChat(e.target.value)}
            maxLength={60}
            className="w-full max-w-xs bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </Field>

        <Field label="About the team">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            maxLength={500}
            className="w-full bg-panel2 border border-panelborder rounded-md px-3 py-2 text-sm outline-none focus:border-accent resize-y"
          />
        </Field>

        <Field label="Applicant requirement">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {(["none", "rating", "resilient", "custom"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setRequirementType(mode)}
                  className={cn(
                    "chip border",
                    requirementType === mode ? "border-accent text-accent" : "border-panelborder text-gray-400"
                  )}
                >
                  {mode === "none" ? "None" : mode === "rating" ? "Min rating" : mode === "resilient" ? "Resilient" : "Custom"}
                </button>
              ))}
            </div>

            {requirementType === "rating" && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="number" min={0} max={6000} value={reqRating}
                  onChange={(e) => setReqRating(Number(e.target.value) || 0)}
                  className="w-20 bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-center tabular-nums"
                />
                <span className="text-gray-500">minimum rating</span>
              </div>
            )}

            {(requirementType === "resilient" || requirementType === "custom") && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-gray-500">Resilient +</span>
                <input
                  type="number" min={MIN_KEY} max={MAX_KEY} value={reqLevel}
                  onChange={(e) => setReqLevel(Number(e.target.value) || MIN_KEY)}
                  className="w-16 bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-center tabular-nums"
                />
                <span className="text-gray-500">on every dungeon this season, timed</span>
              </div>
            )}

            {requirementType === "custom" && (
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="text-gray-500">plus at least</span>
                <input
                  type="number" min={1} max={7} value={reqExtraCount}
                  onChange={(e) => setReqExtraCount(Number(e.target.value) || 1)}
                  className="w-14 bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-center tabular-nums"
                />
                <span className="text-gray-500">dungeon(s) timed at +</span>
                <input
                  type="number" min={MIN_KEY} max={MAX_KEY} value={reqExtraLevel}
                  onChange={(e) => setReqExtraLevel(Number(e.target.value) || MIN_KEY)}
                  className="w-16 bg-panel2 border border-panelborder rounded-md px-2 py-1.5 text-center tabular-nums"
                />
              </div>
            )}

            <p className="text-[11px] text-gray-600">
              Min rating is a hard gate - below it, nobody can apply. The other two are advisory badges only.
            </p>
          </div>
        </Field>
      </div>

      <div className="panel p-4 flex flex-wrap items-center gap-3">
        <SpecIcon specId={ownerSpecId} size={40} />
        <div>
          <div className="text-sm font-semibold">{owner.name} <span className="text-gray-500 text-xs">- {owner.realm}</span></div>
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            You&apos;re the
            <RoleIcon role={ownerRole} size={14} rounded="sm" />
            <span className="text-gray-300 font-semibold">{ROLE_LABEL[ownerRole]}</span> on this roster.
          </p>
        </div>
        <p className="ml-auto text-[11px] text-gray-500">Change character in the navbar picker ↑</p>
      </div>

      <div>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Recruiting</span>
          <span className="text-[11px] text-gray-600">
            A 5-man party minus your own spot. Rank the specs you want for each.
          </span>
        </div>

        {slots.length === 0 ? (
          <p className="panel p-4 text-sm text-gray-500">Roster is full - every spot is taken.</p>
        ) : (
          <RoleSlotPrefPickers slots={slots} setSlots={setSlots} />
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={submit} disabled={submitting} className="btn-gold disabled:opacity-50">
          {submitting ? "Saving…" : editTeam ? "Save team" : "Create team"}
        </button>
      </div>

      <ErrorModal open={err !== null} message={err ?? ""} onClose={() => setErr(null)} />
    </div>
  );
}
