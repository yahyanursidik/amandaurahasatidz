import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import type { HandlerEvent, HandlerContext } from "@netlify/functions";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import * as schema from "../../netlify/functions/lib/db/schema";
import { createSessionToken } from "../../netlify/functions/lib/services/authService";
import { handler } from "../../netlify/functions/api";

const isolated = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle<typeof schema>> | undefined }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => isolated.db! }));
vi.mock(import("../../netlify/functions/lib/utils/logger"), async (original) => ({ ...await original(), logInfo: vi.fn() }));
const pg = new PGlite();
const db = drizzle(pg, { schema });
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const eventA = uuid(1), eventB = uuid(2), noConfirm = uuid(3), ended = uuid(4), block = uuid(5);
const institution = uuid(7), invitation = uuid(8);
const [a, b, fallback, noNumber, pending, confirmed, cancelled, archived, noConfirmPerson, endedPerson, blockedPerson] =
  Array.from({ length: 11 }, (_, index) => uuid(101 + index));
const origin = "https://test-whatsapp.invalid";
const adminEmail = "event-admin@test-whatsapp.invalid";
const globalAdmin = "global-admin@test-whatsapp.invalid";

async function request(eventId: string, options: { user?: string | null; query?: Record<string, string>; body?: unknown } = {}) {
  const { user = adminEmail, query = {}, body } = options;
  const path = `/api/v1/events/${eventId}/participants/whatsapp`;
  const rawQuery = new URLSearchParams(query).toString();
  const event: HandlerEvent = {
    path, rawUrl: `${origin}${path}${rawQuery ? `?${rawQuery}` : ""}`, rawQuery,
    httpMethod: body ? "POST" : "GET", headers: { host: "test-whatsapp.invalid", origin, "sec-fetch-site": "same-origin",
      ...(user ? { authorization: `Bearer ${createSessionToken(user).sessionId}` } : {}) },
    queryStringParameters: query, multiValueHeaders: {}, multiValueQueryStringParameters: null,
    isBase64Encoded: false, body: body ? JSON.stringify(body) : null,
  };
  const result = await handler(event, {} as HandlerContext, vi.fn());
  if (!result?.body) throw new Error("No API response");
  return { status: result.statusCode, headers: result.headers, ...JSON.parse(result.body) };
}

beforeAll(async () => {
  isolated.db = db;
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("APP_URL", origin);
  vi.stubEnv("SESSION_SECRET", "isolated-whatsapp-session");
  vi.stubEnv("PARTICIPANT_CONFIRMATION_SECRET", "isolated-whatsapp-confirmation");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-13T04:00:00Z"));
  const migrations = join(process.cwd(), "drizzle");
  for (const name of readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(migrations, name), "utf8"));
  }
  const actors = [
    [adminEmail, "EVENT_ADMIN", eventA, null],
    [globalAdmin, "COMMITTEE_ORGANIZER", null, null],
    ["viewer@test-whatsapp.invalid", "REPORT_VIEWER", null, null],
    ["scanner@test-whatsapp.invalid", "CHECKIN_OFFICER", eventA, null],
    ["representative@test-whatsapp.invalid", "INSTITUTION_REPRESENTATIVE", eventA, null],
    ["expired@test-whatsapp.invalid", "EVENT_ADMIN", eventA, new Date("2026-11-12")],
  ] as const;
  const users = await db.insert(schema.users).values(actors.map(([email]) => ({ email }))).returning();
  const roles = await db.insert(schema.roles).values([...new Set(actors.map(([, code]) => code))].map((code) => ({ code, name: code }))).returning();
  await db.insert(schema.events).values([eventA, eventB, noConfirm, ended, block].map((id, i) => ({
    id, slug: `daurah-${i}`, code: `TEST-${i}`, name: `Daurah Uji ${i}`, startDate: "2026-11-12",
    endDate: id === ended ? "2026-11-12" : "2026-11-15", timezone: "Asia/Jakarta", status: "REGISTRATION_OPEN",
    attendanceConfirmationRequired: id !== noConfirm, lateConfirmationPolicy: "BLOCK",
    attendanceConfirmationDeadline: id === block ? new Date("2026-11-13T00:00:00Z") : null,
  })));
  await db.insert(schema.userRoleAssignments).values(actors.map(([email, code, eventId, endsAt]) =>
    ({ userId: users.find((user) => user.email === email)!.id, roleId: roles.find((role) => role.code === code)!.id, eventId, endsAt })));
  await db.insert(schema.institutions).values({ id: institution, name: "Ma'had Uji", code: "INST-UJI" });
  await db.insert(schema.invitations).values({ id: invitation, invitationNumber: "INV-UJI", eventId: eventA, institutionId: institution, invitationType: "INSTITUTION" });
  const people = [
    [a, "Ahmad", eventA, "081234567890", null, "APPROVED", "INVITED", "INSTITUTION_DELEGATION"],
    [b, "Bukan Peserta A", eventB, "081234567898", null, "APPROVED", "INVITED", "DIRECT_PUBLIC"],
    [fallback, "Haris", eventA, "salah", "081234567891", "APPROVED", "INVITED", "INDIVIDUAL_INVITATION"],
    [noNumber, "Naufal", eventA, null, null, "APPROVED", "INVITED", "DIRECT_PUBLIC"],
    [pending, "Salim", eventA, "081234567892", null, "PENDING_REVIEW", "INVITED", "DIRECT_PUBLIC"],
    [confirmed, "Umar", eventA, "081234567893", null, "APPROVED", "CONFIRMED", "DIRECT_PUBLIC"],
    [cancelled, "Zaid", eventA, "081234567894", null, "APPROVED", "CANCELLED", "DIRECT_PUBLIC"],
    [archived, "Zuhair", eventA, "081234567895", null, "APPROVED", "INVITED", "DIRECT_PUBLIC"],
    [noConfirmPerson, "Yahya", noConfirm, "081234567895", null, "APPROVED", "INVITED", "DIRECT_PUBLIC"],
    [endedPerson, "Fulan", ended, "081234567895", null, "APPROVED", "INVITED", "DIRECT_PUBLIC"],
    [blockedPerson, "Hafiz", block, "081234567895", null, "APPROVED", "INVITED", "DIRECT_PUBLIC"],
  ] as const;
  for (const [id, name, eventId, whatsapp, phone, approvalStatus, confirmationStatus, registrationSource] of people) {
    const [profile] = await db.insert(schema.ustadzProfiles).values({
      fullName: name, normalizedName: name.toLowerCase(), whatsapp, phone, email: `${name.replaceAll(" ", "-")}@test-whatsapp.invalid`,
      address: "private fixture address", profileStatus: id === archived ? "ARCHIVED" : "ACTIVE",
    }).returning();
    await db.insert(schema.eventParticipants).values({ id, ustadzId: profile.id, eventId, participantCode: `P-${name}`,
      institutionId: id === a ? institution : null, invitationId: id === a ? invitation : null,
      approvalStatus, confirmationStatus, registrationSource });
  }
}, 60_000);
afterAll(async () => { vi.useRealTimers(); vi.unstubAllEnvs(); await pg.close(); isolated.db = undefined; });

describe("event-scoped WhatsApp recipient API", () => {
  it("paginates minimal contact fields, filters participant route/status/affiliation, and never lists private links", async () => {
    const first = await request(eventA, { query: { pageSize: "2" } });
    expect(first.status, JSON.stringify(first.error)).toBe(200);
    expect(first.headers["Cache-Control"]).toBe("no-store");
    expect(first.data.hasNext).toBe(true);
    expect(first.data.recipients).toMatchObject([
      { id: a, number: "6281234567890", numberSource: "WhatsApp" },
      { id: fallback, number: "6281234567891", numberSource: "Telepon cadangan" },
    ]);
    expect(JSON.stringify(first.data)).not.toMatch(/email|address|pcf_|pqr_|password/i);
    expect((await request(eventA, { query: { pageSize: "2", page: "2" } })).data.recipients.map(({ id }: { id: string }) => id)).toEqual([noNumber, pending]);
    const scoped = await request(eventA, { query: { source: "INSTITUTION", institutionId: institution, invitationId: invitation, status: "AWAITING_CONFIRMATION", search: "ma'had" } });
    expect(scoped.data.recipients.map(({ id }: { id: string }) => id)).toEqual([a]);
    expect((await request(eventA, { query: { search: "%" } })).data.recipients).toEqual([]);
    const all = (await request(eventA)).data.recipients;
    expect(all.map(({ id }: { id: string }) => id)).not.toContain(b);
    expect(all.map(({ id }: { id: string }) => id)).not.toContain(archived);
  });

  it("rejects anonymous, read-only, gate, representative, expired and cross-event access", async () => {
    expect((await request(eventA, { user: null })).status).toBe(401);
    for (const user of ["viewer", "scanner", "representative", "expired"]) {
      expect((await request(eventA, { user: `${user}@test-whatsapp.invalid` })).status).toBe(403);
      expect((await request(eventA, { user: `${user}@test-whatsapp.invalid`, body: { participantIds: [a] } })).status).toBe(403);
    }
    expect((await request(eventB)).status).toBe(403);
    expect((await request(eventB, { user: globalAdmin })).data.recipients.map(({ id }: { id: string }) => id)).toEqual([b]);
  });

  it("issues a receipt link only to the current approved recipient with a direct WhatsApp number", async () => {
    const ids = [b, archived, pending, fallback, noNumber, confirmed, cancelled, a];
    const checked = await request(eventA, { body: { participantIds: ids, confirmation: true } });
    expect(checked.status, JSON.stringify(checked.error)).toBe(200);
    expect(checked.data.recipients.filter((person: { confirmationAvailable: boolean }) => person.confirmationAvailable).map(({ id }: { id: string }) => id)).toEqual([a]);
    expect(JSON.stringify(checked.data)).not.toMatch(/pcf_|prc_/);
    const draft = await request(eventA, { body: { participantIds: ids, confirmation: true, statusLinkFor: a } });
    expect(draft.headers["Cache-Control"]).toBe("no-store");
    const links = draft.data.recipients.filter((person: { registrationStatusUrl?: string }) => person.registrationStatusUrl);
    expect(links).toHaveLength(1);
    const token = new URL(links[0].registrationStatusUrl, origin).hash.slice(1);
    expect(token).toMatch(/^prc_/);
    expect(JSON.stringify(draft.data)).not.toMatch(/pqr_|pcf_/);
    for (const id of [b, fallback, pending, confirmed, cancelled]) {
      expect(JSON.stringify((await request(eventA, { body: { participantIds: [id], confirmation: true, statusLinkFor: id } })).data)).not.toMatch(/pcf_|prc_/);
    }
  });

  it("honors event confirmation settings and rejects malformed or oversized queues", async () => {
    for (const [id, participantId] of [[noConfirm, noConfirmPerson], [ended, endedPerson], [block, blockedPerson]]) {
      const result = await request(id, { user: globalAdmin, body: { participantIds: [participantId], confirmation: true, statusLinkFor: participantId } });
      expect(result.data.recipients[0]).toMatchObject({ confirmationAvailable: false });
      expect(JSON.stringify(result.data)).not.toMatch(/pcf_|prc_/);
    }
    expect((await request(eventA, { body: { participantIds: [a], confirmation: true, statusLinkFor: b } })).status).toBe(422);
    expect((await request(eventA, { body: { participantIds: [a, a] } })).status).toBe(422);
    expect((await request(eventA, { body: { participantIds: Array.from({ length: 101 }, (_, index) => uuid(500 + index)) } })).status).toBe(422);
  });

  it("withholds the private link if another participant in the event shares the contact number", async () => {
    const [person] = await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, confirmed));
    await db.update(schema.ustadzProfiles).set({ phone: "+62 812-3456-7890" }).where(eq(schema.ustadzProfiles.id, person.ustadzId));
    try {
      const result = await request(eventA, { body: { participantIds: [a], confirmation: true, statusLinkFor: a } });
      expect(result.data.recipients[0]).toMatchObject({ confirmationAvailable: false, sharedNumber: true });
      expect(result.data.recipients[0]).not.toHaveProperty("registrationStatusUrl");
    } finally {
      await db.update(schema.ustadzProfiles).set({ phone: null }).where(eq(schema.ustadzProfiles.id, person.ustadzId));
    }
  });

  it("does not return either a proposed contact or a stale master number before reconciliation", async () => {
    const [person] = await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, a));
    const [change] = await db.insert(schema.participantStatusHistories).values({ participantId: a,
      statusType: "WHATSAPP_REVIEW", toStatus: "PENDING", reason: "6281234567999" }).returning();
    try {
      const unresolved = await request(eventA, { body: { participantIds: [a], confirmation: true, statusLinkFor: a } });
      expect(unresolved.data.recipients[0]).toMatchObject({ number: null, needsContactReview: true, confirmationAvailable: false });
      expect(JSON.stringify(unresolved.data)).not.toMatch(/6281234567999|6281234567890|prc_/);
      await db.update(schema.ustadzProfiles).set({ whatsapp: "+62 812 3456 7999" }).where(eq(schema.ustadzProfiles.id, person.ustadzId));
      expect((await request(eventA, { body: { participantIds: [a], confirmation: true, statusLinkFor: a } })).data.recipients[0])
        .toMatchObject({ number: "6281234567999", confirmationAvailable: true, registrationStatusUrl: expect.stringContaining("prc_") });
    } finally {
      await db.delete(schema.participantStatusHistories).where(eq(schema.participantStatusHistories.id, change.id));
      await db.update(schema.ustadzProfiles).set({ whatsapp: "081234567890" }).where(eq(schema.ustadzProfiles.id, person.ustadzId));
    }
  });
});
