import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../netlify/functions/lib/db/schema";
import { authenticatePasswordService } from "../../netlify/functions/lib/services/authService";
import { requestPasswordSetupService, completePasswordSetupService } from "../../netlify/functions/lib/services/accountPasswordService";
import { hashPassword } from "../../netlify/functions/lib/utils/password";
import { hasPortalAccess, PORTAL_ROLES } from "../../src/config/portalAccess";

const fixture = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle<typeof schema>> | undefined,
  send: vi.fn(async (_input: { variables: { otpCode: string }; recipientEmail: string }) => ({ success: true })) }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => fixture.db! }));
vi.mock("../../netlify/functions/lib/services/emailTransport", () => ({ sendImmediateTransactionalTemplate: fixture.send }));
const pg = new PGlite();
const db = drizzle(pg, { schema });
const eventId = "00000000-0000-4000-8000-000000000601";
const email = "committee@auth-fixture.invalid";
const password = "uji-sandi-panitia-aman";
let userId: string;

beforeAll(async () => {
  fixture.db = db;
  const dir = join(process.cwd(), "drizzle");
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".sql")).sort()) await pg.exec(readFileSync(join(dir, file), "utf8"));
}, 60_000);
beforeEach(async () => {
  vi.stubEnv("SESSION_SECRET", "committee-auth-local-fixture-secret");
  vi.stubEnv("EMAIL_WORKER_ENABLED", "false");
  fixture.send.mockClear();
  await pg.exec("truncate table events, users, roles cascade");
  await db.insert(schema.events).values({ id: eventId, code: "COMMITTEE-AUTH", slug: "committee-auth", name: "Daurah Uji",
    startDate: "2099-01-01", endDate: "2099-01-02", status: "PUBLISHED", timezone: "Asia/Jakarta" });
  const [user] = await db.insert(schema.users).values({ name: "Panitia Uji", email, status: "ACTIVE", passwordHash: hashPassword(password) }).returning();
  userId = user.id;
});
afterAll(async () => { vi.unstubAllEnvs(); await pg.close(); fixture.db = undefined; });
async function role(code: string, period: { startsAt?: Date; endsAt?: Date } = {}) {
  const [created] = await db.insert(schema.roles).values({ code, name: code }).returning();
  await db.insert(schema.userRoleAssignments).values({ userId, roleId: created.id,
    eventId: ["SUPER_ADMIN", "COMMITTEE_ORGANIZER"].includes(code) ? null : eventId, ...period });
}

describe("committee portal login and activation share one role policy", () => {
  it.each(PORTAL_ROLES.committee)("allows %s through both password and email-code recovery in the committee portal", async (code) => {
    await role(code);
    const context = await authenticatePasswordService(email.toUpperCase(), password, "committee");
    expect(context.userId).toBe(userId);
    expect(context.assignments).toEqual([expect.objectContaining({ roleCode: code })]);
    const issued = await requestPasswordSetupService(email, "committee", "committee-setup");
    expect(fixture.send).toHaveBeenCalledOnce();
    expect(fixture.send.mock.calls[0][0].recipientEmail).toBe(email);
    const otp = fixture.send.mock.calls[0][0].variables.otpCode;
    await expect(completePasswordSetupService({ email, portal: "committee", challengeToken: issued.challengeToken, otp,
      newPassword: "sandi-pribadi-panitia-baru" }, "committee-complete")).resolves.toMatchObject({ passwordUpdated: true });
    expect((await authenticatePasswordService(email, "sandi-pribadi-panitia-baru", "committee")).userId).toBe(userId);
    expect(await db.select().from(schema.emailJobs)).toHaveLength(0);
  });

  it("does not elevate check-in officers to Admin; corrects the portal only after verifying the password", async () => {
    await role("CHECKIN_OFFICER");
    await expect(authenticatePasswordService(email, password, "admin")).rejects.toMatchObject({ statusCode: 403,
      details: { recommendedPortal: "committee", loginPath: "/login/committee" } });
    await expect(authenticatePasswordService(email, "wrong-password", "admin")).rejects.toMatchObject({ statusCode: 401, details: undefined });
    await expect(requestPasswordSetupService(email, "admin", "wrong-portal")).rejects.toMatchObject({ statusCode: 401, details: undefined });
    expect(fixture.send).not.toHaveBeenCalled();
    const roles = await db.select({ id: schema.userRoleAssignments.roleId }).from(schema.userRoleAssignments);
    expect(roles).toHaveLength(1);
    expect(hasPortalAccess("admin", [{ roleCode: "CHECKIN_OFFICER" }])).toBe(false);
  });

  it.each(["future", "expired", "inactive"])("does not reactivate a %s assignment/account through recovery", async (kind) => {
    await role("CHECKIN_OFFICER", kind === "future" ? { startsAt: new Date(Date.now() + 86_400_000) }
      : kind === "expired" ? { endsAt: new Date(Date.now() - 86_400_000) } : {});
    if (kind === "inactive") await db.update(schema.users).set({ status: "INACTIVE" }).where(eq(schema.users.id, userId));
    await expect(authenticatePasswordService(email, password, "committee")).rejects.toMatchObject({ statusCode: kind === "inactive" ? 401 : 403 });
    await expect(requestPasswordSetupService(email, "committee", "restricted-recovery")).rejects.toMatchObject({ statusCode: 401, details: undefined });
    expect(fixture.send).not.toHaveBeenCalled();
  });
});
