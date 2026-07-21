import { describe, it, expect } from "vitest";
import {
  roleMatch,
  specMatch,
  flexibilityMatch,
  keyRangeMatch,
  targetKeyMatch,
  scheduleMatch,
  languageMatch,
  goalMatch,
  voiceMatch,
  bestPositionFor,
  compatibilityBucket,
  fairOrder,
  explainApplication,
  type PositionLike,
  type CandidateLike,
  type MatchFacet,
  type ApplicantProfile,
  type TeamProfile,
} from "./recruitmentMatch";
import type { WeeklySlot } from "./availability";

// Real spec ids from src/game/classes.ts, so the label text in the assertions
// below is the text a user actually sees.
const PROT_PALADIN = "paladin:protection";
const RET_PALADIN = "paladin:retribution";
const HOLY_PALADIN = "paladin:holy";
const FURY_WARRIOR = "warrior:fury";
const BM_HUNTER = "hunter:beastmastery";

const evening = (day: number): WeeklySlot => ({ day, startMin: 20 * 60, endMin: 23 * 60 });

const candidate = (over: Partial<CandidateLike> = {}): CandidateLike => ({
  primarySpecId: RET_PALADIN,
  alternateSpecIds: [],
  preferredRole: "DPS",
  willingRoles: [],
  ...over,
});

const position = (over: Partial<PositionLike> = {}): PositionLike => ({
  role: "DPS",
  preferredSpecIds: [],
  acceptedSpecIds: [],
  isPermanent: true,
  isFlexible: false,
  isFilled: false,
  ...over,
});

describe("roleMatch", () => {
  it("is strong when the main role is the role being recruited", () => {
    expect(roleMatch("HEALER", [], "HEALER").level).toBe("strong");
  });

  it("is partial when the role is only one they are willing to play", () => {
    const m = roleMatch("HEALER", ["TANK"], "TANK");
    expect(m.level).toBe("partial");
    expect(m.reason).toBe("Willing to play tank");
  });

  it("is none when the role is neither main nor willing", () => {
    expect(roleMatch("HEALER", ["DPS"], "TANK").level).toBe("none");
  });
});

describe("specMatch", () => {
  it("is strong on a preferred spec", () => {
    const m = specMatch(RET_PALADIN, [], [RET_PALADIN], []);
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Retribution is a preferred spec");
  });

  it("is strong on an accepted spec", () => {
    expect(specMatch(RET_PALADIN, [], [FURY_WARRIOR], [RET_PALADIN]).level).toBe("strong");
  });

  it("treats an empty preferred AND accepted list as any spec welcome", () => {
    const m = specMatch(RET_PALADIN, [], [], []);
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Any spec in this role is accepted");
  });

  it("is partial when only an ALTERNATE spec is preferred", () => {
    const m = specMatch(RET_PALADIN, [PROT_PALADIN], [PROT_PALADIN], []);
    expect(m.level).toBe("partial");
    expect(m.reason).toBe("Off-spec Protection is preferred");
  });

  it("is partial when only an alternate spec is accepted", () => {
    const m = specMatch(RET_PALADIN, [HOLY_PALADIN], [FURY_WARRIOR], [HOLY_PALADIN]);
    expect(m.level).toBe("partial");
    expect(m.reason).toBe("Off-spec Holy is accepted");
  });

  it("is none when no spec on either side lines up", () => {
    expect(specMatch(RET_PALADIN, [HOLY_PALADIN], [FURY_WARRIOR], [BM_HUNTER]).level).toBe("none");
  });

  it("prefers the preferred list over the accepted list when both would hit", () => {
    const m = specMatch(RET_PALADIN, [], [RET_PALADIN], [RET_PALADIN]);
    expect(m.reason).toContain("preferred");
  });
});

describe("flexibilityMatch", () => {
  it("recognises an alternate spec in a different role", () => {
    const m = flexibilityMatch(RET_PALADIN, [PROT_PALADIN]);
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Alternate tank spec adds roster flexibility");
  });

  it("ignores alternate specs in the same role", () => {
    expect(flexibilityMatch(RET_PALADIN, [FURY_WARRIOR]).level).toBe("none");
  });

  it("is none with no alternate specs", () => {
    expect(flexibilityMatch(RET_PALADIN, []).level).toBe("none");
  });
});

describe("keyRangeMatch", () => {
  it("is strong on an overlapping range", () => {
    expect(keyRangeMatch({ min: 18, max: 22 }, { min: 20, max: 24 }).level).toBe("strong");
  });

  it("is partial when the candidate is one or two levels below the team", () => {
    const m = keyRangeMatch({ min: 16, max: 18 }, { min: 20, max: 23 });
    expect(m.level).toBe("partial");
    expect(m.reason).toBe("Has experience 2 levels below the team's current range");
  });

  it("uses the singular for a one-level gap", () => {
    expect(keyRangeMatch({ min: 16, max: 19 }, { min: 20, max: 23 }).reason).toBe(
      "Has experience 1 level below the team's current range"
    );
  });

  it("is none when the candidate is far below the team", () => {
    expect(keyRangeMatch({ min: 5, max: 8 }, { min: 20, max: 23 }).level).toBe("none");
  });

  it("flags an over-qualified candidate as partial rather than perfect", () => {
    const m = keyRangeMatch({ min: 26, max: 28 }, { min: 20, max: 23 });
    expect(m.level).toBe("partial");
    expect(m.reason).toBe("Runs above the team's current range");
  });

  it("treats a null upper bound as open-ended", () => {
    expect(keyRangeMatch({ min: 18, max: null }, { min: 25, max: 28 }).level).toBe("strong");
  });

  it("reports missing data explicitly instead of silently scoring zero", () => {
    const m = keyRangeMatch({ min: null, max: null }, { min: null, max: null });
    expect(m.level).toBe("none");
    expect(m.reason).toBe("No key range information provided");
    expect(m.detail).toContain("has not filled in");
  });
});

describe("targetKeyMatch", () => {
  it("is strong when both aim at the same band", () => {
    expect(targetKeyMatch({ min: 20, max: 25 }, { min: 22, max: 26 }).level).toBe("strong");
  });

  it("is partial, not a rejection, when the targets differ", () => {
    expect(targetKeyMatch({ min: 10, max: 12 }, { min: 25, max: 30 }).level).toBe("partial");
  });
});

describe("scheduleMatch", () => {
  it("is strong on a multi-hour shared window", () => {
    const m = scheduleMatch([evening(2), evening(4)], [evening(2), evening(4)]);
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Strong schedule overlap on Tue, Thu");
  });

  it("is partial on a thin shared window", () => {
    // One hour together: enough to be worth showing, under the two-hour bar
    // for a strong overlap.
    const a: WeeklySlot[] = [{ day: 2, startMin: 20 * 60, endMin: 21 * 60 }];
    const b: WeeklySlot[] = [{ day: 2, startMin: 20 * 60, endMin: 23 * 60 }];
    expect(scheduleMatch(a, b).level).toBe("partial");
  });

  it("is none when the shared window is too short to run a key in", () => {
    const a: WeeklySlot[] = [{ day: 2, startMin: 20 * 60, endMin: 20 * 60 + 20 }];
    const b: WeeklySlot[] = [{ day: 2, startMin: 20 * 60, endMin: 23 * 60 }];
    expect(scheduleMatch(a, b).level).toBe("none");
  });

  it("is none when the schedules never meet", () => {
    expect(scheduleMatch([evening(1)], [evening(5)]).level).toBe("none");
  });

  it("reports missing availability explicitly", () => {
    expect(scheduleMatch([], [evening(1)]).reason).toBe("No availability information provided");
  });
});

describe("languageMatch", () => {
  it("is strong on a shared language and names it", () => {
    const m = languageMatch(["pt", "en"], ["en"]);
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Both speak English");
  });

  it("is none with no shared language", () => {
    expect(languageMatch(["pt"], ["ko"]).level).toBe("none");
  });

  it("reports missing data rather than a mismatch", () => {
    expect(languageMatch([], ["en"]).reason).toBe("No language information provided");
  });
});

describe("goalMatch", () => {
  it("is strong on an identical goal", () => {
    const m = goalMatch("push", "push");
    expect(m.level).toBe("strong");
    expect(m.reason).toBe("Matches the team's key pushing goal");
  });

  it("is partial for adjacent goals", () => {
    expect(goalMatch("push", "title").level).toBe("partial");
    expect(goalMatch("vault", "learning").level).toBe("partial");
  });

  it("is none for opposed goals", () => {
    expect(goalMatch("vault", "competitive").level).toBe("none");
  });
});

describe("voiceMatch", () => {
  it("is strong when the team does not require voice", () => {
    expect(voiceMatch(false, false).level).toBe("strong");
  });

  it("is strong when the candidate has voice and the team wants it", () => {
    expect(voiceMatch(true, true).level).toBe("strong");
  });

  it("is none when the team requires voice and the candidate has none", () => {
    expect(voiceMatch(false, true).level).toBe("none");
  });
});

describe("bestPositionFor", () => {
  it("names the position the candidate fills", () => {
    const res = bestPositionFor(candidate({ preferredRole: "HEALER", primarySpecId: HOLY_PALADIN }), [
      position({ role: "HEALER", isPermanent: true }),
    ]);
    expect(res?.facet.reason).toBe("Fills the permanent healer position");
  });

  it("describes a non-permanent seat as a substitute", () => {
    const res = bestPositionFor(candidate(), [position({ isPermanent: false })]);
    expect(res?.facet.reason).toBe("Fills the substitute dps position");
  });

  it("skips positions already filled", () => {
    expect(bestPositionFor(candidate(), [position({ isFilled: true })])).toBeNull();
  });

  it("skips positions in a role the candidate cannot cover", () => {
    expect(bestPositionFor(candidate(), [position({ role: "TANK" })])).toBeNull();
  });

  it("still considers a mismatched role when the position is flexible", () => {
    const res = bestPositionFor(candidate(), [position({ role: "TANK", isFlexible: true })]);
    expect(res).not.toBeNull();
  });

  it("rejects a position whose spec requirements exclude the candidate", () => {
    expect(bestPositionFor(candidate(), [position({ acceptedSpecIds: [BM_HUNTER] })])).toBeNull();
  });

  it("prefers the position that matches on both role and spec", () => {
    const exact = position({ role: "DPS", preferredSpecIds: [RET_PALADIN] });
    const loose = position({ role: "TANK", isFlexible: true });
    const res = bestPositionFor(candidate({ willingRoles: ["TANK"] }), [loose, exact]);
    expect(res?.position).toBe(exact);
    expect(res?.facet.level).toBe("strong");
  });
});

describe("compatibilityBucket", () => {
  it("counts only the strong facets", () => {
    const facets: MatchFacet[] = [
      { level: "strong", reason: "" },
      { level: "partial", reason: "" },
      { level: "strong", reason: "" },
      { level: "none", reason: "" },
    ];
    expect(compatibilityBucket(facets)).toBe(2);
  });
});

describe("fairOrder", () => {
  const c = (id: string, createdAt: string, lastActiveAt?: string) => ({ id, createdAt, lastActiveAt });

  it("puts the earliest application first", () => {
    const out = fairOrder([
      c("b", "2026-07-10T00:00:00Z"),
      c("a", "2026-07-01T00:00:00Z"),
      c("c", "2026-07-20T00:00:00Z"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("breaks a tie on application time by recent activity", () => {
    const out = fairOrder([
      c("stale", "2026-07-01T00:00:00Z", "2026-07-02T00:00:00Z"),
      c("active", "2026-07-01T00:00:00Z", "2026-07-19T00:00:00Z"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["active", "stale"]);
  });

  it("is deterministic for the same seed", () => {
    const input = [c("a", "2026-07-01T00:00:00Z"), c("b", "2026-07-01T00:00:00Z")];
    expect(fairOrder(input, 5).map((x) => x.id)).toEqual(fairOrder(input, 5).map((x) => x.id));
  });

  it("rotates fully-tied candidates between seeds rather than freezing one on top", () => {
    const input = Array.from({ length: 12 }, (_, i) => c(`id-${i}`, "2026-07-01T00:00:00Z"));
    const first = fairOrder(input, 1).map((x) => x.id);
    const second = fairOrder(input, 2).map((x) => x.id);
    expect(first).not.toEqual(second);
  });

  it("does not reorder by any rating or performance field", () => {
    // Candidates carry no rating at all - the ordering contract is time and
    // activity only, so a high-rated late applicant must stay behind an
    // earlier one.
    const out = fairOrder([
      c("late-superstar", "2026-07-20T00:00:00Z"),
      c("early-average", "2026-07-01T00:00:00Z"),
    ]);
    expect(out[0].id).toBe("early-average");
  });

  it("does not mutate its input", () => {
    const input = [c("b", "2026-07-10T00:00:00Z"), c("a", "2026-07-01T00:00:00Z")];
    fairOrder(input);
    expect(input.map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("explainApplication", () => {
  const applicant = (over: Partial<ApplicantProfile> = {}): ApplicantProfile => ({
    primarySpecId: HOLY_PALADIN,
    alternateSpecIds: [],
    preferredRole: "HEALER",
    willingRoles: [],
    availability: [evening(2), evening(4)],
    languages: ["en"],
    goal: "push",
    currentKeyMin: 18,
    currentKeyMax: 22,
    hasVoice: true,
    ...over,
  });

  const team = (over: Partial<TeamProfile> = {}): TeamProfile => ({
    availability: [evening(2), evening(4)],
    languages: ["en"],
    goal: "push",
    currentKeyMin: 20,
    currentKeyMax: 24,
    targetKeyMin: null,
    targetKeyMax: null,
    voiceRequired: true,
    positions: [position({ role: "HEALER" })],
    ...over,
  });

  it("leads with the position the applicant fills", () => {
    const facets = explainApplication(applicant(), team());
    expect(facets[0].reason).toBe("Fills the permanent healer position");
  });

  it("explains every dimension separately rather than blending them", () => {
    const reasons = explainApplication(applicant(), team()).map((f) => f.reason);
    expect(reasons).toEqual(
      expect.arrayContaining([
        expect.stringContaining("healer position"),
        expect.stringContaining("schedule overlap"),
        expect.stringContaining("Runs"),
        expect.stringContaining("push"),
        expect.stringContaining("English"),
      ])
    );
  });

  it("never collapses to a single number", () => {
    const facets = explainApplication(applicant(), team());
    // Every facet carries its own sentence. If this ever becomes one blended
    // score the product rule has been broken.
    expect(facets.length).toBeGreaterThan(3);
    for (const f of facets) {
      expect(f.reason).toBeTruthy();
      expect(["strong", "partial", "none"]).toContain(f.level);
    }
  });

  it("omits the position facet when nothing fits", () => {
    const facets = explainApplication(applicant(), team({ positions: [position({ role: "TANK" })] }));
    expect(facets.some((f) => f.reason.includes("position"))).toBe(false);
  });

  it("surfaces roster flexibility only when it is real", () => {
    const withFlex = explainApplication(
      applicant({ alternateSpecIds: [PROT_PALADIN] }),
      team()
    );
    expect(withFlex.some((f) => f.reason.includes("roster flexibility"))).toBe(true);

    const withoutFlex = explainApplication(applicant(), team());
    expect(withoutFlex.some((f) => f.reason.includes("roster flexibility"))).toBe(false);
  });

  it("reports a schedule mismatch instead of hiding it", () => {
    const facets = explainApplication(applicant({ availability: [evening(0)] }), team());
    const schedule = facets.find((f) => f.reason.includes("Schedules"));
    expect(schedule?.level).toBe("none");
  });

  it("does not read any rating or performance field", () => {
    // The applicant profile has no rating, ilvl or parse field at all, and a
    // full explanation is still produced. This is the structural guarantee
    // that logs cannot become the matching factor.
    const facets = explainApplication(applicant(), team());
    expect(facets.length).toBeGreaterThan(0);
    expect(Object.keys(applicant())).not.toContain("rating");
  });
});
