import { describe, it, expect } from "vitest";
import {
  raidDayMatch,
  difficultyMatch,
  progressionDistance,
  progressionMatch,
  bossExperienceMatch,
  attendanceMatch,
  atmosphereMatch,
  offRoleMatch,
  progressionFromBossExperience,
  explainGuildApplication,
  type Progression,
  type GuildTeamProfile,
  type RaiderApplicantProfile,
} from "./guildMatch";
import type { WeeklySlot } from "./availability";
import type { BossExperience } from "./recruitmentTypes";

const night = (day: number): WeeklySlot => ({ day, startMin: 20 * 60, endMin: 23 * 60 });

/** Tue/Wed/Thu, the classic three-night mythic schedule. */
const THREE_NIGHTS = [night(2), night(3), night(4)];

const prog = (over: Partial<Progression> = {}): Progression => ({
  raidId: "raid-1",
  bossesKilled: 6,
  difficulty: "mythic",
  ...over,
});

const boss = (over: Partial<BossExperience> = {}): BossExperience => ({
  raidId: "raid-1",
  bossId: "boss-8",
  difficulty: "mythic",
  state: "killed",
  ...over,
});

describe("raidDayMatch", () => {
  it("is strong when the raider covers every raid night", () => {
    const m = raidDayMatch(THREE_NIGHTS, THREE_NIGHTS);
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Available for all 3 raid nights");
  });

  it("is partial when one night is missing, and names it", () => {
    const m = raidDayMatch([night(2), night(3)], THREE_NIGHTS);
    expect(m.level).toBe("partial");
    expect(m.reason).toBe("Available for 2 of 3 raid nights");
    expect(m.detail).toBe("Cannot make Thu.");
  });

  it("is none when no raid night is covered", () => {
    expect(raidDayMatch([night(6)], THREE_NIGHTS).level).toBe("none");
  });

  it("counts a night only when the times actually meet, not just the day", () => {
    // Free Tuesday MORNING against a Tuesday evening raid is not availability.
    const morning: WeeklySlot = { day: 2, startMin: 8 * 60, endMin: 11 * 60 };
    expect(raidDayMatch([morning], [night(2)]).level).toBe("none");
  });

  it("uses the singular for a one-night team", () => {
    expect(raidDayMatch([night(2)], [night(2)]).reason).toBe("Available for all 1 raid night");
  });

  it("reports missing schedule data explicitly", () => {
    expect(raidDayMatch([], THREE_NIGHTS).reason).toBe("No availability information provided");
  });
});

describe("difficultyMatch", () => {
  it("is strong on an exact match", () => {
    const m = difficultyMatch("mythic", "mythic");
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Both want Mythic");
  });

  it("is partial one step apart", () => {
    expect(difficultyMatch("heroic", "mythic").level).toBe("partial");
    expect(difficultyMatch("mythic", "heroic").level).toBe("partial");
  });

  it("is none two steps apart", () => {
    expect(difficultyMatch("normal", "mythic").level).toBe("none");
  });

  it("reports unknown difficulties rather than guessing", () => {
    expect(difficultyMatch("", "mythic").level).toBe("none");
  });
});

describe("progressionDistance", () => {
  it("is zero for identical progression", () => {
    expect(progressionDistance(prog(), prog())).toBe(0);
  });

  it("is negative when the first side is behind", () => {
    expect(progressionDistance(prog({ bossesKilled: 4 }), prog({ bossesKilled: 6 }))).toBe(-2);
  });

  it("ranks a Mythic kill above a full Heroic clear", () => {
    const mythic2 = prog({ bossesKilled: 2, difficulty: "mythic" });
    const heroic8 = prog({ bossesKilled: 8, difficulty: "heroic" });
    expect(progressionDistance(mythic2, heroic8)).toBeGreaterThan(0);
  });

  it("returns null when either side is unknown, so callers cannot read it as equal", () => {
    expect(progressionDistance(prog({ bossesKilled: null }), prog())).toBeNull();
    expect(progressionDistance(prog(), prog({ bossesKilled: null }))).toBeNull();
  });
});

describe("progressionMatch", () => {
  it("is strong on the guild's exact progression boss", () => {
    const m = progressionMatch(prog(), prog());
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Matches the guild's current progression boss");
  });

  it("treats one boss behind as a strong match, not a rejection", () => {
    const m = progressionMatch(prog({ bossesKilled: 5 }), prog({ bossesKilled: 6 }));
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Current experience is 1 boss behind the guild");
  });

  it("is partial a few bosses behind", () => {
    expect(progressionMatch(prog({ bossesKilled: 2 }), prog({ bossesKilled: 6 })).level).toBe("partial");
  });

  it("is none well behind", () => {
    expect(progressionMatch(prog({ bossesKilled: 0, difficulty: "normal" }), prog()).level).toBe("none");
  });

  it("flags an over-qualified raider as partial", () => {
    const m = progressionMatch(prog({ bossesKilled: 8 }), prog({ bossesKilled: 6 }));
    expect(m.level).toBe("partial");
    expect(m.reason).toBe("Ahead of the guild's progression by 2 bosses");
  });

  it("reports missing progression explicitly", () => {
    const m = progressionMatch(prog({ bossesKilled: null }), prog());
    expect(m.reason).toBe("No progression information provided");
    expect(m.detail).toContain("has not recorded");
  });
});

describe("bossExperienceMatch", () => {
  it("is strong on a kill at the difficulty asked about", () => {
    const m = bossExperienceMatch([boss({ kills: 6 })], "raid-1", "boss-8", "mythic");
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Killed Mythic 6 times");
  });

  it("uses the singular for a single kill and defaults a missing count to one", () => {
    expect(bossExperienceMatch([boss()], "raid-1", "boss-8", "mythic").reason).toBe("Killed Mythic 1 time");
  });

  it("is strong on farm experience", () => {
    const m = bossExperienceMatch([boss({ state: "farm" })], "raid-1", "boss-8", "mythic");
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Farm experience on Mythic");
  });

  it("counts progression without a kill as partial, naming the phase", () => {
    const m = bossExperienceMatch(
      [boss({ state: "progressed", phaseReached: 3 })],
      "raid-1",
      "boss-8",
      "mythic"
    );
    expect(m.level).toBe("partial");
    expect(m.reason).toBe("Reached phase 3 on Mythic");
  });

  it("lets a higher-difficulty kill satisfy a lower-difficulty question", () => {
    const m = bossExperienceMatch([boss({ difficulty: "mythic" })], "raid-1", "boss-8", "heroic");
    expect(m.level).toBe("strong");
  });

  it("does not let a lower-difficulty kill count as the higher one, but keeps it as partial", () => {
    const m = bossExperienceMatch([boss({ difficulty: "heroic" })], "raid-1", "boss-8", "mythic");
    expect(m.level).toBe("partial");
    expect(m.reason).toBe("No Mythic kill, but killed it on Heroic");
  });

  it("is none with no entry for that boss", () => {
    expect(bossExperienceMatch([boss()], "raid-1", "boss-other", "mythic").level).toBe("none");
  });

  it("does not match a boss from a different raid", () => {
    expect(bossExperienceMatch([boss()], "raid-2", "boss-8", "mythic").level).toBe("none");
  });

  it("picks the best entry when several exist for the same boss", () => {
    const m = bossExperienceMatch(
      [boss({ state: "progressed", phaseReached: 2 }), boss({ state: "killed", kills: 3 })],
      "raid-1",
      "boss-8",
      "mythic"
    );
    expect(m.reason).toBe("Killed Mythic 3 times");
  });
});

describe("attendanceMatch", () => {
  it("is strong when the raider meets the requirement", () => {
    expect(attendanceMatch(90, 85).level).toBe("strong");
  });

  it("is partial when slightly under", () => {
    expect(attendanceMatch(80, 85).level).toBe("partial");
  });

  it("is none when well under", () => {
    expect(attendanceMatch(50, 90).level).toBe("none");
  });

  it("reports missing data rather than assuming a failure", () => {
    expect(attendanceMatch(null, 85).reason).toBe("No attendance information provided");
  });
});

describe("atmosphereMatch", () => {
  it("is strong on an identical preference", () => {
    const m = atmosphereMatch("focused", "focused");
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Preferred atmosphere and progression goals match");
  });

  it("is partial when they differ", () => {
    expect(atmosphereMatch("chill", "competitive").level).toBe("partial");
  });

  it("reports a missing preference", () => {
    expect(atmosphereMatch(null, "chill").level).toBe("none");
  });
});

describe("progressionFromBossExperience", () => {
  const exp = (bossId: string, over: Partial<BossExperience> = {}): BossExperience => ({
    raidId: "raid-1",
    bossId,
    difficulty: "mythic",
    state: "killed",
    ...over,
  });

  it("counts kills in the given raid at the given difficulty", () => {
    const p = progressionFromBossExperience([exp("b1"), exp("b2"), exp("b3")], "raid-1", "mythic");
    expect(p.bossesKilled).toBe(3);
    expect(p.raidId).toBe("raid-1");
  });

  it("counts farm as killed", () => {
    const p = progressionFromBossExperience([exp("b1", { state: "farm" })], "raid-1", "mythic");
    expect(p.bossesKilled).toBe(1);
  });

  it("does not count progression without a kill", () => {
    // progressionMatch measures where you have FINISHED; bossExperienceMatch
    // is what gives partial credit for progress on a specific boss.
    const p = progressionFromBossExperience(
      [exp("b1", { state: "progressed", phaseReached: 3 }), exp("b2", { state: "not_attempted" })],
      "raid-1",
      "mythic"
    );
    expect(p.bossesKilled).toBe(0);
  });

  it("lets a higher difficulty satisfy a lower question", () => {
    const p = progressionFromBossExperience([exp("b1", { difficulty: "mythic" })], "raid-1", "heroic");
    expect(p.bossesKilled).toBe(1);
  });

  it("does not let a lower difficulty count for a higher one", () => {
    const p = progressionFromBossExperience([exp("b1", { difficulty: "heroic" })], "raid-1", "mythic");
    expect(p.bossesKilled).toBe(0);
  });

  it("ignores other raids", () => {
    const p = progressionFromBossExperience([exp("b1", { raidId: "raid-2" })], "raid-1", "mythic");
    expect(p.bossesKilled).toBe(0);
  });

  it("counts each boss once even with several entries", () => {
    // A boss killed on Heroic and again on Mythic is still one boss down.
    const p = progressionFromBossExperience(
      [exp("b1", { difficulty: "heroic" }), exp("b1", { difficulty: "mythic" })],
      "raid-1",
      "heroic"
    );
    expect(p.bossesKilled).toBe(1);
  });

  it("produces something progressionMatch can compare directly", () => {
    const raider = progressionFromBossExperience([exp("b1"), exp("b2")], "raid-1", "mythic");
    const guild = { raidId: "raid-1", bossesKilled: 3, difficulty: "mythic" };
    expect(progressionMatch(raider, guild).reason).toBe(
      "Current experience is 1 boss behind the guild"
    );
  });
});

describe("explainGuildApplication", () => {
  const raider: RaiderApplicantProfile = {
    preferredRole: "DPS",
    offRoles: ["HEALER"],
    availability: THREE_NIGHTS,
    languages: ["en"],
    preferredDifficulty: "mythic",
    progression: prog({ bossesKilled: 5 }),
    bossExperience: [boss({ bossId: "boss-8", kills: 2 })],
    attendanceExpectation: 90,
    atmosphere: "focused",
  };

  const team: GuildTeamProfile = {
    availability: THREE_NIGHTS,
    languages: ["en"],
    difficulty: "mythic",
    progression: prog({ bossesKilled: 6 }),
    attendanceRequirement: 85,
    atmosphere: "focused",
    neededRole: "HEALER",
    currentBossId: "boss-8",
  };

  it("explains every dimension separately", () => {
    const reasons = explainGuildApplication(raider, team).map((f) => f.reason);
    expect(reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("raid night"),
        expect.stringContaining("behind the guild"),
        expect.stringContaining("Killed Mythic"),
        expect.stringContaining("Both want Mythic"),
        expect.stringContaining("commit to"),
      ])
    );
  });

  it("leads with raid-night availability, the first thing an officer checks", () => {
    expect(explainGuildApplication(raider, team)[0].reason).toContain("raid night");
  });

  it("mentions off-role cover only when the needed role is one they can play", () => {
    const covered = explainGuildApplication(raider, team);
    expect(covered.some((f) => f.reason.includes("switch to healer"))).toBe(true);

    const notCovered = explainGuildApplication(raider, { ...team, neededRole: "TANK" });
    expect(notCovered.some((f) => f.reason.includes("switch to"))).toBe(false);
  });

  it("skips boss experience when the guild has not named its current boss", () => {
    const facets = explainGuildApplication(raider, { ...team, currentBossId: null });
    expect(facets.some((f) => f.reason.includes("Killed"))).toBe(false);
  });

  it("never collapses to a single number", () => {
    const facets = explainGuildApplication(raider, team);
    expect(facets.length).toBeGreaterThan(3);
    for (const f of facets) expect(f.reason).toBeTruthy();
  });
});

describe("offRoleMatch", () => {
  it("recognises a coverable off-role", () => {
    const m = offRoleMatch(["HEALER"], "HEALER");
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Can switch to healer when required");
  });

  it("is none when the role is not covered", () => {
    expect(offRoleMatch(["TANK"], "HEALER").level).toBe("none");
  });
});
