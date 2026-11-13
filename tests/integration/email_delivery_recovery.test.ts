import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../../netlify/functions/lib/db/schema";
import { completePasswordSetupService, requestPasswordSetupService } from "../../netlify/functions/lib/services/accountPasswordService";
import { processEmailQueueWorker, retryEmailJobService } from "../../netlify/functions/lib/services/emailQueueService";
import { queueRegistrationReceivedEmails } from "../../netlify/functions/lib/services/participantCardEmailService";

const fixture = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle<typeof schema>> | undefined,
  send: vi.fn<(input: { to: string; textBody: string }) => Promise<{ success: boolean; messageId?: string; deliveryUncertain?: boolean }>>() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => fixture.db! }));
vi.mock("../../netlify/functions/lib/services/mailketingTransport", () => ({ sendEmailViaMailketing: fixture.send }));

const pg = new PGlite();
const db = drizzle(pg, { schema });
const email = "activation@email-fixture.invalid";
const now = new Date("2026-11-13T04:00:00Z");
let actorId: string;
let templateId: string;
beforeAll(async () => {
  fixture.db = db;
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  vi.stubEnv("SESSION_SECRET", "isolated-email-test-session");
  vi.stubEnv("EMAIL_WORKER_ENABLED", "false");
  vi.stubEnv("EMAIL_PROVIDER", "MAILKETING");
  const dir = join(process.cwd(), "drizzle");
  for (const name of readdirSync(dir).filter((file) => file.endsWith(".sql")).sort()) await pg.exec(readFileSync(join(dir, name), "utf8"));
  const [account] = await db.insert(schema.users).values({ email, name: "Ustadz Uji" }).returning();
  actorId = account.id;
  const [role] = await db.insert(schema.roles).values({ code: "USTADZ", name: "Asatidz" }).returning();
  await db.insert(schema.userRoleAssignments).values({ userId: account.id, roleId: role.id });
  const [template] = await db.insert(schema.emailTemplates).values({ code: "TEST_EMAIL", name: "Uji", subjectTemplate: "Uji", bodyTemplate: "Uji" }).returning();
  templateId = template.id;
}, 60_000);
afterAll(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); await pg.close(); fixture.db = undefined; });

describe("request-bound OTP and email recovery", () => {
  it("delivers the password code even when the worker is off, stores no email job, and accepts the code once", async () => {
    fixture.send.mockResolvedValue({ success: true, messageId: "accepted-password-test" });
    const issued = await requestPasswordSetupService(email, "ustadz", "request-password");
    expect(fixture.send).toHaveBeenCalledOnce();
    const message = fixture.send.mock.calls[0][0];
    expect(message.to).toBe(email);
    const otp = message.textBody.match(/\b\d{6}\b/)?.[0];
    expect(otp).toBeTruthy();
    expect(await db.select().from(schema.emailJobs)).toEqual([]);
    const input = { email, portal: "ustadz" as const, challengeToken: issued.challengeToken, otp: otp!, newPassword: "uji-password-aman" };
    await expect(completePasswordSetupService(input, "complete-password")).resolves.toMatchObject({ passwordUpdated: true });
    await expect(completePasswordSetupService(input, "complete-password-again")).rejects.toMatchObject({ statusCode: 401 });
    fixture.send.mockResolvedValue({ success: false });
    await expect(requestPasswordSetupService(email, "ustadz", "failed-password-mail")).rejects.toMatchObject({ statusCode: 503, code: "ACTIVATION_EMAIL_UNAVAILABLE" });
  });

  it("reconciles accepted stale jobs, stops unknown outcomes, and never sends an expired queued code", async () => {
    fixture.send.mockClear();
    const old = new Date(now.getTime() - 11 * 60_000);
    const base = { templateId, recipientEmail: email, payload: { templateCode: "BROADCAST_CUSTOM", bodyText: "Uji" },
      status: "PROCESSING", scheduledAt: old, createdAt: old, updatedAt: old, lockedAt: old, lockedBy: "older-worker" };
    const [accepted, uncertain, otp] = await db.insert(schema.emailJobs).values([
      { ...base, idempotencyKey: "test-accepted" }, { ...base, idempotencyKey: "test-uncertain" },
      { ...base, idempotencyKey: "password_setup_legacy", status: "QUEUED", lockedAt: null, lockedBy: null,
        payload: { templateCode: "OTP_CODE", variables: { expiresMinutes: 10, otpCode: "000001" } } },
    ]).returning();
    await db.insert(schema.emailDeliveries).values({ emailJobId: accepted.id, provider: "TEST", status: "ACCEPTED",
      providerMessageId: "older-test", sentAt: new Date(old.getTime() + 2000) });
    const result = await processEmailQueueWorker("test-worker", 10, "recovery-test");
    expect(result.results).toEqual(expect.arrayContaining([
      expect.objectContaining({ jobId: accepted.id, status: "SENT" }), expect.objectContaining({ jobId: uncertain.id, status: "DELIVERY_UNCERTAIN" }),
      expect.objectContaining({ jobId: otp.id, status: "CANCELLED" }),
    ]));
    expect(fixture.send).not.toHaveBeenCalled();
    await expect(retryEmailJobService(uncertain.id, actorId, "unsafe-retry")).rejects.toMatchObject({ statusCode: 409 });
    await expect(retryEmailJobService(uncertain.id, actorId, "reviewed-retry", true)).resolves.toMatchObject({ status: "QUEUED" });
    fixture.send.mockResolvedValue({ success: false, deliveryUncertain: true });
    await processEmailQueueWorker("test-worker", 10, "failed-provider");
    const [job] = await db.select().from(schema.emailJobs).where(eq(schema.emailJobs.id, uncertain.id));
    expect(job.status).toBe("DELIVERY_UNCERTAIN");
    expect(fixture.send).toHaveBeenCalledOnce();
  });

  it("dispatches only the just-created registration email after the action, never a pending campaign", async () => {
    fixture.send.mockClear(); fixture.send.mockResolvedValue({ success: true, messageId: "new-registration-mail" });
    const [event] = await db.insert(schema.events).values({ code: "EMAIL-ACTION", name: "Daurah Uji", slug: "email-action",
      startDate: "2026-11-13", endDate: "2026-11-14", timezone: "Asia/Jakarta", status: "REGISTRATION_OPEN" }).returning();
    const [profile] = await db.insert(schema.ustadzProfiles).values({ fullName: "Ustadz Uji", normalizedName: "ustadz uji", email }).returning();
    const [participant] = await db.insert(schema.eventParticipants).values({ eventId: event.id, ustadzId: profile.id,
      participantCode: "P-EMAIL-ACTION", approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED" }).returning();
    const [campaign] = await db.insert(schema.emailJobs).values({ templateId, recipientEmail: "other@email-fixture.invalid",
      payload: { templateCode: "BROADCAST_CUSTOM", bodyText: "Unrelated campaign" }, status: "QUEUED", scheduledAt: now,
      idempotencyKey: "separate-campaign" }).returning();
    const recipients = [{ participantId: participant.id, ustadzName: profile.fullName, email, participantCode: participant.participantCode }];
    expect(await queueRegistrationReceivedEmails(event, recipients)).toBe(1);
    expect(fixture.send).toHaveBeenCalledOnce();
    expect(fixture.send.mock.calls[0][0].to).toBe(email);
    expect(fixture.send.mock.calls[0][0].textBody).not.toMatch(/pqr_|pcf_/);
    expect(await queueRegistrationReceivedEmails(event, recipients)).toBe(0);
    expect(fixture.send).toHaveBeenCalledOnce();
    expect((await db.select().from(schema.emailJobs).where(eq(schema.emailJobs.id, campaign.id)))[0].status).toBe("QUEUED");
  });
});
