import { describe, it, expect, vi, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { makeApplyScenario, makeCharacter, makeMPlusPost, makeUser, applyInput } from "./fixtures";

// The real sendPush needs VAPID keys and a live push service. Mocking at this
// seam - the last step before the network - exercises everything that actually
// contains logic: preference lookup, the default-on rule, recipient
// resolution, message construction, and dead-subscription pruning. Only the
// HTTP call itself is stubbed.
const sent: { endpoint: string; message: { title: string; body: string; url: string } }[] = [];
let deadEndpoints = new Set<string>();

vi.mock("@/server/notifications/webpush", () => ({
  sendPush: vi.fn(async (sub: { endpoint: string }, message: any) => {
    sent.push({ endpoint: sub.endpoint, message });
    return { dead: deadEndpoints.has(sub.endpoint) };
  }),
}));

const { notifyUser, notifyUserTyped } = await import("@/server/notifications/dispatch");
const { notifyApplicationReceived, notifyApplicationStatus } = await import(
  "@/server/notifications/recruitment"
);

beforeEach(() => {
  sent.length = 0;
  deadEndpoints = new Set();
});

async function giveSubscription(userId: string, endpoint = `https://push.test/${userId}`) {
  return prisma.pushSubscription.create({
    data: { userId, endpoint, p256dh: "test-p256dh", auth: "test-auth" },
  });
}

async function setPreference(userId: string, settings: Record<string, unknown>, enabled = true) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    create: { userId, enabled, settings: JSON.stringify(settings) },
    update: { enabled, settings: JSON.stringify(settings) },
  });
}

describe("notifyUser", () => {
  it("sends to every subscription the user has", async () => {
    const user = await makeUser("u");
    await giveSubscription(user.id, "https://push.test/a");
    await giveSubscription(user.id, "https://push.test/b");

    await notifyUser(user.id, { title: "T", body: "B", url: "/x" });

    expect(sent.map((s) => s.endpoint).sort()).toEqual(["https://push.test/a", "https://push.test/b"]);
  });

  it("is a silent no-op when the user has no subscription", async () => {
    const user = await makeUser("u");
    await expect(notifyUser(user.id, { title: "T", body: "B", url: "/x" })).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });

  it("prunes a subscription the push service reports as gone", async () => {
    const user = await makeUser("u");
    await giveSubscription(user.id, "https://push.test/dead");
    deadEndpoints.add("https://push.test/dead");

    await notifyUser(user.id, { title: "T", body: "B", url: "/x" });

    expect(await prisma.pushSubscription.count({ where: { userId: user.id } })).toBe(0);
  });
});

describe("notifyUserTyped", () => {
  it("sends when the user has never touched their preferences", async () => {
    // The default-on rule: these fire because of something the recipient is
    // already part of, so an absent preference row must not silence them.
    const user = await makeUser("u");
    await giveSubscription(user.id);

    await notifyUserTyped(user.id, "recruitment_application_status", {
      title: "T",
      body: "B",
      url: "/x",
    });
    expect(sent).toHaveLength(1);
  });

  it("sends when the type is explicitly enabled", async () => {
    const user = await makeUser("u");
    await giveSubscription(user.id);
    await setPreference(user.id, { recruitment_application_status: { enabled: true } });

    await notifyUserTyped(user.id, "recruitment_application_status", { title: "T", body: "B", url: "/x" });
    expect(sent).toHaveLength(1);
  });

  it("stays silent when the user opted out of that type", async () => {
    const user = await makeUser("u");
    await giveSubscription(user.id);
    await setPreference(user.id, { recruitment_application_status: { enabled: false } });

    await notifyUserTyped(user.id, "recruitment_application_status", { title: "T", body: "B", url: "/x" });
    expect(sent).toHaveLength(0);
  });

  it("opts out of one type without silencing the others", async () => {
    const user = await makeUser("u");
    await giveSubscription(user.id);
    await setPreference(user.id, { recruitment_application_status: { enabled: false } });

    await notifyUserTyped(user.id, "recruitment_trial_offered", { title: "T", body: "B", url: "/x" });
    expect(sent).toHaveLength(1);
  });

  it("rejects an unknown type rather than silently dropping it", async () => {
    const user = await makeUser("u");
    await expect(
      notifyUserTyped(user.id, "not_a_real_type", { title: "T", body: "B", url: "/x" })
    ).rejects.toThrow(/Unknown notification type/);
  });

  it("survives a malformed settings blob by falling back to the default", async () => {
    const user = await makeUser("u");
    await giveSubscription(user.id);
    await prisma.notificationPreference.create({
      data: { userId: user.id, enabled: true, settings: "{not json" },
    });

    await notifyUserTyped(user.id, "recruitment_application_status", { title: "T", body: "B", url: "/x" });
    expect(sent).toHaveLength(1);
  });
});

describe("recruitment triggers", () => {
  it("tells the listing owner when someone applies, naming the character", async () => {
    const { owner, applicant, post, character } = await makeApplyScenario();
    await giveSubscription(owner.id);

    const { createApplication } = await import("@/data/recruitmentApplications");
    const res = await createApplication(applicant.id, applyInput(post, character.id));
    if (!res.ok) throw new Error("setup failed");

    await notifyApplicationReceived(res.application);

    expect(sent).toHaveLength(1);
    expect(sent[0].message.title).toBe("New application");
    expect(sent[0].message.body).toContain(character.name);
  });

  it("does not notify the applicant about their own application", async () => {
    const { owner, applicant, post, character } = await makeApplyScenario();
    // Only the APPLICANT has a subscription, so any push here would be going
    // to the wrong person.
    await giveSubscription(applicant.id);
    void owner;

    const { createApplication } = await import("@/data/recruitmentApplications");
    const res = await createApplication(applicant.id, applyInput(post, character.id));
    if (!res.ok) throw new Error("setup failed");

    await notifyApplicationReceived(res.application);
    expect(sent).toHaveLength(0);
  });

  it("tells the applicant when their application moves", async () => {
    const { applicant, post, character } = await makeApplyScenario();
    await giveSubscription(applicant.id);

    const { createApplication } = await import("@/data/recruitmentApplications");
    const res = await createApplication(applicant.id, applyInput(post, character.id));
    if (!res.ok) throw new Error("setup failed");

    await notifyApplicationStatus({ ...res.application, status: "accepted" });

    expect(sent).toHaveLength(1);
    expect(sent[0].message.title).toBe("Application accepted");
  });

  it("uses distinct wording for a trial offer, which needs an action", async () => {
    const { applicant, post, character } = await makeApplyScenario();
    await giveSubscription(applicant.id);

    const { createApplication } = await import("@/data/recruitmentApplications");
    const res = await createApplication(applicant.id, applyInput(post, character.id));
    if (!res.ok) throw new Error("setup failed");

    await notifyApplicationStatus({ ...res.application, status: "trial_offered" });

    expect(sent[0].message.title).toBe("Trial offered");
    expect(sent[0].message.body).toContain("Accept it to continue");
  });

  it("stays quiet when the applicant withdrew - they already know", async () => {
    const { applicant, post, character } = await makeApplyScenario();
    await giveSubscription(applicant.id);

    const { createApplication } = await import("@/data/recruitmentApplications");
    const res = await createApplication(applicant.id, applyInput(post, character.id));
    if (!res.ok) throw new Error("setup failed");

    await notifyApplicationStatus({ ...res.application, status: "withdrawn" });
    expect(sent).toHaveLength(0);
  });

  it("honours the applicant's opt-out on a status change", async () => {
    const { applicant, post, character } = await makeApplyScenario();
    await giveSubscription(applicant.id);
    await setPreference(applicant.id, { recruitment_application_status: { enabled: false } });

    const { createApplication } = await import("@/data/recruitmentApplications");
    const res = await createApplication(applicant.id, applyInput(post, character.id));
    if (!res.ok) throw new Error("setup failed");

    await notifyApplicationStatus({ ...res.application, status: "accepted" });
    expect(sent).toHaveLength(0);
  });

  it("does nothing when the listing has since been deleted", async () => {
    const { owner, applicant, post, character } = await makeApplyScenario();
    await giveSubscription(owner.id);

    const { createApplication } = await import("@/data/recruitmentApplications");
    const res = await createApplication(applicant.id, applyInput(post, character.id));
    if (!res.ok) throw new Error("setup failed");

    await prisma.recruitmentApplication.deleteMany({ where: { targetId: post.id } });
    await prisma.mPlusRecruitmentPost.delete({ where: { id: post.id } });

    await expect(notifyApplicationReceived(res.application)).resolves.toBeUndefined();
    expect(sent).toHaveLength(0);
  });
});
