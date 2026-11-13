import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../netlify/functions/lib/db/schema";

const local = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle<typeof schema>> | undefined }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => local.db! }));
vi.mock("../../netlify/functions/lib/db/transaction", () => ({
  withTransaction: (work: Parameters<NonNullable<typeof local.db>["transaction"]>[0]) => local.db!.transaction(work),
}));
import { deleteParticipantService } from "../../netlify/functions/lib/services/participantService";

const pg = new PGlite();
const db = drizzle(pg, { schema });
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`;
const eventId = uuid(1), otherEventId = uuid(2), actorId = uuid(3), userId = uuid(4), institutionId = uuid(5);
const profileId = uuid(6), memberProfileId = uuid(7), invitationId = uuid(8), participantId = uuid(9), memberId = uuid(10);
const otherParticipantId = uuid(11), templateId = uuid(12), announcementId = uuid(13), publicGroupId = uuid(14);
const remove = (event = eventId, actor = actorId) => deleteParticipantService(event, participantId, "Pendaftaran ganda", actor, "delete-integration");

beforeAll(async () => {
  local.db = db;
  const migrations = join(process.cwd(), "drizzle");
  for (const name of readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(migrations, name), "utf8"));
  }
}, 60_000);
beforeEach(async () => {
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No external calls from deletion"); }));
  await pg.exec("truncate table events, users, roles, ustadz_profiles, institutions, email_templates cascade");
  await db.insert(schema.users).values([{ id: actorId, email: "admin@delete.invalid" }, { id: userId, email: "ustadz@delete.invalid" }]);
  await db.insert(schema.events).values([eventId, otherEventId].map((id, index) => ({ id, code: `DELETE-${index}`,
    slug: `delete-${index}`, name: "Daurah Uji Hapus", startDate: "2026-11-13", endDate: "2026-11-15", status: "REGISTRATION_OPEN" })));
  await db.insert(schema.institutions).values({ id: institutionId, code: "INST-DELETE", name: "Lembaga Uji" });
  await db.insert(schema.ustadzProfiles).values([
    { id: profileId, userId, fullName: "Ahmad Uji", normalizedName: "ahmad uji", email: "ustadz@delete.invalid" },
    { id: memberProfileId, fullName: "Hasan Uji", normalizedName: "hasan uji" },
  ]);
  await db.insert(schema.invitations).values({ id: invitationId, eventId, invitationType: "INSTITUTION", institutionId,
    invitationNumber: "UND-DELETE", quota: 3, status: "ACCEPTED" });
  await db.insert(schema.eventParticipants).values([
    { id: participantId, eventId, ustadzId: profileId, institutionId, invitationId, participantCode: "DELETE-LEAD",
      isDelegationLead: true, approvalStatus: "APPROVED", confirmationStatus: "CONFIRMED" },
    { id: memberId, eventId, ustadzId: memberProfileId, institutionId, invitationId, participantCode: "DELETE-MEMBER",
      replacementForParticipantId: participantId },
    { id: otherParticipantId, eventId: otherEventId, ustadzId: profileId, participantCode: "DELETE-OTHER" },
  ]);
  await db.insert(schema.participantStatusHistories).values({ participantId, statusType: "APPROVAL_STATUS", toStatus: "APPROVED", changedBy: actorId });
  await db.insert(schema.attendanceRecords).values({ participantId, eventId, attendanceStatus: "PRESENT", recordedBy: actorId });
  await db.insert(schema.checkinLogs).values({ participantId, eventId, method: "QR_SCAN", result: "SUCCESS", metadata: { source: "test" } });
  await db.insert(schema.eventAnnouncements).values({ id: announcementId, eventId, title: "Uji", body: "Uji pengumuman" });
  await db.insert(schema.announcementRecipients).values([{ announcementId, participantId }, { announcementId, participantId: memberId }]);
  await db.insert(schema.emailTemplates).values({ id: templateId, code: "DELETE_TEST", name: "Uji", subjectTemplate: "Uji", bodyTemplate: "Uji" });
  await db.insert(schema.emailJobs).values([
    { templateId, eventId, recipientEmail: "ustadz@delete.invalid", payload: { participantId }, status: "QUEUED", scheduledAt: new Date(), idempotencyKey: "new-queue" },
    { templateId, eventId, recipientEmail: "ustadz@delete.invalid", payload: {}, status: "FAILED", scheduledAt: new Date(), idempotencyKey: `rem_1_${eventId}_${participantId}_2026-11-13` },
    { templateId, eventId, recipientEmail: "ustadz@delete.invalid", payload: { participantId }, status: "SENT", scheduledAt: new Date(), idempotencyKey: "delivered" },
    { templateId, eventId: otherEventId, recipientEmail: "ustadz@delete.invalid", payload: { participantId: otherParticipantId }, status: "QUEUED", scheduledAt: new Date(), idempotencyKey: "other-event" },
    { templateId, eventId, recipientEmail: "member@delete.invalid", payload: { participantId: memberId }, status: "QUEUED", scheduledAt: new Date(), idempotencyKey: "other-participant" },
  ]);
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });
afterAll(async () => { await pg.close(); local.db = undefined; });

describe("event participant deletion with real foreign keys and transactions", () => {
  it("removes one registration and dependants, preserves masters/other events, and audits atomically", async () => {
    expect(await remove()).toEqual({ participantId, eventId, deleted: true, successorParticipantId: memberId });
    const participants = await db.select().from(schema.eventParticipants);
    expect(participants.map((row) => row.id).sort()).toEqual([memberId, otherParticipantId].sort());
    expect(participants.find((row) => row.id === memberId)).toMatchObject({ isDelegationLead: true, replacementForParticipantId: null });
    expect(await db.select().from(schema.attendanceRecords)).toHaveLength(0);
    expect(await db.select().from(schema.participantStatusHistories)).toHaveLength(0);
    expect(await db.select().from(schema.ustadzProfiles)).toHaveLength(2);
    expect(await db.select().from(schema.users)).toHaveLength(2);
    expect(await db.select().from(schema.institutions)).toHaveLength(1);
    expect(await db.select().from(schema.invitations)).toHaveLength(1);
    expect(await db.select().from(schema.announcementRecipients)).toMatchObject([{ participantId: memberId }]);
    expect(await db.select().from(schema.checkinLogs)).toMatchObject([{ participantId: null,
      metadata: { source: "test", deletedParticipantId: participantId, deletedParticipantCode: "DELETE-LEAD" } }]);
    const jobs = Object.fromEntries((await db.select().from(schema.emailJobs)).map((job) => [job.idempotencyKey, job.status]));
    expect(jobs["new-queue"]).toBe("CANCELLED");
    expect(jobs[`rem_1_${eventId}_${participantId}_2026-11-13`]).toBe("CANCELLED");
    expect(jobs["delivered"]).toBe("SENT"); expect(jobs["other-event"]).toBe("QUEUED"); expect(jobs["other-participant"]).toBe("QUEUED");
    expect(await db.select().from(schema.auditLogs)).toMatchObject([{ action: "PARTICIPANT_DELETED", actorUserId: actorId,
      resourceId: participantId, eventId, reason: "Pendaftaran ganda", requestId: "delete-integration",
      beforeData: { participantCode: "DELETE-LEAD" }, afterData: { deleted: true, successorParticipantId: memberId } }]);
  });

  it("refuses a participant outside the requested event and leaves all data untouched", async () => {
    await expect(remove(otherEventId)).rejects.toMatchObject({ statusCode: 404 });
    expect(await db.select().from(schema.eventParticipants)).toHaveLength(3);
    expect(await db.select().from(schema.auditLogs)).toHaveLength(0);
    expect((await db.select().from(schema.emailJobs)).find((row) => row.idempotencyKey === "new-queue")?.status).toBe("QUEUED");
  });

  it.each(["COMPLETED", "CANCELLED", "ARCHIVED"])("keeps participant data locked on a %s event", async (status) => {
    await db.update(schema.events).set({ status }).where(eq(schema.events.id, eventId));
    await expect(remove()).rejects.toMatchObject({ statusCode: 403 });
    expect(await db.select().from(schema.eventParticipants)).toHaveLength(3);
    expect(await db.select().from(schema.auditLogs)).toHaveLength(0);
  });

  it("promotes a remaining public-group member without granting leadership to unrelated registrations", async () => {
    await db.update(schema.eventParticipants).set({ invitationId: null, institutionId: null, publicGroupId })
      .where(eq(schema.eventParticipants.eventId, eventId));
    expect((await remove()).successorParticipantId).toBe(memberId);
    expect((await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, memberId)))[0].isDelegationLead).toBe(true);
  });

  it("does not give delegation access to a member with legacy cancelled approval", async () => {
    await db.update(schema.eventParticipants).set({ approvalStatus: "CANCELLED" }).where(eq(schema.eventParticipants.id, memberId));
    expect((await remove()).successorParticipantId).toBeNull();
    expect((await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, memberId)))[0].isDelegationLead).toBe(false);
  });

  it("rolls back cleanup and successor promotion if the audit cannot be written", async () => {
    await expect(remove(eventId, uuid(999))).rejects.toThrow();
    expect(await db.select().from(schema.eventParticipants)).toHaveLength(3);
    expect((await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, memberId)))[0])
      .toMatchObject({ isDelegationLead: false, replacementForParticipantId: participantId });
    expect(await db.select().from(schema.attendanceRecords)).toHaveLength(1);
    expect(await db.select().from(schema.announcementRecipients)).toHaveLength(2);
    expect((await db.select().from(schema.checkinLogs))[0].participantId).toBe(participantId);
    expect((await db.select().from(schema.emailJobs)).find((row) => row.idempotencyKey === "new-queue")?.status).toBe("QUEUED");
    expect(await db.select().from(schema.auditLogs)).toHaveLength(0);
  });
});
