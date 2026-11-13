import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { count, eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../netlify/functions/lib/db/schema";
import { isAttendanceQrEventOpen } from "../../netlify/functions/lib/repositories/attendanceRepository";
import { findUstadzByIdRepository } from "../../netlify/functions/lib/repositories/ustadzRepository";
import { replacePortalDelegationMemberTxRepository } from "../../netlify/functions/lib/repositories/participantRepository";
import { getParticipantAttendanceReportService } from "../../netlify/functions/lib/services/attendanceReportService";
import { getPortalDelegationService, getPortalOverviewService, getPortalPublicGroupService } from "../../netlify/functions/lib/services/portalService";
import { getOrGenerateLocationQrTokenService } from "../../netlify/functions/lib/services/dynamicQrService";
import { getPaginatedReportService } from "../../netlify/functions/lib/services/reportService";

const fixture = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle<typeof schema>> | undefined }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => fixture.db! }));
vi.mock("../../netlify/functions/lib/db/transaction", () => ({
  withTransaction: (work: Parameters<NonNullable<typeof fixture.db>["transaction"]>[0]) => fixture.db!.transaction(work),
}));
const pg = new PGlite();
const db = drizzle(pg, { schema });
const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const eventId = uuid(1), institutionId = uuid(2), invitationId = uuid(3), dayId = uuid(4), sessionId = uuid(5);
const leadUser = uuid(6), leadProfile = uuid(7), leadId = uuid(8), memberProfile = uuid(9), memberId = uuid(10);
const publicGroup = uuid(11);
const replacement = { targetParticipantId: memberId, fullName: "Ustadz Pengganti", email: "pengganti@test.invalid",
  whatsapp: "6281234567891", phone: "6281234567891", reason: "Penggantian atas permintaan anggota." };

beforeAll(async () => {
  fixture.db = db;
  for (const file of readdirSync(join(process.cwd(), "drizzle")).filter((file) => file.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(process.cwd(), "drizzle", file), "utf8"));
  }
}, 60_000);

beforeEach(async () => {
  vi.stubEnv("SESSION_SECRET", "disposable-attendance-audit-secret");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-13T12:00:00Z"));
  await pg.exec("truncate table events, users, roles, ustadz_profiles, institutions cascade");
  await db.insert(schema.users).values({ id: leadUser, email: "lead@test.invalid", status: "ACTIVE" });
  await db.insert(schema.roles).values({ code: "USTADZ", name: "Asatidz" });
  await db.insert(schema.ustadzProfiles).values([
    { id: leadProfile, userId: leadUser, fullName: "Ustadz Ketua", normalizedName: "ustadz ketua", email: "lead@test.invalid" },
    { id: memberProfile, fullName: "Ustadz Anggota", normalizedName: "ustadz anggota", email: "member@test.invalid", address: "Private test address" },
  ]);
  await db.insert(schema.events).values({ id: eventId, slug: "daurah-audit", code: "AUDIT", name: "Daurah Uji",
    status: "ONGOING", startDate: "2026-11-13", endDate: "2026-11-13", timezone: "Asia/Jakarta", attendanceMode: "SESSION_ONLY",
    attendanceConfirmationRequired: true });
  await db.insert(schema.eventDays).values({ id: dayId, eventId, dayNumber: 1, date: "2026-11-13" });
  await db.insert(schema.eventSessions).values({ id: sessionId, eventDayId: dayId, title: "Sesi malam",
    startAt: new Date("2026-11-13T15:00:00Z"), endAt: new Date("2026-11-13T16:30:00Z") });
  await db.insert(schema.institutions).values({ id: institutionId, name: "Lembaga Uji", code: "INST-UJI" });
  await db.insert(schema.invitations).values({ id: invitationId, eventId, institutionId, invitationType: "INSTITUTION", invitationNumber: "UND-UJI", status: "ACCEPTED" });
  await db.insert(schema.eventParticipants).values([
    { id: leadId, ustadzId: leadProfile, eventId, institutionId, invitationId, publicGroupId: publicGroup,
      participantCode: "P-KETUA", isDelegationLead: true, approvalStatus: "APPROVED", confirmationStatus: "CONFIRMED" },
    { id: memberId, ustadzId: memberProfile, eventId, institutionId, invitationId, publicGroupId: publicGroup,
      participantCode: "P-ANGGOTA", approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED" },
  ]);
});

afterAll(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); await pg.close(); fixture.db = undefined; });

describe("attendance audit regressions on isolated PostgreSQL", () => {
  it("keeps the actual last attendance window usable across midnight, then closes it", async () => {
    vi.setSystemTime(new Date("2026-11-13T17:05:00Z")); // 00.05 WIB, closes 00.30.
    const [event] = await db.select().from(schema.events).where(eq(schema.events.id, eventId));
    expect(await isAttendanceQrEventOpen(eventId, event)).toBe(true);
    const portal = await getPortalOverviewService(leadUser, "lead@test.invalid");
    expect(portal.participations[0].attendanceQrWindows).toEqual([
      { openAt: new Date("2026-11-13T14:00:00Z"), closeAt: new Date("2026-11-13T17:30:00Z") },
    ]);
    vi.setSystemTime(new Date("2026-11-13T17:31:00Z"));
    expect(await isAttendanceQrEventOpen(eventId, event)).toBe(false);
    expect(await isAttendanceQrEventOpen(eventId, { ...event, archivedAt: new Date() })).toBe(false);
  });

  it("uses one automatic QR row per unit and keeps the original 30-second expiry", async () => {
    vi.setSystemTime(new Date("2026-11-13T15:00:00Z"));
    const first = await getOrGenerateLocationQrTokenService(eventId, { sessionId }, leadUser);
    vi.setSystemTime(new Date("2026-11-13T15:00:01Z"));
    const second = await getOrGenerateLocationQrTokenService(eventId, { sessionId }, leadUser);
    expect(second).toMatchObject({ tokenId: first.tokenId, rawToken: first.rawToken, secondsRemaining: 29 });
    vi.setSystemTime(new Date("2026-11-13T15:00:31Z"));
    const third = await getOrGenerateLocationQrTokenService(eventId, { sessionId }, leadUser);
    expect(third.tokenId).toBe(first.tokenId);
    expect(third.rawToken).not.toBe(first.rawToken);
    expect((await db.select({ total: count() }).from(schema.checkinTokens))[0].total).toBe(1);
    const rotated = await getOrGenerateLocationQrTokenService(eventId, { sessionId }, leadUser, true);
    expect(rotated.tokenId).not.toBe(first.tokenId);
    expect((await db.select().from(schema.checkinTokens).where(eq(schema.checkinTokens.id, first.tokenId)))[0].revokedAt).not.toBeNull();
  });

  it.each(["CANCELLED", "REPLACED"])("revokes roster read and replacement for an inactive %s leader", async (confirmationStatus) => {
    await db.update(schema.eventParticipants).set({ confirmationStatus }).where(eq(schema.eventParticipants.id, leadId));
    await expect(getPortalDelegationService(leadUser, "lead@test.invalid", leadId)).rejects.toMatchObject({ statusCode: 403 });
    await expect(getPortalPublicGroupService(leadUser, "lead@test.invalid", leadId)).rejects.toMatchObject({ statusCode: 403 });
    await expect(replacePortalDelegationMemberTxRepository(leadProfile, leadUser, leadId, replacement, "test"))
      .rejects.toMatchObject({ statusCode: 403 });
    expect((await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, memberId)))[0].confirmationStatus).toBe("INVITED");
  });

  it("revokes rejected-leader access, and blocks replacements after the invitation deadline", async () => {
    await db.update(schema.eventParticipants).set({ approvalStatus: "DECLINED" }).where(eq(schema.eventParticipants.id, leadId));
    await expect(getPortalDelegationService(leadUser, "lead@test.invalid", leadId)).rejects.toMatchObject({ statusCode: 403 });
    await db.update(schema.eventParticipants).set({ approvalStatus: "APPROVED" }).where(eq(schema.eventParticipants.id, leadId));
    await db.update(schema.invitations).set({ responseDeadline: new Date("2026-11-13T00:00:00Z") }).where(eq(schema.invitations.id, invitationId));
    const roster = await getPortalDelegationService(leadUser, "lead@test.invalid", leadId);
    expect(roster.canManage).toBe(false);
    expect(JSON.stringify(roster)).not.toContain("Private test address");
    expect(roster.members.every((member) => !member.canReplace)).toBe(true);
    await expect(replacePortalDelegationMemberTxRepository(leadProfile, leadUser, leadId, replacement, "test"))
      .rejects.toMatchObject({ statusCode: 403 });
  });

  it("a replacement awaits moderation and personal confirmation, preserving an existing profile's contact", async () => {
    const [profile] = await db.insert(schema.ustadzProfiles).values({ fullName: replacement.fullName,
      normalizedName: "ustadz pengganti", email: replacement.email, whatsapp: "6281234500000" }).returning();
    const result = await replacePortalDelegationMemberTxRepository(leadProfile, leadUser, leadId, replacement, "test");
    expect(result).toMatchObject({ approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED" });
    expect((await db.select().from(schema.ustadzProfiles).where(eq(schema.ustadzProfiles.id, profile.id)))[0].whatsapp).toBe("6281234500000");
    expect((await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, memberId)))[0].confirmationStatus).toBe("REPLACED");
  });

  it("history and official report both exclude unapproved participants from absences", async () => {
    vi.setSystemTime(new Date("2026-11-14T00:00:00Z"));
    const history = (await findUstadzByIdRepository(memberProfile))!.eventHistory[0];
    const report = await getParticipantAttendanceReportService(eventId, memberId);
    expect(history).toMatchObject({ attendanceStatus: "TIDAK_WAJIB", requiredUnits: 0 });
    expect(report.attendance).toMatchObject({ eligible: false, requiredUnits: 0, statusCategory: "TIDAK_WAJIB" });
  });

  it("counts grouped report rows rather than individual participants", async () => {
    const report = await getPaginatedReportService("institution-participants", { eventId, pageSize: 1 });
    expect(report.meta).toMatchObject({ total: 1, pageCount: 1 });
    expect(report.data).toHaveLength(1);
    expect(report.data[0]).toMatchObject({ institutionId, delegationCount: 2 });
    expect((await getPaginatedReportService("returning-participants", { eventId })).data).toEqual([]);
  });

  it("reports individual invitation recipients and the actual invitation response", async () => {
    const [invitation] = await db.insert(schema.invitations).values({ eventId, ustadzId: memberProfile,
      invitationNumber: "UND-PERSONAL", invitationType: "INDIVIDUAL", status: "OPENED" }).returning();
    await db.insert(schema.invitationResponses).values({ invitationId: invitation.id, responseStatus: "DECLINED", isFinal: true });
    const invitationReport = await getPaginatedReportService("invitations", { eventId });
    expect(invitationReport.data.find((row) => row.id === invitation.id)).toMatchObject({
      recipientName: "Ustadz Anggota", recipientEmail: "member@test.invalid", invitationType: "INDIVIDUAL",
    });
    const responseReport = await getPaginatedReportService("responses", { eventId });
    expect(responseReport.data).toEqual([expect.objectContaining({ responseStatus: "DECLINED", invitationNumber: "UND-PERSONAL" })]);
  });

  it("paginates actual returning-attendee aggregates and grouped region counts", async () => {
    const [otherEvent] = await db.insert(schema.events).values({ slug: "daurah-lama", code: "OLD", name: "Daurah Sebelumnya",
      status: "COMPLETED", startDate: "2026-10-13", endDate: "2026-10-13" }).returning();
    const [otherDay] = await db.insert(schema.eventDays).values({ eventId: otherEvent.id, dayNumber: 1, date: "2026-10-13" }).returning();
    const [otherParticipant] = await db.insert(schema.eventParticipants).values({ eventId: otherEvent.id,
      ustadzId: leadProfile, participantCode: "P-OLD", approvalStatus: "APPROVED", confirmationStatus: "CONFIRMED" }).returning();
    await db.insert(schema.attendanceRecords).values([
      { eventId, eventDayId: dayId, eventSessionId: sessionId, participantId: leadId, attendanceStatus: "PRESENT" },
      { eventId: otherEvent.id, eventDayId: otherDay.id, participantId: otherParticipant.id, attendanceStatus: "LATE" },
    ]);
    const repeat = await getPaginatedReportService("returning-participants", { pageSize: 1 });
    expect(repeat.meta).toMatchObject({ total: 1, pageCount: 1 });
    expect(repeat.data).toEqual([expect.objectContaining({ ustadzId: leadProfile, eventCount: 2, attendanceRecordCount: 2 })]);
    expect((await getPaginatedReportService("returning-participants", { pageSize: 1, page: 2 })).data).toEqual([]);
    await db.insert(schema.institutions).values({ name: "Lembaga Lain", code: "INST-LAIN" });
    const geography = await getPaginatedReportService("demographics", { pageSize: 1 });
    expect(geography.meta.total).toBe(1);
    expect(geography.data[0].institutionCount).toBe(2);
  });
});
