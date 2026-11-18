import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../netlify/functions/lib/db/schema";
import { createSessionToken } from "../../netlify/functions/lib/services/authService";
import { processEmailQueueWorker } from "../../netlify/functions/lib/services/emailQueueService";
import { generateSecureToken, signParticipantQrToken, verifyParticipantConfirmationToken } from "../../netlify/functions/lib/utils/token";
import { createInstitutionAccessVerification, getInstitutionAccessCode } from "../../netlify/functions/lib/services/institutionAccessCodeService";
import { handler } from "../../netlify/functions/api";
import type { RegistrationInstitutionProposal } from "../../src/lib/registrationInstitution";

const local = vi.hoisted(() => ({
  db: undefined as ReturnType<typeof drizzle<typeof schema>> | undefined,
  send: vi.fn(async (_mail: { to: string; subject: string; htmlBody: string; textBody: string }) =>
    ({ success: true, provider: "TEST" })),
  immediate: vi.fn(async (_mail: { templateCode: string; recipientEmail: string; variables: Record<string, unknown> }) =>
    ({ success: true, provider: "TEST" })),
}));
vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => {
    if (!local.db) throw new Error("Test database was not initialized");
    return local.db;
  },
}));
vi.mock("../../netlify/functions/lib/db/transaction", () => ({
  withTransaction: (work: Parameters<NonNullable<typeof local.db>["transaction"]>[0]) => local.db!.transaction(work),
}));
vi.mock("../../netlify/functions/lib/services/emailTransport", () => ({ sendTransactionalEmail: local.send,
  sendImmediateTransactionalTemplate: local.immediate }));
vi.mock(import("../../netlify/functions/lib/utils/logger"), async (original) => ({
  ...await original(), logInfo: vi.fn(),
}));

const pg = new PGlite();
const db = drizzle(pg, { schema });
const now = new Date("2026-11-13T01:00:00.000Z");
const today = "2026-11-13";
const origin = "https://moderation.invalid";
const eventId = "00000000-0000-4000-8000-000000000021";
const dayId = "00000000-0000-4000-8000-000000000022";
const adminEmail = "admin@moderation.invalid";
const viewerEmail = "viewer@moderation.invalid";
const publicRegistration = "/events/public/daurah-moderasi/registration";
const institutionLookup = `${publicRegistration}/institutions`;
const asatidz = (suffix: string) => ({
  fullName: `Ustadz Uji ${suffix}`, email: `${suffix}@moderation.invalid`,
  whatsapp: "6281234567890", city: "KOTA BANDUNG", province: "JAWA BARAT",
});
let call = 0;
let ipSuffix = 0;

async function request(path: string, { method = "GET", body, user, query = {} }: {
  method?: string; body?: unknown; user?: string; query?: Record<string, string>;
} = {}) {
  const event: HandlerEvent = {
    path: `/api/v1${path}`, rawUrl: `${origin}/api/v1${path}`, rawQuery: new URLSearchParams(query).toString(),
    httpMethod: method, headers: { origin, host: "moderation.invalid", "sec-fetch-site": "same-origin",
      "client-ip": `192.0.2.${ipSuffix}`, "x-request-id": `moderation-${++call}`,
      ...(user ? { authorization: `Bearer ${createSessionToken(user).sessionId}` } : {}) },
    queryStringParameters: query, multiValueHeaders: {}, multiValueQueryStringParameters: null,
    isBase64Encoded: false, body: body === undefined ? null : JSON.stringify(body),
  };
  const response = await handler(event, {} as HandlerContext, vi.fn());
  if (!response?.body) throw new Error("No response");
  return { status: response.statusCode, headers: response.headers, ...JSON.parse(response.body) };
}

const post = (path: string, body: unknown, user?: string) => request(path, { method: "POST", body, user });
const approve = (id: string) => post(`/events/${eventId}/participants/${id}/approve`, {}, adminEmail);
const card = (token: string) => request("/cards/public", { query: { token } });
const status = (token: string) => post("/confirmations/public/status", { token });
const decide = (token: string, decision: "CONFIRM" | "DECLINE") => post("/confirmations/public/decision", { token, decision });
const portalQr = (id: string, user: string) => request("/portal/qr", { user, query: { participantId: id } });
const gate = (qrTokenOrCode: string, method = "QR_SCAN") =>
  post(`/events/${eventId}/checkin`, { dayId, qrTokenOrCode, method }, adminEmail);
const linkToken = (url: string) => decodeURIComponent(new URL(url, origin).hash.slice(1));
const sentTo = (email: string) => local.send.mock.calls.map(([message]) => message).filter((message) => message.to === email);

async function requestPrivateLink(receipt: string, email: string) {
  const start = local.immediate.mock.calls.length;
  const response = await post("/confirmations/public/link", { token: receipt, email });
  expect(response.status, JSON.stringify(response.error)).toBe(200);
  expect(JSON.stringify(response.data)).not.toMatch(/pcf_|pqr_/);
  const mail = local.immediate.mock.calls.slice(start).map(([message]) => message)
    .find((message) => message.recipientEmail === email);
  expect(mail).toMatchObject({ templateCode: "REGISTRATION_STATUS_ACCESS", recipientEmail: email });
  const token = linkToken(String(mail!.variables.registrationStatusLink));
  expect(token).toMatch(/^pcf_/);
  expect(verifyParticipantConfirmationToken(token)).toMatchObject({ purpose: "PRIVATE_ACCESS" });
  return token;
}

async function register(person: ReturnType<typeof asatidz>, delegates: ReturnType<typeof asatidz>[] = []) {
  const result = await post(publicRegistration, { ...person, delegates, consentConfirmed: true });
  expect(result.status, JSON.stringify(result.error)).toBe(200);
  expect(result.headers["Cache-Control"]).toBe("no-store");
  expect(result.data.emailQueued).toBe(delegates.length + 1);
  expect(JSON.stringify(result.data)).not.toMatch(/pqr_|\/card\?token/);
  for (const person of result.data.participants) {
    expect(person).toMatchObject({ temporaryPassword: null, temporaryPasswordIssued: false });
    expect(linkToken(person.registrationStatusUrl)).toMatch(/^prc_/);
  }
  return result.data.participants as Array<{ participantCode: string; registrationStatusUrl: string; email: string; approvalStatus: string }>;
}

async function findParticipant(code: string) {
  const [row] = await db.select().from(schema.eventParticipants).where(and(eq(schema.eventParticipants.eventId, eventId),
    eq(schema.eventParticipants.participantCode, code))).limit(1);
  expect(row).toBeDefined();
  return row;
}

beforeAll(async () => {
  local.db = db;
  const migrations = join(process.cwd(), "drizzle");
  for (const name of readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(migrations, name), "utf8"));
  }
}, 60_000);

beforeEach(async () => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("APP_URL", origin);
  vi.stubEnv("SESSION_SECRET", "test-only-moderation-session");
  vi.stubEnv("PARTICIPANT_QR_SECRET", "test-only-moderation-qr");
  vi.stubEnv("PARTICIPANT_CONFIRMATION_SECRET", "test-only-moderation-status");
  vi.stubEnv("INVITATION_OTP_SECRET", "test-only-moderation-invitation");
  vi.stubEnv("EMAIL_WORKER_ENABLED", "false");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  ipSuffix++;
  local.send.mockClear();
  local.immediate.mockClear();
  await pg.exec("truncate table events, users, roles, ustadz_profiles, institutions, email_templates cascade");
  const [admin, viewer] = await db.insert(schema.users).values([adminEmail, viewerEmail].map((email) => ({ email, status: "ACTIVE" }))).returning();
  const [adminRole, , viewerRole] = await db.insert(schema.roles).values([{ code: "EVENT_ADMIN", name: "Admin" },
    { code: "USTADZ", name: "Asatidz" }, { code: "REPORT_VIEWER", name: "Laporan" }]).returning();
  await db.insert(schema.events).values({
    id: eventId, slug: "daurah-moderasi", code: "DAURAH-TEST", name: "Daurah Moderasi", timezone: "Asia/Jakarta",
    startDate: today, endDate: "2026-11-15", status: "REGISTRATION_OPEN", audienceMode: "MIXED",
    attendanceConfirmationRequired: true, capacity: 20, regularQuota: 10, invitationQuota: 10,
  });
  await db.insert(schema.userRoleAssignments).values({ userId: admin.id, roleId: adminRole.id, eventId });
  await db.insert(schema.userRoleAssignments).values({ userId: viewer.id, roleId: viewerRole.id });
  await db.insert(schema.eventDays).values({ id: dayId, eventId, dayNumber: 1, date: today });
}, 30_000);
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
afterAll(async () => { await pg.close(); local.db = undefined; });

describe("saran lembaga pada pendaftaran reguler", () => {
  const insertInstitution = (fields: Partial<typeof schema.institutions.$inferInsert> = {}) =>
    db.insert(schema.institutions).values({
      code: "MAHAD-A", name: "Ma'had Cahaya", status: "ACTIVE", verificationStatus: "VERIFIED",
      cityCode: "3273", provinceCode: "32", ...fields,
    }).returning();
  const search = (term: string, page = "1") => request(institutionLookup, { query: { search: term, page } });
  const submit = (suffix: string, institution: {
    institutionId?: string; institutionName?: string; institutionProposal?: RegistrationInstitutionProposal;
  }) =>
    post(publicRegistration, { ...asatidz(suffix), consentConfirmed: true, ...institution });

  it("ranks matches and exposes active master records without contacts or pending public proposals", async () => {
    const [exact] = await insertInstitution({ notes: "private-note", phone: "private-phone", address: "private-address" });
    const [partial] = await insertInstitution({ code: "MAHAD-B", name: "Yayasan Ma’had Cahaya",
      cityCode: "private-city", provinceCode: "private-province", email: "private@moderation.invalid" });
    const [staffEntry] = await insertInstitution({ code: "MAHAD-C", name: "Ma'had Cahaya Baru", verificationStatus: "UNVERIFIED" });
    await insertInstitution({ code: "MAHAD-D", name: "Ma'had Cahaya Lama", deletedAt: now });
    await insertInstitution({ code: "MAHAD-E", name: "Ma'had Cahaya Nonaktif", status: "INACTIVE" });
    await insertInstitution({ code: "REG-0123456789ABCDEF", name: "Ma'had Cahaya Menunggu", verificationStatus: "UNVERIFIED" });
    const result = await search("  MAHAD   CAHAYA ");
    expect(result.status).toBe(200);
    expect(result.headers["Cache-Control"]).toBe("no-store");
    expect(result.data).toEqual([
      { id: exact.id, name: "Ma'had Cahaya", region: "KOTA BANDUNG, JAWA BARAT" },
      { id: staffEntry.id, name: "Ma'had Cahaya Baru", region: "KOTA BANDUNG, JAWA BARAT" },
      { id: partial.id, name: "Yayasan Ma’had Cahaya", region: null },
    ]);
    expect((await search("cah mah")).data).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: exact.id }), expect.objectContaining({ id: partial.id }),
    ]));
    expect((await search("private")).data).toEqual([]);
    const selectedStaffEntry = await submit("lembaga-data-induk", { institutionId: staffEntry.id });
    expect(selectedStaffEntry.status, JSON.stringify(selectedStaffEntry.error)).toBe(200);
    expect((await findParticipant(selectedStaffEntry.data.participantCode)).institutionId).toBe(staffEntry.id);
  });

  it("lists the whole catalogue across pages even without a search and gates access on open regular events", async () => {
    const records = await db.insert(schema.institutions).values(Array.from({ length: 23 }, (_, index) => ({
      code: `UJI-${index}`, name: `Lembaga Uji ${index}`, verificationStatus: "VERIFIED",
    }))).returning();
    const first = await request(institutionLookup);
    const next = await search("", "2");
    expect(first.status).toBe(200);
    expect(first.meta).toEqual({ page: 1, pageSize: 20, total: 23, pageCount: 2 });
    expect(first.data).toHaveLength(20);
    expect(next.data).toHaveLength(3);
    expect([...first.data, ...next.data].map((option) => option.id)).toEqual(records.map(({ id }) => id));
    expect((await search("le")).data).toHaveLength(20);
    expect((await search("lembaga", "2")).data).toEqual(next.data);
    expect((await search("lembaga", "0")).status).toBe(422);
    expect((await search("%_   ")).status).toBe(422);
    expect((await search("x".repeat(181))).status).toBe(422);
    await db.update(schema.events).set({ registrationOpenAt: new Date("2026-11-14") }).where(eq(schema.events.id, eventId));
    expect((await search("lembaga")).status).toBe(403);
    await db.update(schema.events).set({ registrationOpenAt: null, audienceMode: "INSTITUTION_INVITATION" }).where(eq(schema.events.id, eventId));
    expect((await search("lembaga")).status).toBe(403);
    await db.update(schema.events).set({ archivedAt: now }).where(eq(schema.events.id, eventId));
    expect((await search("lembaga")).status).toBe(404);
  });

  it("finds acronyms, partial names, spelling variants, and nearby typos in names and regions", async () => {
    const [yts] = await insertInstitution({ name: "Yayasan Tarbiyah Sunnah" });
    const [mahad] = await insertInstitution({ code: "MAHAD-B", name: "Ma’had Al-Hudá", cityCode: "3509", provinceCode: "35" });
    for (const term of ["YTS", "sunnha", "tarbiah bandng", "bandung sunn", "Y T S"]) {
      expect((await search(term)).data[0]?.id).toBe(yts.id);
    }
    for (const term of ["mahad alhuda", "al huda jembr", "mahd huda"]) {
      expect((await search(term)).data[0]?.id).toBe(mahad.id);
    }
    expect((await search("sunnah medan")).data).toEqual([]);
  });

  it("uses the chosen ID for each participant and affiliation, including same name branches", async () => {
    const [bandung] = await insertInstitution();
    const [jember] = await insertInstitution({ code: "MAHAD-B", cityCode: "3509", provinceCode: "35" });
    const options = await search("mahad cahaya");
    expect(options.data).toEqual(expect.arrayContaining([
      { id: bandung.id, name: bandung.name, region: "KOTA BANDUNG, JAWA BARAT" },
      { id: jember.id, name: jember.name, region: "KABUPATEN JEMBER, JAWA TIMUR" },
    ]));
    const result = await post(publicRegistration, {
      ...asatidz("ketua-terpilih"), consentConfirmed: true, institutionId: jember.id, delegates: [asatidz("anggota-terpilih")],
    });
    expect(result.status, JSON.stringify(result.error)).toBe(200);
    const participants = await db.select().from(schema.eventParticipants);
    expect(participants).toHaveLength(2);
    expect(participants.every((person) => person.institutionId === jember.id && person.registrationSource === "DIRECT_PUBLIC")).toBe(true);
    const affiliations = await db.select().from(schema.ustadzInstitutionAffiliations);
    expect(affiliations).toHaveLength(2);
    expect(affiliations.every((item) => item.institutionId === jember.id && !item.verifiedAt && !item.isPrimary)).toBe(true);
    const profiles = await db.select().from(schema.ustadzProfiles)
      .where(inArray(schema.ustadzProfiles.id, participants.map((person) => person.ustadzId)));
    expect(profiles.every((profile) => profile.cityCode === "KOTA BANDUNG" && profile.provinceCode === "JAWA BARAT")).toBe(true);
    expect(await db.select().from(schema.institutions)).toHaveLength(2);
  });

  it("rejects unavailable, pending public or invalid selections without creating any registration", async () => {
    const [archived] = await insertInstitution();
    expect((await search("mahad")).data).toHaveLength(1);
    await db.update(schema.institutions).set({ deletedAt: now }).where(eq(schema.institutions.id, archived.id));
    const [unverified] = await insertInstitution({ code: "REG-0123456789ABCDEF", name: "Ma'had Baru", verificationStatus: "UNVERIFIED" });
    for (const id of [archived.id, unverified.id, eventId]) {
      const result = await submit("lembaga-tidak-tersedia", { institutionId: id });
      expect(result.status).toBe(409);
      expect(result.error.details.reason).toBe("REGISTRATION_INSTITUTION_UNAVAILABLE");
    }
    expect((await submit("id-salah", { institutionId: "no-uuid" })).status).toBe(422);
    expect((await submit("dua-pilihan", { institutionId: unverified.id, institutionName: unverified.name })).status).toBe(422);
    expect(await db.select().from(schema.eventParticipants)).toHaveLength(0);
    expect(await db.select().from(schema.ustadzProfiles)).toHaveLength(0);
    expect(await db.select().from(schema.emailJobs)).toHaveLength(0);
    expect(local.send).not.toHaveBeenCalled();
  });

  it("keeps manual names and optional registration, reusing a match and creating a new name once", async () => {
    const [existing] = await insertInstitution({ name: "Komunitas   Uji Lama", verificationStatus: "UNVERIFIED" });
    expect((await search("komunitas uji")).data[0]?.id).toBe(existing.id);
    const matched = await submit("cocok", { institutionName: "  komunitas uji lama  " });
    expect(matched.status, JSON.stringify(matched.error)).toBe(200);
    expect((await findParticipant(matched.data.participantCode)).institutionId).toBe(existing.id);

    const created = await submit("baru-satu", { institutionName: "  Komunitas    Uji Baru   " });
    const reused = await submit("baru-dua", { institutionName: "KOMUNITAS UJI BARU" });
    expect(created.status, JSON.stringify(created.error)).toBe(200);
    expect(reused.status, JSON.stringify(reused.error)).toBe(200);
    const institutionId = (await findParticipant(created.data.participantCode)).institutionId!;
    expect((await findParticipant(reused.data.participantCode)).institutionId).toBe(institutionId);
    const [community] = await db.select().from(schema.institutions).where(eq(schema.institutions.id, institutionId));
    expect(community).toMatchObject({ name: "Komunitas Uji Baru", institutionType: "COMMUNITY", verificationStatus: "UNVERIFIED" });
    expect(await db.select().from(schema.institutions)).toHaveLength(2);

    const [without] = await register(asatidz("tanpa-lembaga"));
    expect((await findParticipant(without.participantCode)).institutionId).toBeNull();
  });

  it("records a new institution with optional region and publishes the suggestion only after verification", async () => {
    const proposal = { name: "  Lembaga   Uji Baru  ", provinceCode: "35", cityCode: "3509" };
    expect((await submit("wilayah-salah", { institutionProposal: { ...proposal, provinceCode: "32" } })).status).toBe(422);
    expect((await submit("nama-kosong", { institutionProposal: { name: "   ?" } })).status).toBe(422);
    expect(await db.select().from(schema.institutions)).toEqual([]);
    const [existing] = await insertInstitution({ name: "Lembaga Uji Lama", cityCode: "3204" });
    const registered = await submit("usul-satu", { institutionProposal: proposal });
    expect(registered.status, JSON.stringify(registered.error)).toBe(200);
    const id = (await findParticipant(registered.data.participantCode)).institutionId!;
    const [saved] = await db.select().from(schema.institutions).where(eq(schema.institutions.id, id));
    expect(saved).toMatchObject({ name: "Lembaga Uji Baru", cityCode: "3509", provinceCode: "35", verificationStatus: "UNVERIFIED" });
    expect((await search("lembaga uji baru")).data.some((option: { id: string }) => option.id === id)).toBe(false);

    const reused = await submit("usul-sama", { institutionProposal: { ...proposal, name: "LEMBAGA UJI BARU" } });
    expect(reused.status, JSON.stringify(reused.error)).toBe(200);
    expect((await findParticipant(reused.data.participantCode)).institutionId).toBe(id);
    const wrongBranch = await submit("usul-cabang", { institutionProposal: { ...proposal, name: existing.name } });
    expect(wrongBranch.status).toBe(409);
    expect(wrongBranch.error.details.reason).toBe("REGISTRATION_INSTITUTION_AMBIGUOUS");
    expect(await db.select().from(schema.institutions)).toHaveLength(2);

    const stewardEmail = "steward@moderation.invalid";
    const [steward] = await db.insert(schema.users).values({ email: stewardEmail }).returning();
    const [stewardRole] = await db.insert(schema.roles).values({ code: "DATA_STEWARD", name: "Pengelola data" }).returning();
    await db.insert(schema.userRoleAssignments).values({ userId: steward.id, roleId: stewardRole.id });
    const pending = () => request("/institutions", { user: stewardEmail, query: { search: saved.name, verificationStatus: "UNVERIFIED" } });
    const inDirectory = await pending();
    expect(inDirectory.status).toBe(200);
    expect(inDirectory.data).toMatchObject([{ id, verificationStatus: "UNVERIFIED", cityCode: "3509", provinceCode: "35" }]);
    const verify = (user: string) => request(`/institutions/${id}`, { method: "PATCH", user, body: { verificationStatus: "VERIFIED" } });
    expect((await verify(viewerEmail)).status).toBe(403);
    const verified = await verify(stewardEmail);
    expect(verified.status, JSON.stringify(verified.error)).toBe(200);
    expect(verified.data).toMatchObject({ id, verificationStatus: "VERIFIED" });
    expect((await pending()).data).toEqual([]);
    expect((await findParticipant(registered.data.participantCode)).approvalStatus).toBe("PENDING_REVIEW");
    expect((await search("lembaga uji baru")).data[0]).toEqual({
      id, name: "Lembaga Uji Baru", region: "KABUPATEN JEMBER, JAWA TIMUR",
    });
  });

  it("asks the applicant to resolve ambiguous legacy names and does not revive inactive institutions", async () => {
    await insertInstitution();
    await insertInstitution({ code: "MAHAD-B", cityCode: "3509" });
    await insertInstitution({ code: "MAHAD-C", name: "Komunitas Tutup", status: "INACTIVE" });
    const ambiguous = await submit("nama-sama", { institutionName: "MA'HAD CAHAYA" });
    expect(ambiguous.status).toBe(409);
    expect(ambiguous.error.details.reason).toBe("REGISTRATION_INSTITUTION_AMBIGUOUS");
    const inactive = await submit("nama-nonaktif", { institutionName: "Komunitas Tutup" });
    expect(inactive.status).toBe(409);
    expect(inactive.error.details.reason).toBe("REGISTRATION_INSTITUTION_UNAVAILABLE");
    expect(await db.select().from(schema.institutions)).toHaveLength(3);
    expect(await db.select().from(schema.eventParticipants)).toHaveLength(0);
  });
});

describe("registration moderation: receipt → approval → confirmation → Gate QR", () => {
  const setRegularGroup = (allowed: boolean, user = adminEmail) => request(`/events/${eventId}`, {
    method: "PATCH", user, body: { regularAllowGroup: allowed },
  });

  it("restricts policy edits to event managers and exposes the saved value across event reads", async () => {
    expect((await setRegularGroup(false, viewerEmail)).status).toBe(403);
    expect((await setRegularGroup(false)).status).toBe(200);
    const detail = await request(`/events/${eventId}`, { user: adminEmail });
    expect(detail.data.regularAllowGroup).toBe(false);
    expect(detail.data).toMatchObject({ capacity: 20, regularQuota: 10, invitationQuota: 10 });
    const publicDetail = await request("/events/public/daurah-moderasi");
    expect(publicDetail.data.regularAllowGroup).toBe(false);
    const catalog = await request("/events", { user: adminEmail, query: { view: "catalog" } });
    expect(JSON.stringify(catalog.data)).toContain('"regularAllowGroup":false');
    const publicCatalog = await request("/events/public");
    expect(publicCatalog.data.find((item: { slug: string }) => item.slug === "daurah-moderasi").regularAllowGroup).toBe(false);
    // An unrelated partial edit must not re-enable the policy's create default.
    expect((await request(`/events/${eventId}`, { method: "PATCH", user: adminEmail, body: { subtitle: "Diperbarui" } })).status).toBe(200);
    expect((await request("/events/public/daurah-moderasi")).data.regularAllowGroup).toBe(false);
  });

  it("rejects a group payload before writing anyone or sending mail, but accepts multiple separate registrations", async () => {
    await setRegularGroup(false);
    const beforeUsers = await db.select().from(schema.users);
    const rejected = await post(publicRegistration, { ...asatidz("ditolak-ketua"), institutionName: "Lembaga Belum Dikirim",
      delegates: [asatidz("ditolak-anggota")], consentConfirmed: true, regularAllowGroup: true });
    expect(rejected.status).toBe(422);
    expect(rejected.error).toMatchObject({ details: { reason: "REGULAR_GROUP_DISABLED" } });
    expect(await db.select().from(schema.eventParticipants)).toHaveLength(0);
    expect(await db.select().from(schema.ustadzProfiles)).toHaveLength(0);
    expect(await db.select().from(schema.users)).toHaveLength(beforeUsers.length);
    expect(await db.select().from(schema.institutions)).toHaveLength(0);
    expect(await db.select().from(schema.emailJobs)).toHaveLength(0);
    expect(local.send).not.toHaveBeenCalled();
    expect(local.immediate).not.toHaveBeenCalled();
    const [first] = await register(asatidz("sendiri-satu"));
    const [second] = await register(asatidz("sendiri-dua"));
    for (const person of [first, second]) {
      const participant = await findParticipant(person.participantCode);
      expect(participant).toMatchObject({ publicGroupId: null, isDelegationLead: false, approvalStatus: "PENDING_REVIEW" });
      expect((await request(`/portal/groups/${participant.id}`, { user: person.email })).status).toBe(403);
      expect((await status(linkToken(person.registrationStatusUrl))).data).toMatchObject({ stage: "PENDING_REVIEW", qrToken: null });
    }
    expect(await db.select().from(schema.eventParticipants)).toHaveLength(2);
  });

  it("preserves existing group membership, receipts and individual approval/confirmation when grouping is disabled", async () => {
    const [lead, member] = await register(asatidz("lama-ketua"), [asatidz("lama-anggota")]);
    const before = await db.select().from(schema.eventParticipants);
    await setRegularGroup(false);
    expect(await db.select().from(schema.eventParticipants)).toEqual(before);
    const leadRow = await findParticipant(lead.participantCode);
    const group = await request(`/portal/groups/${leadRow.id}`, { user: lead.email });
    expect(group.status, JSON.stringify(group.error)).toBe(200);
    expect(group.data).toMatchObject({ kind: "PUBLIC_GROUP", quota: 2 });
    expect(group.data.members).toHaveLength(2);
    expect((await approve(leadRow.id)).status).toBe(200);
    const privateToken = await requestPrivateLink(linkToken(lead.registrationStatusUrl), lead.email);
    const confirmed = await decide(privateToken, "CONFIRM");
    expect(confirmed.status, JSON.stringify(confirmed.error)).toBe(200);
    expect(confirmed.data.qrToken).toMatch(/^pqr_/);
    expect((await status(linkToken(member.registrationStatusUrl))).data).toMatchObject({ stage: "PENDING_REVIEW", qrToken: null });
    await setRegularGroup(true);
    const next = await register(asatidz("baru-ketua"), [asatidz("baru-anggota")]);
    expect(next).toHaveLength(2);
    expect((await findParticipant(next[0].participantCode)).publicGroupId).not.toBe(leadRow.publicGroupId);
  }, 30_000);

  it("continues to allow institution invitation groups when regular registration is solo-only", async () => {
    await setRegularGroup(false);
    const [institution] = await db.insert(schema.institutions).values({ code: "GROUP", name: "Lembaga Rombongan" }).returning();
    const [invitation] = await db.insert(schema.invitations).values({ eventId, invitationType: "INSTITUTION", invitationNumber: "GROUP-TEST",
      institutionId: institution.id, quota: 2, status: "SENT" }).returning();
    const { rawToken, tokenHash } = generateSecureToken("inv_inst");
    await db.insert(schema.invitationLinks).values({ invitationId: invitation.id, tokenHash, expiresAt: new Date("2026-11-15") });
    const result = await post(`/invitations/public/institution/${rawToken}/response`, {
      responseStatus: "ACCEPTED", isFinal: true,
      delegates: [{ ...asatidz("undangan-ketua"), isLead: true }, { ...asatidz("undangan-anggota"), isLead: false }],
      verificationToken: createInstitutionAccessVerification(invitation.id).verificationToken,
    });
    expect(result.status, JSON.stringify(result.error)).toBe(200);
    expect(result.data.participants).toHaveLength(2);
    expect(result.data.emailQueued).toBe(2);
    const registered = await db.select().from(schema.eventParticipants);
    expect(registered.every(person => person.registrationSource === "INSTITUTION_DELEGATION" && person.publicGroupId === null)).toBe(true);
  });

  it("allows institution code verification on shared Wi-Fi while limiting consecutive invalid guesses", async () => {
    const [institution] = await db.insert(schema.institutions).values({ code: "WIFI", name: "Lembaga Wi-Fi" }).returning();
    const [invitation] = await db.insert(schema.invitations).values({ eventId, invitationType: "INSTITUTION", institutionId: institution.id,
      invitationNumber: "TEST-WIFI", registrationMode: "INDIVIDUAL_SELF", quota: 30, status: "SENT" }).returning();
    const { rawToken, tokenHash } = generateSecureToken("inv_self");
    await db.insert(schema.invitationLinks).values({ invitationId: invitation.id, tokenHash, expiresAt: new Date("2026-11-15") });
    const route = `/invitations/public/institution/${rawToken}/code/verify`;
    const code = getInstitutionAccessCode(invitation.id);
    for (let index = 0; index < 12; index++) {
      const verified = await post(route, { code });
      expect(verified.status, JSON.stringify(verified.error)).toBe(200);
      expect(verified.data.verificationToken).toBeTruthy();
    }
    const incorrect = `${code[0] === "A" ? "B" : "A"}${code.slice(1)}`;
    for (let index = 0; index < 8; index++) expect((await post(route, { code: incorrect })).status).toBe(422);
    expect((await post(route, { code: incorrect })).status).toBe(429);
    expect((await db.select().from(schema.eventParticipants))).toHaveLength(0);
  });

  it("sends only a personal receipt initially, and issues a new credential only after both decisions", async () => {
    const [lead, member] = await register(asatidz("ketua"), [asatidz("anggota")]);
    const row = await findParticipant(lead.participantCode);
    const token = linkToken(lead.registrationStatusUrl);
    const memberToken = linkToken(member.registrationStatusUrl);
    const oldQr = signParticipantQrToken({ participantId: row.id, eventId, version: row.qrTokenVersion });
    expect(token).not.toBe(memberToken);
    expect((await status(token)).data).toMatchObject({ stage: "PENDING_REVIEW", qrToken: null, cardUrl: null, canConfirm: false });
    expect((await card(oldQr)).data).toMatchObject({ opaqueQrToken: null });
    expect((await decide(token, "CONFIRM")).status).toBe(403);
    expect((await gate(lead.participantCode, "MANUAL_CODE")).status).toBe(422);
    expect((await portalQr(row.id, lead.email)).status).toBe(403);
    expect((await processEmailQueueWorker()).processedCount).toBe(0);
    for (const person of [lead, member]) {
      const [email] = sentTo(person.email);
      expect(email.subject).toMatch(/Bukti pendaftaran/);
      expect(email.textBody).toContain("bukan persetujuan panitia");
      expect(email.htmlBody).toContain(new URL(person.registrationStatusUrl, origin).toString());
      expect(email.htmlBody + email.textBody).not.toMatch(/pqr_|\/card\?token|QR Code Presensi/);
    }

    expect((await approve(row.id)).status).toBe(200);
    expect((await status(token)).data).toMatchObject({ stage: "AWAITING_CONFIRMATION", qrToken: null, canConfirm: false, privateAccess: false });
    expect((await request(`/events/${eventId}/participants/${row.id}/share`, { user: adminEmail })).data)
      .toMatchObject({ registrationStatusUrl: lead.registrationStatusUrl, qrToken: null });
    expect((await portalQr(row.id, lead.email)).status).toBe(403);
    expect((await card(oldQr)).status).toBe(422);
    await processEmailQueueWorker();
    expect(sentTo(lead.email).at(-1)?.subject).toMatch(/mohon konfirmasi/);
    expect(sentTo(lead.email).at(-1)?.htmlBody).not.toMatch(/pqr_|\/card\?token/);

    const privateToken = await requestPrivateLink(token, lead.email);
    expect((await status(privateToken)).data).toMatchObject({ stage: "AWAITING_CONFIRMATION", qrToken: null, canConfirm: true, privateAccess: true });
    const confirmed = await decide(privateToken, "CONFIRM");
    expect(confirmed.status, JSON.stringify(confirmed.error)).toBe(200);
    const qr = confirmed.data.qrToken;
    expect(qr).toMatch(/^pqr_/);
    expect(qr).not.toBe(oldQr);
    expect((await portalQr(row.id, lead.email)).data.opaqueQrToken).toBe(qr);
    expect((await card(qr)).data.opaqueQrToken).toBe(qr);
    expect((await status(memberToken)).data).toMatchObject({ stage: "PENDING_REVIEW", qrToken: null });
    expect((await status(qr)).status).toBe(422);
    expect((await gate(oldQr)).status).not.toBe(200);
    expect((await gate(token)).status).not.toBe(200);
    await processEmailQueueWorker();
    expect(sentTo(lead.email).at(-1)?.textBody).toContain("QR presensi tersedia");
    expect(sentTo(lead.email).at(-1)?.htmlBody).not.toContain("pqr_");
    expect((await gate(qr)).status).toBe(200);
    expect((await decide(privateToken, "DECLINE")).status).toBe(409);
    expect((await status(token)).data).toMatchObject({ stage: "READY", qrToken: null, canDecline: false });
  }, 30_000);

  it.each(["INSTITUTION", "INDIVIDUAL"] as const)("applies the same moderation to %s invitations", async (type) => {
    const person = asatidz(type.toLowerCase());
    const [profile] = type === "INDIVIDUAL" ? await db.insert(schema.ustadzProfiles).values({
      fullName: person.fullName, normalizedName: `uji ${type.toLowerCase()}`, email: person.email, profileStatus: "ACTIVE",
    }).returning() : [];
    const [institution] = type === "INSTITUTION" ? await db.insert(schema.institutions).values({ code: "UJI", name: "Lembaga Uji" }).returning() : [];
    const [invitation] = await db.insert(schema.invitations).values({ eventId, invitationType: type, invitationNumber: `TEST-${type}`,
      institutionId: institution?.id, ustadzId: profile?.id, quota: 1, status: "SENT" }).returning();
    const { rawToken, tokenHash } = generateSecureToken(type === "INSTITUTION" ? "inv_inst" : "inv_ind");
    await db.insert(schema.invitationLinks).values({ invitationId: invitation.id, tokenHash, expiresAt: new Date("2026-11-15") });
    const receipt = await post(`/invitations/public/${type.toLowerCase()}/${rawToken}/response`,
      { responseStatus: "ACCEPTED", isFinal: true, delegates: [{ ...person, isLead: true }],
        ...(type === "INSTITUTION" ? { verificationToken: createInstitutionAccessVerification(invitation.id).verificationToken } : {}) });
    expect(receipt.status, JSON.stringify(receipt.error)).toBe(200);
    expect(JSON.stringify(receipt.data)).not.toMatch(/pqr_|\/card\?token/);
    const [participant] = receipt.data.participants;
    expect(receipt.data.emailQueued).toBe(1);
    const token = linkToken(participant.registrationStatusUrl);
    expect(verifyParticipantConfirmationToken(token)).toMatchObject({ participantId: participant.id, eventId, purpose: "RECEIPT" });
    expect((await status(token)).data).toMatchObject({ stage: "PENDING_REVIEW", qrToken: null });
    await processEmailQueueWorker();
    expect(sentTo(person.email)[0]?.htmlBody).toContain(participant.registrationStatusUrl);
    expect(sentTo(person.email)[0]?.htmlBody).not.toContain("pqr_");
    expect((await approve(participant.id)).status).toBe(200);
    expect((await status(token)).data).toMatchObject({ stage: "AWAITING_CONFIRMATION", qrToken: null });
    const privateToken = await requestPrivateLink(token, person.email);
    expect((await decide(privateToken, "DECLINE")).data).toMatchObject({ stage: "INACTIVE", qrToken: null, cancellationKind: "DECLINED" });
    await processEmailQueueWorker();
    expect(sentTo(person.email).map(({ subject }) => subject)).toEqual([
      "Bukti pendaftaran — Daurah Moderasi", "Pendaftaran disetujui — mohon konfirmasi hadir untuk Daurah Moderasi", "Berhalangan hadir tercatat — Daurah Moderasi",
    ]);
  }, 30_000);

  it("rebuilds a legacy receipt safely and cancels a notice for an outdated email address", async () => {
    await db.update(schema.events).set({ attendanceConfirmationRequired: false }).where(eq(schema.events.id, eventId));
    const [person] = await register(asatidz("tanpa-konfirmasi"));
    const participant = await findParticipant(person.participantCode);
    const token = linkToken(person.registrationStatusUrl);
    const [job] = await db.select().from(schema.emailJobs).where(eq(schema.emailJobs.recipientEmail, person.email));
    const oldLink = `${origin}/card?token=pqr_legacy.signature`;
    local.send.mockClear();
    await db.update(schema.emailJobs).set({ status: "QUEUED", lockedAt: null, scheduledAt: now, payload: { templateCode: "REGISTRATION_RECEIVED",
      bodyText: oldLink, variables: { cardLink: oldLink } } }).where(eq(schema.emailJobs.id, job.id));
    expect((await processEmailQueueWorker()).processedCount).toBe(1);
    expect(sentTo(person.email)[0]?.textBody).toContain("bukan persetujuan panitia");
    expect(sentTo(person.email)[0]?.textBody).not.toContain(oldLink);
    expect((await status(token)).data.qrToken).toBeNull();
    expect((await approve(participant.id)).status).toBe(200);
    expect((await status(token)).data).toMatchObject({ stage: "READY", canConfirm: false, qrToken: null });
    const privateToken = await requestPrivateLink(token, person.email);
    const ready = await status(privateToken);
    expect(ready.data).toMatchObject({ stage: "READY", canConfirm: false });
    expect(ready.data.qrToken).toMatch(/^pqr_/);
    const [approvalJob] = await db.select().from(schema.emailJobs).where(eq(schema.emailJobs.idempotencyKey,
      `registration_card_${participant.id}_v2`));
    expect(approvalJob).toBeDefined();
    await db.update(schema.emailJobs).set({ status: "QUEUED", lockedAt: null, scheduledAt: now }).where(eq(schema.emailJobs.id, approvalJob.id));
    await db.update(schema.ustadzProfiles).set({ email: "new-address@moderation.invalid" })
      .where(eq(schema.ustadzProfiles.id, participant.ustadzId));
    const sentCount = sentTo(person.email).length;
    expect((await processEmailQueueWorker()).results).toEqual([expect.objectContaining({ status: "CANCELLED" })]);
    expect(sentTo(person.email)).toHaveLength(sentCount);
    expect((await status(privateToken)).data).toMatchObject({ privateAccess: false, qrToken: null });
  }, 30_000);

  it("keeps waitlisted and withdrawn participants out of presensi and cancels an unsent ready email", async () => {
    await db.update(schema.events).set({ attendanceConfirmationRequired: false }).where(eq(schema.events.id, eventId));
    const [person] = await register(asatidz("daftar-tunggu"));
    const participant = await findParticipant(person.participantCode);
    const token = linkToken(person.registrationStatusUrl);
    const waitlisted = await post(`/events/${eventId}/participants/${participant.id}/waitlist`,
      { reason: "Menunggu ketersediaan tempat" }, adminEmail);
    expect(waitlisted.status, JSON.stringify(waitlisted.error)).toBe(200);
    expect((await status(token)).data).toMatchObject({ stage: "WAITLISTED", qrToken: null, canConfirm: false });
    expect((await gate(person.participantCode, "MANUAL_CODE")).status).toBe(422);
    await processEmailQueueWorker();
    expect((await approve(participant.id)).status).toBe(200);
    const privateToken = await requestPrivateLink(token, person.email);
    const { qrToken } = (await status(privateToken)).data;
    expect(qrToken).toMatch(/^pqr_/);
    const [approvalJob] = await db.select().from(schema.emailJobs).where(eq(schema.emailJobs.idempotencyKey,
      `registration_card_${participant.id}_v2`));
    expect(approvalJob).toBeDefined();
    await db.update(schema.emailJobs).set({ status: "QUEUED", lockedAt: null, scheduledAt: now }).where(eq(schema.emailJobs.id, approvalJob.id));
    expect((await decide(privateToken, "DECLINE")).data).toMatchObject({ stage: "INACTIVE", qrToken: null });
    expect((await card(qrToken)).status).toBe(422);
    expect((await gate(qrToken)).status).toBe(422);
    expect((await processEmailQueueWorker()).results).toEqual(expect.arrayContaining([expect.objectContaining({ status: "CANCELLED" })]));
    expect(sentTo(person.email).map(({ subject }) => subject)).toEqual([
      "Bukti pendaftaran — Daurah Moderasi", "Pendaftaran disetujui — Daurah Moderasi", "Pengunduran diri tercatat — Daurah Moderasi",
    ]);
  }, 30_000);

  it("keeps a late confirmation in review, then issues QR only after renewed approval", async () => {
    await db.update(schema.events).set({ lateConfirmationPolicy: "REVIEW", attendanceConfirmationDeadline: new Date(now.getTime() - 1000) })
      .where(eq(schema.events.id, eventId));
    const [person] = await register(asatidz("terlambat"));
    const participant = await findParticipant(person.participantCode);
    const token = linkToken(person.registrationStatusUrl);
    await processEmailQueueWorker();
    expect((await approve(participant.id)).status).toBe(200);
    const privateToken = await requestPrivateLink(token, person.email);
    const confirmed = await post(`/portal/participations/${participant.id}/confirm`, {}, person.email);
    expect(confirmed.status, JSON.stringify(confirmed.error)).toBe(200);
    expect((await status(token)).data).toMatchObject({ stage: "REVIEWING_CONFIRMATION", qrToken: null });
    await processEmailQueueWorker();
    expect(sentTo(person.email).at(-1)?.textBody).toContain("Konfirmasi perlu ditinjau kembali");
    expect(sentTo(person.email).at(-1)?.textBody).not.toContain("Tunjukkan");
    expect((await approve(participant.id)).status).toBe(200);
    expect((await status(privateToken)).data.qrToken).toMatch(/^pqr_/);
    await processEmailQueueWorker();
    expect(sentTo(person.email).at(-1)?.textBody).toContain("minta tautan pribadi");
  }, 30_000);

  it("does not grant private access by submitting an existing identity's known name and email", async () => {
    const person = asatidz("existing-identity");
    const [owner] = await db.insert(schema.users).values({ email: person.email, passwordHash: "existing-hash-kept", status: "ACTIVE" }).returning();
    const [profile] = await db.insert(schema.ustadzProfiles).values({ fullName: person.fullName,
      normalizedName: "uji existing identity", email: person.email, whatsapp: "628129990001", userId: owner.id, profileStatus: "ACTIVE" }).returning();
    const [receipt] = await register({ ...person, whatsapp: "628129990002" });
    const token = linkToken(receipt.registrationStatusUrl);
    const participant = await findParticipant(receipt.participantCode);
    expect(participant.ustadzId).toBe(profile.id);
    expect((await approve(participant.id)).status).toBe(200);
    expect((await status(token)).data).toMatchObject({ stage: "AWAITING_CONFIRMATION", privateAccess: false, canConfirm: false, qrToken: null });
    expect((await decide(token, "CONFIRM")).status).toBe(403);
    expect((await decide(token, "DECLINE")).status).toBe(403);
    expect((await post("/confirmations/public/link", { token, email: "outsider@moderation.invalid" })).status).toBe(200);
    expect(local.immediate).not.toHaveBeenCalled();
    const request = await post("/confirmations/public/link", { token, email: person.email });
    expect(request.status).toBe(200);
    expect(JSON.stringify(request.data)).not.toMatch(/pcf_|pqr_|password|binding/);
    expect(local.immediate).toHaveBeenCalledWith(expect.objectContaining({ recipientEmail: person.email }));
    const [storedProfile] = await db.select().from(schema.ustadzProfiles).where(eq(schema.ustadzProfiles.id, profile.id));
    expect(storedProfile.whatsapp).toBe("628129990001");
    const [storedUser] = await db.select().from(schema.users).where(eq(schema.users.id, owner.id));
    expect(storedUser.passwordHash).toBe("existing-hash-kept");
  }, 30_000);

  it("denies read-only sharing and never exposes a decision token through the allowed staff share endpoint", async () => {
    const [person] = await register(asatidz("readonly-share"));
    const participant = await findParticipant(person.participantCode);
    await approve(participant.id);
    const path = `/events/${eventId}/participants/${participant.id}/share`;
    expect((await request(path, { user: viewerEmail })).status).toBe(403);
    const shared = await request(path, { user: adminEmail });
    expect(shared.status).toBe(200);
    expect(shared.data).toMatchObject({ qrToken: null, confirmationUrl: null });
    const receipt = linkToken(shared.data.registrationStatusUrl);
    expect(verifyParticipantConfirmationToken(receipt)).toMatchObject({ purpose: "RECEIPT" });
    expect((await decide(receipt, "DECLINE")).status).toBe(403);
    const [unchanged] = await db.select().from(schema.eventParticipants).where(eq(schema.eventParticipants.id, participant.id));
    expect(unchanged.confirmationStatus).toBe("INVITED");
  }, 30_000);

  it("revokes email-only access after QR rotation while preserving the receipt and authenticated portal", async () => {
    const [person] = await register(asatidz("rotate-access"));
    const participant = await findParticipant(person.participantCode);
    const receipt = linkToken(person.registrationStatusUrl);
    await approve(participant.id);
    const privateToken = await requestPrivateLink(receipt, person.email);
    const confirmed = await decide(privateToken, "CONFIRM");
    expect(confirmed.status).toBe(200);
    const oldQr = confirmed.data.qrToken;
    vi.setSystemTime(new Date(now.getTime() + 1000));
    const rotated = await request("/portal/qr/rotate", { method: "POST", user: person.email, query: { participantId: participant.id } });
    expect(rotated.status, JSON.stringify(rotated.error)).toBe(200);
    expect((await card(oldQr)).status).toBe(422);
    expect((await status(privateToken)).data).toMatchObject({ privateAccess: false, canDecline: false, qrToken: null });
    expect((await decide(privateToken, "DECLINE")).status).toBe(403);
    expect((await status(receipt)).data).toMatchObject({ stage: "READY", qrToken: null, canRequestPrivateLink: true });
    const renewed = await requestPrivateLink(receipt, person.email);
    expect(renewed).not.toBe(privateToken);
    const current = await status(renewed);
    expect(current.data.qrToken).toMatch(/^pqr_/);
    expect(current.data.qrToken).not.toBe(oldQr);
    expect((await portalQr(participant.id, person.email)).data.opaqueQrToken).toBe(current.data.qrToken);
    vi.setSystemTime(new Date(now.getTime() + 32 * 60_000));
    expect((await status(renewed)).status).toBe(422);
    expect((await status(receipt)).status).toBe(200);
  }, 30_000);
});
