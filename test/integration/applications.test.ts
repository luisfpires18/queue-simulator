import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createApplication,
  getMyApplication,
  listApplicationsForTarget,
  listMyApplications,
  setApplicationStatus,
  setRecruiterNote,
  withdrawApplication,
} from "@/data/recruitmentApplications";
import { blockUser } from "@/data/moderation";
import { deleteMPlusPost } from "@/data/mplusRecruitment";
import { deleteGuild } from "@/data/guilds";
import {
  applyInput,
  makeApplyScenario,
  makeCharacter,
  makeGuildTeam,
  makeMPlusPost,
  makeUser,
} from "./fixtures";

describe("createApplication", () => {
  it("creates a pending application", async () => {
    const { applicant, post, character } = await makeApplyScenario();

    const res = await createApplication(applicant.id, applyInput(post, character.id));
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.application.status).toBe("pending");
    expect(res.application.characterId).toBe(character.id);
  });

  it("refreshes an existing live application instead of duplicating it", async () => {
    const { applicant, post, character } = await makeApplyScenario();
    const second = await makeCharacter(applicant.id, { name: "Second" });

    const first = await createApplication(applicant.id, applyInput(post, character.id));
    const again = await createApplication(applicant.id, {
      ...applyInput(post, second.id),
      note: "updated",
    });

    expect(first.ok && again.ok).toBe(true);
    if (!first.ok || !again.ok) return;

    // Same row, new content - not a second pending application.
    expect(again.application.id).toBe(first.application.id);
    expect(again.application.characterId).toBe(second.id);
    expect(again.application.note).toBe("updated");

    const count = await prisma.recruitmentApplication.count({ where: { targetId: post.id } });
    expect(count).toBe(1);
  });

  it("keeps one row when two applies race", async () => {
    // The reason createApplication is transaction-wrapped: without it the
    // find-then-create window lets both calls insert.
    const { applicant, post, character } = await makeApplyScenario();

    await Promise.all([
      createApplication(applicant.id, applyInput(post, character.id)),
      createApplication(applicant.id, applyInput(post, character.id)),
    ]);

    const count = await prisma.recruitmentApplication.count({ where: { targetId: post.id } });
    expect(count).toBe(1);
  });

  it("lets a settled application be followed by a fresh one", async () => {
    const { owner, applicant, post, character } = await makeApplyScenario();

    const first = await createApplication(applicant.id, applyInput(post, character.id));
    if (!first.ok) throw new Error("setup failed");
    await setApplicationStatus(first.application.id, owner.id, "declined");

    const second = await createApplication(applicant.id, applyInput(post, character.id));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.application.id).not.toBe(first.application.id);

    // The decline stays as history rather than being revived.
    const count = await prisma.recruitmentApplication.count({ where: { targetId: post.id } });
    expect(count).toBe(2);
  });

  it("refuses an application to your own listing", async () => {
    const owner = await makeUser("owner");
    const post = await makeMPlusPost(owner.id);
    const character = await makeCharacter(owner.id);

    const res = await createApplication(owner.id, applyInput(post, character.id));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("own_post");
  });

  it("refuses a character the applicant does not own", async () => {
    const { applicant, post } = await makeApplyScenario();
    const stranger = await makeUser("stranger");
    const notMine = await makeCharacter(stranger.id);

    const res = await createApplication(applicant.id, applyInput(post, notMine.id));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("character_not_owned");
  });

  it("refuses a closed listing", async () => {
    const owner = await makeUser("owner");
    const applicant = await makeUser("applicant");
    const post = await makeMPlusPost(owner.id, { status: "paused" });
    const character = await makeCharacter(applicant.id);

    const res = await createApplication(applicant.id, applyInput(post, character.id));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("target_closed");
  });

  it("refuses an expired listing", async () => {
    const owner = await makeUser("owner");
    const applicant = await makeUser("applicant");
    const post = await makeMPlusPost(owner.id, { expiresAt: new Date(Date.now() - 1000) });
    const character = await makeCharacter(applicant.id);

    const res = await createApplication(applicant.id, applyInput(post, character.id));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("target_closed");
  });

  it("refuses a listing that no longer exists", async () => {
    const applicant = await makeUser("applicant");
    const character = await makeCharacter(applicant.id);

    const res = await createApplication(applicant.id, {
      recruitmentType: "mplus",
      targetId: "does-not-exist",
      characterId: character.id,
      specId: "paladin:holy",
      role: "HEALER",
    });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("target_not_found");
  });
});

describe("blocking", () => {
  it("stops an applicant the owner has blocked", async () => {
    const { owner, applicant, post, character } = await makeApplyScenario();
    await blockUser(owner.id, applicant.id);

    const res = await createApplication(applicant.id, applyInput(post, character.id));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("blocked");
  });

  it("stops an applicant who blocked the owner", async () => {
    // The block is symmetric: blocking someone must not still let their
    // applications reach you.
    const { owner, applicant, post, character } = await makeApplyScenario();
    await blockUser(applicant.id, owner.id);

    const res = await createApplication(applicant.id, applyInput(post, character.id));
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("blocked");
  });

  it("lets an application through once the block is lifted", async () => {
    const { owner, applicant, post, character } = await makeApplyScenario();
    await blockUser(owner.id, applicant.id);
    await prisma.userBlock.deleteMany({ where: { blockerUserId: owner.id } });

    const res = await createApplication(applicant.id, applyInput(post, character.id));
    expect(res.ok).toBe(true);
  });
});

describe("status transitions", () => {
  async function scenario() {
    const s = await makeApplyScenario();
    const res = await createApplication(s.applicant.id, applyInput(s.post, s.character.id));
    if (!res.ok) throw new Error("setup failed");
    return { ...s, application: res.application };
  }

  it("lets the recruiter shortlist", async () => {
    const { owner, application } = await scenario();
    const res = await setApplicationStatus(application.id, owner.id, "shortlisted");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.application.status).toBe("shortlisted");
  });

  it("refuses a status change from an unrelated user", async () => {
    const { application } = await scenario();
    const stranger = await makeUser("stranger");

    const res = await setApplicationStatus(application.id, stranger.id, "accepted");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("not_authorized");
  });

  it("refuses to let an applicant accept themselves", async () => {
    const { applicant, application } = await scenario();
    const res = await setApplicationStatus(application.id, applicant.id, "accepted");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("illegal_transition");
  });

  it("refuses to let a recruiter withdraw on the applicant's behalf", async () => {
    const { owner, application } = await scenario();
    const res = await setApplicationStatus(application.id, owner.id, "withdrawn");
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.reason).toBe("illegal_transition");
  });

  it("lets the applicant withdraw", async () => {
    const { applicant, application } = await scenario();
    const res = await withdrawApplication(application.id, applicant.id);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.application.status).toBe("withdrawn");
  });

  it("refuses a second transition out of a terminal state", async () => {
    const { owner, application } = await scenario();
    await setApplicationStatus(application.id, owner.id, "declined");

    const again = await setApplicationStatus(application.id, owner.id, "accepted");
    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.reason).toBe("illegal_transition");
  });
});

describe("accepting", () => {
  it("puts the applicant on the roster and fills the position", async () => {
    const { owner, applicant, post, character } = await makeApplyScenario();
    const applied = await createApplication(applicant.id, applyInput(post, character.id));
    if (!applied.ok) throw new Error("setup failed");

    const res = await setApplicationStatus(applied.application.id, owner.id, "accepted");
    expect(res.ok).toBe(true);

    const roster = await prisma.mPlusRecruitmentCharacter.findMany({ where: { postId: post.id } });
    expect(roster).toHaveLength(1);
    expect(roster[0].characterId).toBe(character.id);
    expect(roster[0].isCurrentMember).toBe(true);
    expect(roster[0].teamRole).toBe("member");

    const position = await prisma.mPlusRecruitmentPosition.findUnique({
      where: { id: post.positions[0].id },
    });
    expect(position?.isFilled).toBe(true);
  });

  it("auto-closes the post once the last position is filled", async () => {
    const { owner, applicant, post, character } = await makeApplyScenario();
    const applied = await createApplication(applicant.id, applyInput(post, character.id));
    if (!applied.ok) throw new Error("setup failed");

    const res = await setApplicationStatus(applied.application.id, owner.id, "accepted");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.autoClosed).toBe(true);

    const updated = await prisma.mPlusRecruitmentPost.findUnique({ where: { id: post.id } });
    expect(updated?.status).toBe("filled");
  });

  it("leaves the post open while another position is still unfilled", async () => {
    const { owner, applicant, post, character } = await makeApplyScenario({ positionCount: 2 });
    const applied = await createApplication(applicant.id, applyInput(post, character.id));
    if (!applied.ok) throw new Error("setup failed");

    const res = await setApplicationStatus(applied.application.id, owner.id, "accepted");
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.autoClosed).toBe(false);

    const updated = await prisma.mPlusRecruitmentPost.findUnique({ where: { id: post.id } });
    expect(updated?.status).toBe("open");
  });

  it("fills a guild position without touching an M+ roster", async () => {
    const owner = await makeUser("owner");
    const applicant = await makeUser("applicant");
    const { team } = await makeGuildTeam(owner.id);
    const character = await makeCharacter(applicant.id);

    const applied = await createApplication(applicant.id, {
      recruitmentType: "guild",
      targetId: team.id,
      positionId: team.positions[0].id,
      characterId: character.id,
      specId: "paladin:retribution",
      role: "DPS",
    });
    if (!applied.ok) throw new Error("setup failed");

    const res = await setApplicationStatus(applied.application.id, owner.id, "accepted");
    expect(res.ok).toBe(true);

    const position = await prisma.raidRecruitmentPosition.findUnique({
      where: { id: team.positions[0].id },
    });
    expect(position?.isFilled).toBe(true);
    expect(await prisma.mPlusRecruitmentCharacter.count()).toBe(0);
  });
});

describe("privacy", () => {
  it("hides the recruiter note from the applicant", async () => {
    const { owner, applicant, post, character } = await makeApplyScenario();
    const applied = await createApplication(applicant.id, applyInput(post, character.id));
    if (!applied.ok) throw new Error("setup failed");

    await setRecruiterNote(applied.application.id, owner.id, "Strong on paper, check attendance");

    const mine = await listMyApplications(applicant.id);
    expect(mine).toHaveLength(1);
    expect(mine[0].recruiterNote).toBeUndefined();

    const theirs = await listApplicationsForTarget("mplus", post.id, owner.id);
    expect(theirs[0].recruiterNote).toBe("Strong on paper, check attendance");
  });

  it("refuses to let a non-owner write a recruiter note", async () => {
    const { applicant, post, character } = await makeApplyScenario();
    const applied = await createApplication(applicant.id, applyInput(post, character.id));
    if (!applied.ok) throw new Error("setup failed");

    expect(await setRecruiterNote(applied.application.id, applicant.id, "sneaky")).toBe(false);
  });

  it("returns nothing when a non-owner asks for a listing's applications", async () => {
    const { applicant, post, character } = await makeApplyScenario();
    await createApplication(applicant.id, applyInput(post, character.id));

    const stranger = await makeUser("stranger");
    expect(await listApplicationsForTarget("mplus", post.id, stranger.id)).toEqual([]);
    // Even the applicant cannot read the recruiter's queue.
    expect(await listApplicationsForTarget("mplus", post.id, applicant.id)).toEqual([]);
  });

  it("exposes the applicant's own application back to them", async () => {
    const { applicant, post, character } = await makeApplyScenario();
    await createApplication(applicant.id, applyInput(post, character.id));

    const mine = await getMyApplication("mplus", post.id, applicant.id);
    expect(mine?.status).toBe("pending");
  });
});

describe("cascade cleanup", () => {
  it("removes applications when the post is deleted", async () => {
    // targetId has no foreign key (it addresses two tables), so this cleanup
    // is manual and would silently rot if it regressed.
    const { applicant, post, character } = await makeApplyScenario();
    await createApplication(applicant.id, applyInput(post, character.id));

    await deleteMPlusPost(post.id);
    expect(await prisma.recruitmentApplication.count({ where: { targetId: post.id } })).toBe(0);
  });

  it("removes applications for every team when a guild is deleted", async () => {
    const owner = await makeUser("owner");
    const applicant = await makeUser("applicant");
    const { guild, team } = await makeGuildTeam(owner.id);
    const character = await makeCharacter(applicant.id);

    await createApplication(applicant.id, {
      recruitmentType: "guild",
      targetId: team.id,
      characterId: character.id,
      specId: "paladin:retribution",
      role: "DPS",
    });

    await deleteGuild(guild.id);
    expect(await prisma.recruitmentApplication.count({ where: { targetId: team.id } })).toBe(0);
  });
});
