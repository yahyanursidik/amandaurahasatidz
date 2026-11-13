import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../netlify/functions/lib/db/schema";
import { handler } from "../../netlify/functions/api";
import { createSessionToken } from "../../netlify/functions/lib/services/authService";
import { processEventParticipantImportDryRunService } from "../../netlify/functions/lib/services/importService";

const local = vi.hoisted(() => ({
  db: undefined as ReturnType<typeof drizzle<typeof schema>> | undefined,
  approvedEmail: vi.fn(async () => 1),
  receivedEmail: vi.fn(async () => 1),
}));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => local.db }));
vi.mock("../../netlify/functions/lib/db/transaction", () => ({
  withTransaction: (work: Parameters<NonNullable<typeof local.db>["transaction"]>[0]) => local.db!.transaction(work),
}));
vi.mock(import("../../netlify/functions/lib/services/participantCardEmailService"), async (original) => ({
  ...await original(), queueApprovedParticipantCardEmail: local.approvedEmail, queueRegistrationReceivedEmails: local.receivedEmail,
}));
vi.mock(import("../../netlify/functions/lib/utils/logger"), async (original) => ({ ...await original(), logInfo: vi.fn(), logError: vi.fn() }));

const pg = new PGlite();
const db = drizzle(pg, { schema });
const activeEvent = "00000000-0000-4000-8000-000000000031";
const foreignEvent = "00000000-0000-4000-8000-000000000032";
const oldParticipant = "00000000-0000-4000-8000-000000000033";
const existingProfile = "00000000-0000-4000-8000-000000000034";
const institutionId = "00000000-0000-4000-8000-000000000035";
const admin = "admin@import.invalid";
const representative = "representative@import.invalid";
const viewer = "viewer@import.invalid";
const origin = "https://import.invalid";
const oldDate = new Date("2026-11-11T01:00:00.000Z");
const existingRow = { fullName: "Ahmad Uji", email: "ahmad@import.invalid" };

async function request(kind: "preview" | "commit", rows: Record<string, unknown>[], user?: string,
  eventId = activeEvent, approved = true) {
  const path = `/api/v1/events/${eventId}/participants/import/${kind}`;
  const event: HandlerEvent = {
    path, rawUrl: `${origin}${path}`, rawQuery: "", httpMethod: "POST",
    headers: { origin, host: "import.invalid", "sec-fetch-site": "same-origin", "client-ip": "192.0.2.31",
      ...(user ? { authorization: `Bearer ${createSessionToken(user).sessionId}` } : {}) },
    queryStringParameters: {}, multiValueHeaders: {}, multiValueQueryStringParameters: null, isBase64Encoded: false,
    body: JSON.stringify({ rows, ...(kind === "commit" ? { approved } : {}) }),
  };
  const response = await handler(event, {} as HandlerContext, vi.fn());
  if (!response?.body) throw new Error("No response");
  return { status: response.statusCode, headers: response.headers, ...JSON.parse(response.body) };
}

beforeAll(async () => {
  local.db = db;
  const migrations = join(process.cwd(), "drizzle");
  for (const name of readdirSync(migrations).filter((name) => name.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(migrations, name), "utf8"));
  }
}, 60_000);

beforeEach(async () => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("APP_URL", origin);
  vi.stubEnv("SESSION_SECRET", "test-only-import-session");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-13T01:00:00.000Z"));
  local.approvedEmail.mockClear();
  local.receivedEmail.mockClear();
  await pg.exec("truncate table events, users, roles, ustadz_profiles, institutions, email_templates cascade");
  const [eventAdmin, institutionRep, reader] = await db.insert(schema.users).values([admin, representative, viewer]
    .map((email) => ({ email, status: "ACTIVE" }))).returning();
  const [adminRole, representativeRole, readerRole] = await db.insert(schema.roles).values([
    { code: "EVENT_ADMIN", name: "Admin Event" }, { code: "INSTITUTION_REPRESENTATIVE", name: "Wakil lembaga" },
    { code: "REPORT_VIEWER", name: "Pembaca laporan" },
  ]).returning();
  await db.insert(schema.events).values([activeEvent, foreignEvent].map((id, index) => ({
    id, slug: `daurah-impor-${index}`, code: `TEST-IMPOR-${index}`, name: "Daurah Uji Impor", timezone: "Asia/Jakarta",
    startDate: "2026-11-13", endDate: "2026-11-15", status: "REGISTRATION_OPEN", audienceMode: "MIXED",
    attendanceConfirmationRequired: true, capacity: 20, regularQuota: 10, invitationQuota: 10,
  })));
  await db.insert(schema.institutions).values({ id: institutionId, code: "INST-UJI", name: "Lembaga Uji", status: "ACTIVE" });
  await db.insert(schema.userRoleAssignments).values([
    { userId: eventAdmin.id, roleId: adminRole.id, eventId: activeEvent },
    { userId: institutionRep.id, roleId: representativeRole.id, institutionId },
    { userId: reader.id, roleId: readerRole.id },
  ]);
  await db.insert(schema.ustadzProfiles).values({ id: existingProfile, fullName: existingRow.fullName, normalizedName: "ahmad uji",
    email: existingRow.email, profileStatus: "ACTIVE" });
  await db.insert(schema.eventParticipants).values([
    { id: oldParticipant, eventId: activeEvent, ustadzId: existingProfile, participantCode: "UJI-1", approvalStatus: "PENDING_REVIEW",
      confirmationStatus: "INVITED", registrationSource: "DIRECT_PUBLIC", updatedAt: oldDate },
    { eventId: foreignEvent, ustadzId: existingProfile, participantCode: "UJI-2", approvalStatus: "APPROVED",
      confirmationStatus: "CONFIRMED", registrationSource: "DIRECT_PUBLIC", updatedAt: oldDate },
  ]);
}, 30_000);

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
afterAll(async () => { await pg.close(); local.db = undefined; });

describe("event CSV imports respect staff scope, moderation and personal confirmation", () => {
  it("does not let anonymous users, readers, or institution representatives preview or approve someone else's registration", async () => {
    const row = { ...existingRow, approvalStatus: " approved " };
    for (const kind of ["preview", "commit"] as const) {
      expect((await request(kind, [row])).status).toBe(401);
      for (const user of [representative, viewer]) expect((await request(kind, [row], user)).status).toBe(403);
      expect((await request(kind, [row], admin, foreignEvent)).status).toBe(403);
    }
    const [participant] = await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, oldParticipant));
    expect(participant).toMatchObject({ approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED", confirmedAt: null });
    expect(local.approvedEmail).not.toHaveBeenCalled();
  });

  it("requires decision permissions even for a staff importer and checks before looking up participant data", async () => {
    const createOnly = { actorUserId: admin, canUpdate: false, canApprove: false, canWaitlist: false, canReadCrossEventHistory: false };
    await expect(processEventParticipantImportDryRunService(activeEvent, [{ ...existingRow, approvalStatus: "aPpRoVeD" }], createOnly))
      .rejects.toMatchObject({ statusCode: 403 });
    await expect(processEventParticipantImportDryRunService(activeEvent, [{ ...existingRow, approvalStatus: "WAITLISTED" }], createOnly))
      .rejects.toMatchObject({ statusCode: 403 });
    const preview = await processEventParticipantImportDryRunService(activeEvent, [{ ...existingRow, notes: "Perubahan" }], createOnly);
    expect(preview).toMatchObject({ validCount: 0, invalidCount: 1 });
  });

  it("imports new rows as pending and unconfirmed, never promotes a phone to WhatsApp, and audits the correct event UUID", async () => {
    const row = { fullName: "Ustadz Muda", phone: "081234567890" };
    const preview = await request("preview", [row], admin);
    expect(preview.status).toBe(200);
    expect(preview.headers["Cache-Control"]).toBe("no-store");
    expect(preview.data.previewData[0]).toMatchObject({ approvalStatus: "PENDING_REVIEW", currentParticipant: null, normalizedWhatsapp: null });
    expect((await db.select().from(schema.eventParticipants)).length).toBe(2);
    expect((await request("commit", [row], admin, activeEvent, false)).status).toBe(403);
    const saved = await request("commit", [row], admin);
    expect(saved.status).toBe(201);
    expect(saved.data).toMatchObject({ importedCount: 1, notifications: { queued: 0, unavailable: 1, failed: 0 } });
    const [profile] = await db.select().from(schema.ustadzProfiles).where(eq(schema.ustadzProfiles.normalizedName, "muda"));
    expect(profile).toMatchObject({ phone: "6281234567890", whatsapp: null });
    const [participant] = await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.ustadzId, profile.id));
    expect(participant).toMatchObject({ approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED", confirmedAt: null });
    const [audit] = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, "EVENT_PARTICIPANTS_IMPORTED"));
    expect(audit).toMatchObject({ resourceType: "EVENT", resourceId: activeEvent, eventId: activeEvent });
  });

  it("explicitly approves after preview without changing attendance confirmation or reusing submitted contact data", async () => {
    const row = { ...existingRow, approvalStatus: "APPROVED", whatsapp: "081277777777" };
    const preview = await request("preview", [row], admin);
    expect(preview.data.previewData[0]).toMatchObject({ previousApprovedEvents: null,
      currentParticipant: { id: oldParticipant, updatedAt: oldDate.toISOString() } });
    const wrongRevision = await request("commit", [{ ...row, expectedParticipant: { id: oldParticipant,
      updatedAt: "2026-11-10T01:00:00.000Z" } }], admin);
    expect(wrongRevision.data).toMatchObject({ importedCount: 0, failedCount: 1 });
    local.approvedEmail.mockRejectedValueOnce(new Error("test queue unavailable"));
    const saved = await request("commit", [{ ...row, expectedParticipant: preview.data.previewData[0].currentParticipant }], admin);
    expect(saved.data).toMatchObject({ importedCount: 1, updatedCount: 1, notifications: { failed: 1 } });
    const [participant] = await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, oldParticipant));
    expect(participant).toMatchObject({ approvalStatus: "APPROVED", confirmationStatus: "INVITED", confirmedAt: null, qrTokenVersion: 2 });
    const [profile] = await db.select().from(schema.ustadzProfiles).where(eq(schema.ustadzProfiles.id, existingProfile));
    expect(profile.whatsapp).toBeNull();
    const history = await db.select().from(schema.participantStatusHistories).where(eq(schema.participantStatusHistories.participantId, oldParticipant));
    expect(history).toMatchObject([{ statusType: "APPROVAL_STATUS", toStatus: "APPROVED" }]);
    const repeat = await request("commit", [existingRow], admin);
    expect(repeat.data).toMatchObject({ importedCount: 0, skippedCount: 1 });
    const [stillApproved] = await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, oldParticipant));
    expect(stillApproved).toMatchObject({ approvalStatus: "APPROVED", confirmationStatus: "INVITED" });
  });

  it("keeps the original confirmation timestamp and token version when re-importing notes", async () => {
    await db.update(schema.eventParticipants).set({ approvalStatus: "APPROVED", confirmationStatus: "CONFIRMED", confirmedAt: oldDate })
      .where(eq(schema.eventParticipants.id, oldParticipant));
    const row = { ...existingRow, notes: "Catatan baru" };
    const preview = await request("preview", [row], admin);
    expect(preview.data.previewData[0].approvalStatus).toBe("APPROVED");
    expect((await request("commit", [{ ...row, expectedParticipant: preview.data.previewData[0].currentParticipant }], admin)).data.updatedCount).toBe(1);
    const [participant] = await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, oldParticipant));
    expect(participant).toMatchObject({ approvalStatus: "APPROVED", confirmationStatus: "CONFIRMED", confirmedAt: oldDate,
      qrTokenVersion: 1, notes: "Catatan baru" });
    expect(local.approvedEmail).not.toHaveBeenCalled();
  });

  it("imports explicitly approved new rows without a personal confirmation and does not grant delegation access", async () => {
    const row = { fullName: "Ustadz Fulan", email: "fulan@import.invalid", approvalStatus: "APPROVED" };
    const result = await request("commit", [row], admin);
    expect(result.status).toBe(201);
    expect(result.data).toMatchObject({ importedCount: 1, notifications: { queued: 1, unavailable: 0, failed: 0 } });
    const [profile] = await db.select().from(schema.ustadzProfiles).where(eq(schema.ustadzProfiles.email, row.email));
    const [participant] = await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.ustadzId, profile.id));
    expect(participant).toMatchObject({ approvalStatus: "APPROVED", confirmationStatus: "INVITED", confirmedAt: null, isDelegationLead: false });
    expect(local.approvedEmail).toHaveBeenCalledWith(expect.objectContaining({ attendanceConfirmationRequired: true }),
      expect.objectContaining({ confirmationStatus: "INVITED", approvalStatus: "APPROVED" }), expect.objectContaining({ jobIds: expect.any(Array) }));
    const prohibitedLead = await request("preview", [{ fullName: "Ustadz Ketua", email: "ketua@import.invalid",
      institutionCode: "INST-UJI", isDelegationLead: true }], admin);
    expect(prohibitedLead.data).toMatchObject({ validCount: 0, invalidCount: 1 });
    expect(prohibitedLead.data.errorReport[0].error).toMatch(/akses kepala rombongan/);
  });

  it("does not reopen terminal decisions or silently lower an approval on repeated upload", async () => {
    await db.update(schema.eventParticipants).set({ approvalStatus: "APPROVED" }).where(eq(schema.eventParticipants.id, oldParticipant));
    const downgrade = await request("preview", [{ ...existingRow, approvalStatus: "PENDING_REVIEW" }], admin);
    expect(downgrade.data).toMatchObject({ validCount: 0, invalidCount: 1 });
    await db.update(schema.eventParticipants).set({ approvalStatus: "DECLINED" }).where(eq(schema.eventParticipants.id, oldParticipant));
    const reopen = await request("commit", [{ ...existingRow, approvalStatus: "APPROVED" }], admin);
    expect(reopen.status).toBe(422);
    const [participant] = await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, oldParticipant));
    expect(participant).toMatchObject({ approvalStatus: "DECLINED", confirmationStatus: "INVITED", confirmedAt: null });
  });
});
