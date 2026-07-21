import { describe, it, expect } from "vitest";
import {
  APPLICATION_TTL_DAYS,
  canActorTransition,
  canTransition,
  effectiveStatus,
  isActive,
  isTerminal,
  nextStatuses,
  shouldExpire,
  statusesFor,
  GUILD_STATUSES,
  MPLUS_STATUSES,
  STATUS_LABEL,
} from "./applicationStatus";

describe("status vocabularies", () => {
  it("gives M+ its own funnel", () => {
    expect(MPLUS_STATUSES).toContain("shortlisted");
    expect(MPLUS_STATUSES).not.toContain("interview_requested");
  });

  it("gives guilds theirs", () => {
    expect(GUILD_STATUSES).toContain("interview_requested");
    expect(GUILD_STATUSES).toContain("under_review");
    expect(GUILD_STATUSES).not.toContain("shortlisted");
  });

  it("labels every status in both vocabularies", () => {
    for (const s of [...MPLUS_STATUSES, ...GUILD_STATUSES]) {
      expect(STATUS_LABEL[s]).toBeTruthy();
    }
  });

  it("selects the vocabulary by recruitment type", () => {
    expect(statusesFor("guild")).toBe(GUILD_STATUSES);
    expect(statusesFor("mplus")).toBe(MPLUS_STATUSES);
  });
});

describe("isTerminal", () => {
  it("treats every end state as terminal", () => {
    for (const s of ["accepted", "declined", "withdrawn", "expired"]) {
      expect(isTerminal(s)).toBe(true);
      expect(isActive(s)).toBe(false);
    }
  });

  it("treats in-flight states as active", () => {
    for (const s of ["pending", "shortlisted", "trial_offered", "under_review"]) {
      expect(isActive(s)).toBe(true);
    }
  });
});

describe("canTransition", () => {
  it("allows the normal M+ funnel", () => {
    expect(canTransition("pending", "shortlisted", "mplus")).toBe(true);
    expect(canTransition("shortlisted", "trial_offered", "mplus")).toBe(true);
    expect(canTransition("trial_offered", "trial_accepted", "mplus")).toBe(true);
    expect(canTransition("trial_accepted", "accepted", "mplus")).toBe(true);
  });

  it("allows the normal guild funnel", () => {
    expect(canTransition("pending", "under_review", "guild")).toBe(true);
    expect(canTransition("under_review", "interview_requested", "guild")).toBe(true);
    expect(canTransition("interview_requested", "trial_offered", "guild")).toBe(true);
    expect(canTransition("trial_offered", "trial_active", "guild")).toBe(true);
    expect(canTransition("trial_active", "accepted", "guild")).toBe(true);
  });

  it("lets a recruiter decline from any live state", () => {
    for (const from of ["pending", "shortlisted", "trial_offered", "trial_accepted"]) {
      expect(canTransition(from, "declined", "mplus")).toBe(true);
    }
  });

  it("lets an applicant withdraw from any live state", () => {
    for (const from of ["pending", "shortlisted", "trial_offered"]) {
      expect(canTransition(from, "withdrawn", "mplus")).toBe(true);
    }
  });

  it("never transitions out of a terminal state", () => {
    for (const from of ["accepted", "declined", "withdrawn", "expired"]) {
      expect(canTransition(from, "pending", "mplus")).toBe(false);
      expect(canTransition(from, "accepted", "mplus")).toBe(false);
    }
  });

  it("rejects a no-op", () => {
    expect(canTransition("pending", "pending", "mplus")).toBe(false);
  });

  it("rejects a status from the other recruitment type", () => {
    expect(canTransition("pending", "interview_requested", "mplus")).toBe(false);
    expect(canTransition("pending", "shortlisted", "guild")).toBe(false);
  });

  it("rejects going backwards up the funnel", () => {
    expect(canTransition("trial_offered", "shortlisted", "mplus")).toBe(false);
    expect(canTransition("shortlisted", "pending", "mplus")).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(canTransition("pending", "banana", "mplus")).toBe(false);
    expect(canTransition("banana", "accepted", "mplus")).toBe(false);
  });

  it("never lets anything transition INTO expired, since only the system expires", () => {
    for (const from of ["pending", "shortlisted", "trial_offered"]) {
      expect(canTransition(from, "expired", "mplus")).toBe(false);
    }
  });
});

describe("canActorTransition", () => {
  it("lets a recruiter accept, but never the applicant", () => {
    expect(canActorTransition("pending", "accepted", "mplus", "recruiter")).toBe(true);
    expect(canActorTransition("pending", "accepted", "mplus", "applicant")).toBe(false);
  });

  it("lets an applicant withdraw, but never the recruiter", () => {
    expect(canActorTransition("pending", "withdrawn", "mplus", "applicant")).toBe(true);
    expect(canActorTransition("pending", "withdrawn", "mplus", "recruiter")).toBe(false);
  });

  it("lets a recruiter decline, but never the applicant", () => {
    expect(canActorTransition("pending", "declined", "mplus", "recruiter")).toBe(true);
    expect(canActorTransition("pending", "declined", "mplus", "applicant")).toBe(false);
  });

  it("lets only the applicant accept a trial that was offered to them", () => {
    expect(canActorTransition("trial_offered", "trial_accepted", "mplus", "applicant")).toBe(true);
    expect(canActorTransition("trial_offered", "trial_accepted", "mplus", "recruiter")).toBe(false);
  });

  it("lets only the recruiter shortlist", () => {
    expect(canActorTransition("pending", "shortlisted", "mplus", "recruiter")).toBe(true);
    expect(canActorTransition("pending", "shortlisted", "mplus", "applicant")).toBe(false);
  });

  it("still refuses an illegal transition even for the right actor", () => {
    expect(canActorTransition("accepted", "declined", "mplus", "recruiter")).toBe(false);
  });
});

describe("nextStatuses", () => {
  it("offers a recruiter their real options and nothing else", () => {
    const next = nextStatuses("pending", "mplus", "recruiter");
    expect(next).toEqual(expect.arrayContaining(["shortlisted", "trial_offered", "accepted", "declined"]));
    expect(next).not.toContain("withdrawn");
  });

  it("offers an applicant only withdraw while pending", () => {
    expect(nextStatuses("pending", "mplus", "applicant")).toEqual(["withdrawn"]);
  });

  it("offers an applicant the trial acceptance once it is on the table", () => {
    expect(nextStatuses("trial_offered", "mplus", "applicant")).toEqual(
      expect.arrayContaining(["trial_accepted", "withdrawn"])
    );
  });

  it("offers nothing from a terminal state", () => {
    expect(nextStatuses("accepted", "mplus", "recruiter")).toEqual([]);
    expect(nextStatuses("withdrawn", "mplus", "applicant")).toEqual([]);
  });

  it("only ever offers transitions the server would accept", () => {
    // Guards the UI contract: every button nextStatuses renders must pass
    // canActorTransition, or the user gets a rejection they could not predict.
    for (const type of ["mplus", "guild"]) {
      for (const from of statusesFor(type)) {
        for (const actor of ["applicant", "recruiter"] as const) {
          for (const to of nextStatuses(from, type, actor)) {
            expect(canActorTransition(from, to, type, actor)).toBe(true);
          }
        }
      }
    }
  });
});

describe("expiry", () => {
  const NOW = new Date("2026-07-20T12:00:00Z");
  const daysAgo = (n: number) => new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

  it("uses a 30 day window", () => {
    expect(APPLICATION_TTL_DAYS).toBe(30);
  });

  it("does not expire a fresh application", () => {
    expect(shouldExpire({ status: "pending", updatedAt: daysAgo(5) }, NOW)).toBe(false);
  });

  it("expires a stale one", () => {
    expect(shouldExpire({ status: "pending", updatedAt: daysAgo(31) }, NOW)).toBe(true);
  });

  it("never expires a settled application, however old", () => {
    for (const status of ["accepted", "declined", "withdrawn"]) {
      expect(shouldExpire({ status, updatedAt: daysAgo(400) }, NOW)).toBe(false);
    }
  });

  it("resets when the application is acted on", () => {
    // Shortlisting an old application moves updatedAt, so it stops being stale.
    expect(shouldExpire({ status: "shortlisted", updatedAt: daysAgo(1) }, NOW)).toBe(false);
  });

  it("reads a stale application as expired without a write", () => {
    expect(effectiveStatus({ status: "pending", updatedAt: daysAgo(45) }, NOW)).toBe("expired");
  });

  it("leaves a live application's status alone", () => {
    expect(effectiveStatus({ status: "shortlisted", updatedAt: daysAgo(2) }, NOW)).toBe("shortlisted");
  });

  it("leaves an accepted application accepted forever", () => {
    expect(effectiveStatus({ status: "accepted", updatedAt: daysAgo(400) }, NOW)).toBe("accepted");
  });

  it("accepts a Date as well as an ISO string", () => {
    expect(shouldExpire({ status: "pending", updatedAt: new Date(daysAgo(31)) }, NOW)).toBe(true);
  });
});
