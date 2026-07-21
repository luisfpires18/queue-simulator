"use client";

import { useMemo, useState } from "react";
import { ApplicationList } from "@/components/recruitment/ApplicationList";
import { shiftToUtc } from "@/game/availability";
import {
  explainGuildApplication,
  progressionFromBossExperience,
  type GuildTeamProfile,
  type RaiderApplicantProfile,
} from "@/game/guildMatch";
import type { MatchFacet } from "@/game/recruitmentMatch";
import type { RaidTeamDTO } from "@/data/recruitmentDto";
import type { RecruitmentApplicationDTO } from "@/data/recruitmentApplications";
import type { RaidDifficulty } from "@/game/recruitmentTypes";

/** The owner's applicant queue for one raid team.
 *
 * Match explanations need the applicant's published raider profile, which the
 * recruiter read joins in. An applicant with no profile still shows - they
 * simply have no facets to explain, which is stated by their absence rather
 * than guessed at. */
export function GuildApplications({
  team,
  initial,
}: {
  team: RaidTeamDTO;
  initial: RecruitmentApplicationDTO[];
}) {
  const [applications, setApplications] = useState(initial);

  const facetsById = useMemo(() => {
    // Both sides shifted to UTC before comparing - a raw comparison of two
    // local schedules silently equates 20:00 Lisbon with 20:00 Sydney.
    const now = new Date();
    const teamNights = shiftToUtc(team.availability, team.timeZone, now);
    const difficulty = team.difficulty as RaidDifficulty;

    const teamProfile: GuildTeamProfile = {
      availability: teamNights,
      languages: team.guild?.languages ?? [],
      difficulty: team.difficulty,
      progression: {
        raidId: team.currentRaidId,
        bossesKilled: team.currentBossesKilled,
        difficulty: team.difficulty,
      },
      attendanceRequirement: team.attendanceRequirement,
      atmosphere: null,
      currentBossId: null,
    };

    const out = new Map<string, MatchFacet[]>();
    for (const a of applications) {
      const p = a.raiderProfile;
      if (!p) continue;

      const raider: RaiderApplicantProfile = {
        preferredRole: p.preferredRole,
        offRoles: p.offRoles,
        availability: shiftToUtc(p.availability, p.timeZone, now),
        languages: p.languages,
        preferredDifficulty: p.preferredDifficulty,
        // The raider records per-boss detail, not a "6/8 M" pair, so their
        // comparable progression is derived from it against THIS team's raid.
        progression: team.currentRaidId
          ? progressionFromBossExperience(p.bossExperience, team.currentRaidId, difficulty)
          : { raidId: null, bossesKilled: null, difficulty: p.preferredDifficulty },
        bossExperience: p.bossExperience,
        attendanceExpectation: p.attendanceExpectation,
        atmosphere: p.atmosphere,
      };

      out.set(a.id, explainGuildApplication(raider, { ...teamProfile, neededRole: a.role }));
    }
    return out;
  }, [applications, team]);

  function onChanged(updated: RecruitmentApplicationDTO) {
    setApplications((all) =>
      all
        .map((a) => (a.id === updated.id ? { ...a, ...updated } : a))
        .filter((a) => !["declined", "withdrawn", "expired"].includes(a.status))
    );
  }

  return <ApplicationList applications={applications} facetsById={facetsById} onChanged={onChanged} />;
}
