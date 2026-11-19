import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { handler } from "../../netlify/functions/api";
import * as schema from "../../netlify/functions/lib/db/schema";
import { createSessionToken } from "../../netlify/functions/lib/services/authService";
import { parseRecordingSource } from "../../src/lib/eventRecording";
import { materialSourceError, parseMaterialSource, PDF_PREVIEW_CHUNK_BYTES, PDF_PREVIEW_MAX_BYTES } from "../../src/lib/eventMaterial";

const local = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle<typeof schema>> | undefined }));
vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => {
    if (!local.db) throw new Error("Database uji belum siap.");
    return local.db;
  },
}));
vi.mock(import("../../netlify/functions/lib/utils/logger"), async (original) => ({
  ...await original(), logInfo: vi.fn(),
}));

const pg = new PGlite();
const db = drizzle(pg, { schema });
const eventA = "00000000-0000-4000-8000-000000000011";
const eventB = "00000000-0000-4000-8000-000000000012";
const upcoming = "00000000-0000-4000-8000-000000000013";
const scopedPath = (eventId: string) => `/events/${eventId}/recordings`;
const actors = { manager: "SUPER_ADMIN", coordinator: "EVENT_ADMIN", viewer: "REPORT_VIEWER", asatidz: "USTADZ", other: "USTADZ" } as const;
const actorEmail = (actor: keyof typeof actors) => `${actor}@recordings.invalid`;
const youtube = { title: "Kajian adab", url: "https://youtu.be/M7lc1UVf-VE?si=tracking" };
const drive = { title: "Rekaman daurah", url: "https://drive.google.com/open?id=1A2b3C4d5E6f7G8h9I0j&resourcekey=0-UjiKey", published: true };
const pdf = "https://daurah-assets.s3.ap-southeast-1.amazonaws.com/materi/manasik.pdf";
const materialsPath = (eventId: string) => `/events/${eventId}/materials`;
const portalMaterials = "/portal/materials";
let participantId: string;
let profileId: string;

async function addSession(eventId: string, title: string, date: string) {
  const [day] = await db.insert(schema.eventDays).values({ eventId, dayNumber: 1, date }).returning();
  const [session] = await db.insert(schema.eventSessions).values({
    eventDayId: day.id, title, startAt: new Date(`${date}T01:00:00Z`), endAt: new Date(`${date}T02:00:00Z`),
  }).returning();
  return session;
}

async function request(path: string, actor?: keyof typeof actors, method = "GET", body?: unknown, site = "same-origin", range?: string) {
  const url = `https://recordings.invalid/api/v1${path}`;
  const event: HandlerEvent = {
    path: `/api/v1${path}`, rawUrl: url, rawQuery: "", httpMethod: method,
    headers: { host: "recordings.invalid", "sec-fetch-site": site, ...(range && { range }),
      ...(actor && { cookie: `yts_session=${createSessionToken(actorEmail(actor)).sessionId}` }) },
    multiValueHeaders: {}, queryStringParameters: null, multiValueQueryStringParameters: null,
    body: body === undefined ? null : JSON.stringify(body), isBase64Encoded: false,
  };
  const response = await handler(event, {} as HandlerContext, vi.fn());
  if (!response?.body) throw new Error("API tidak mengembalikan respons.");
  const content = response.isBase64Encoded ? { bytes: Buffer.from(response.body, "base64") } : JSON.parse(response.body);
  return { status: response.statusCode, headers: response.headers, ...content };
}

beforeAll(async () => {
  local.db = db;
  const migrations = join(process.cwd(), "drizzle");
  for (const filename of readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(migrations, filename), "utf8"));
  }
}, 60_000);

beforeEach(async () => {
  vi.stubEnv("APP_ENV", "production");
  vi.stubEnv("SESSION_SECRET", "test-only-event-recording-session");
  await pg.exec("truncate table events, users, roles, ustadz_profiles cascade");
  const roles = await db.insert(schema.roles).values([...new Set(Object.values(actors))].map((code) => ({ code, name: code }))).returning();
  const users = await db.insert(schema.users).values(Object.keys(actors).map((actor) => ({ email: actorEmail(actor as keyof typeof actors) }))).returning();
  await db.insert(schema.userRoleAssignments).values(users.map((user) => {
    const actor = user.email.split("@")[0] as keyof typeof actors;
    return { userId: user.id, roleId: roles.find((role) => role.code === actors[actor])!.id,
      eventId: actor === "coordinator" ? eventA : null };
  }));
  const [owner, other] = await db.insert(schema.ustadzProfiles).values(["asatidz", "other"].map((actor) => ({
    userId: users.find((user) => user.email === actorEmail(actor as "asatidz" | "other"))!.id, fullName: actor, normalizedName: actor,
  }))).returning();
  profileId = owner.id;
  await db.insert(schema.events).values([
    { id: eventA, code: "KAJIAN-A", slug: "kajian-a", name: "Kajian Khusus A", status: "COMPLETED", startDate: "2025-07-01", endDate: "2025-07-02" },
    { id: eventB, code: "DAURAH-B", slug: "daurah-b", name: "Daurah B", status: "ARCHIVED", startDate: "2024-06-01", endDate: "2024-06-01", attendanceConfirmationRequired: false },
    { id: upcoming, code: "KAJIAN-C", slug: "kajian-c", name: "Kajian C", status: "PUBLISHED", startDate: "2099-01-01", endDate: "2099-01-01" },
  ]);
  const [participant] = await db.insert(schema.eventParticipants).values([
    { eventId: eventA, ustadzId: owner.id, participantCode: "P-A", approvalStatus: "APPROVED", confirmationStatus: "CONFIRMED" },
    { eventId: eventB, ustadzId: other.id, participantCode: "P-B", approvalStatus: "APPROVED", confirmationStatus: "INVITED" },
    { eventId: upcoming, ustadzId: owner.id, participantCode: "P-C", approvalStatus: "APPROVED", confirmationStatus: "CONFIRMED" },
  ]).returning();
  participantId = participant.id;
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
afterAll(async () => { await pg.close(); local.db = undefined; });

describe("event recording sharing", () => {
  it("keeps drafts private, restricts changes to the event, and withdraws portal visibility", async () => {
    expect((await request("/portal/recordings")).status).toBe(401);
    expect((await request("/portal/recordings", "manager")).status).toBe(403);
    expect((await request(scopedPath(eventA), "viewer")).status).toBe(403);
    expect((await request(scopedPath(eventB), "coordinator", "POST", drive)).status).toBe(403);
    expect((await request(scopedPath(eventA), "coordinator", "POST", youtube, "same-site")).status).toBe(403);
    const saved = await request(scopedPath(eventA), "coordinator", "POST", youtube);
    expect(saved.status, JSON.stringify(saved.error)).toBe(201);
    expect(saved.data).toMatchObject({ title: youtube.title, url: "https://www.youtube.com/watch?v=M7lc1UVf-VE", published: false });
    const path = `${scopedPath(eventA)}/${saved.data.id}`;
    const publication = { ...youtube, published: true };
    expect((await request(scopedPath(eventA), "coordinator")).data.recordings).toEqual([saved.data]);
    expect((await request("/portal/recordings", "asatidz")).data).toEqual([]);
    expect((await request(`${scopedPath(eventB)}/${saved.data.id}`, "manager", "PATCH", publication)).status).toBe(404);
    expect((await request(path, "coordinator", "PATCH", publication)).status).toBe(200);

    const mine = await request("/portal/recordings", "asatidz");
    expect(mine.headers["Cache-Control"]).toBe("private, no-store");
    expect(mine.data).toEqual([{ id: eventA, name: "Kajian Khusus A", startDate: "2025-07-01", endDate: "2025-07-02",
      recordings: [{ id: saved.data.id, title: youtube.title, url: saved.data.url }] }]);
    expect((await request("/portal/recordings", "other")).data).toEqual([]);
    const publicEvent = await request("/events/public/kajian-a");
    expect(publicEvent.status).toBe(200);
    expect(JSON.stringify(publicEvent.data)).not.toContain(saved.data.url);
    expect((await request(path, "coordinator", "PATCH", { ...publication, published: false })).status).toBe(200);
    expect((await request("/portal/recordings", "asatidz")).data).toEqual([]);
  });

  it("uses the participant's own approval, confirmation and presence across historical events", async () => {
    for (const eventId of [eventA, eventB, upcoming]) {
      const saved = await request(scopedPath(eventId), "manager", "POST", drive);
      expect(saved.status, JSON.stringify(saved.error)).toBe(201);
      expect(saved.data.url).toContain("/view?resourcekey=0-UjiKey");
    }
    await db.insert(schema.eventParticipants).values({ eventId: eventB, ustadzId: profileId, participantCode: "P-B2",
      approvalStatus: "APPROVED", confirmationStatus: "INVITED" });
    const visible = async () => (await request("/portal/recordings", "asatidz")).data.map(({ id }: { id: string }) => id);
    expect(await visible()).toEqual([eventA, eventB]);
    await db.update(schema.eventParticipants).set({ confirmationStatus: "INVITED" }).where(eq(schema.eventParticipants.id, participantId));
    expect(await visible()).toEqual([eventB]);
    await db.insert(schema.attendanceRecords).values({ eventId: eventA, participantId, attendanceStatus: "LATE" });
    expect(await visible()).toEqual([eventA, eventB]);
    for (const changes of [{ confirmationStatus: "REPLACED" }, { confirmationStatus: "CANCELLED" },
      { confirmationStatus: "CONFIRMED", approvalStatus: "PENDING_REVIEW" }]) {
      await db.update(schema.eventParticipants).set(changes).where(eq(schema.eventParticipants.id, participantId));
      expect(await visible()).toEqual([eventB]);
    }
    await db.update(schema.eventParticipants).set({ confirmationStatus: "CONFIRMED", approvalStatus: "APPROVED", cancelledAt: new Date() })
      .where(eq(schema.eventParticipants.id, participantId));
    expect(await visible()).toEqual([eventB]);
    await db.update(schema.ustadzProfiles).set({ profileStatus: "ARCHIVED" }).where(eq(schema.ustadzProfiles.id, profileId));
    expect(await visible()).toEqual([]);
  });

  it("rejects spoofed links and prevents duplicate recordings after URL normalization", async () => {
    expect((await request(scopedPath(eventA), "manager", "POST", { ...youtube, url: "https://youtube.com.evil.invalid/watch?v=M7lc1UVf-VE" })).status).toBe(422);
    const original = await request(scopedPath(eventA), "manager", "POST", youtube);
    expect(original.status).toBe(201);
    expect((await request(scopedPath(eventA), "manager", "POST", { ...youtube, url: original.data.url, published: true })).status).toBe(409);
    const second = await request(scopedPath(eventA), "manager", "POST", drive);
    expect((await request(`${scopedPath(eventA)}/${second.data.id}`, "manager", "PATCH", { ...youtube, published: true })).status).toBe(409);
    expect((await request(scopedPath(eventA), "manager")).data.recordings).toHaveLength(2);
  });
});

describe("materi dan rekaman", () => {
  it("publishes a PDF with two sources and its own session, preserving the legacy video API", async () => {
    const session = await addSession(eventA, "Panduan manasik", "2025-07-01");
    const foreign = await addSession(eventB, "Sesi event lain", "2024-06-01");
    const draft = { title: "Ringkasan manasik", kind: "PDF", sessionId: session.id, urls: [pdf, drive.url] };
    expect((await request(materialsPath(eventA), "coordinator", "POST", { ...draft, sessionId: foreign.id })).status).toBe(422);
    expect((await request(materialsPath(eventB), "coordinator", "POST", { ...draft, sessionId: null })).status).toBe(403);
    const material = await request(materialsPath(eventA), "coordinator", "POST", draft);
    expect(material.status, JSON.stringify(material.error)).toBe(201);
    expect(material.data).toMatchObject({
      kind: "PDF", published: false, session: { id: session.id, title: session.title, date: "2025-07-01" },
      sources: [{ provider: "S3", url: pdf, previewUrl: pdf }, {
        provider: "Google Drive", previewUrl: "https://drive.google.com/file/d/1A2b3C4d5E6f7G8h9I0j/preview?resourcekey=0-UjiKey",
      }],
    });
    const admin = await request(materialsPath(eventA), "coordinator");
    expect(admin.data).toMatchObject({ sessions: [{ id: session.id }], materials: [material.data] });
    expect((await request(portalMaterials, "asatidz")).data).toEqual([]);

    const update = await request(`${materialsPath(eventA)}/${material.data.id}`, "coordinator", "PATCH", { ...draft, published: true });
    expect(update.status, JSON.stringify(update.error)).toBe(200);
    const legacy = await request(scopedPath(eventA), "coordinator", "POST", { ...youtube, published: true });
    expect(legacy.status).toBe(201);
    expect((await request(scopedPath(eventA), "coordinator")).data.recordings).toEqual([legacy.data]);
    expect((await request(`${scopedPath(eventA)}/${material.data.id}`, "coordinator", "PATCH", { ...youtube, published: false })).status).toBe(404);
    const owner = await request(portalMaterials, "asatidz");
    expect(owner.headers["Cache-Control"]).toBe("private, no-store");
    expect(owner.data).toMatchObject([{ id: eventA, materials: [
      { id: material.data.id, kind: "PDF", session: { id: session.id }, completedAt: null },
      { id: legacy.data.id, kind: "VIDEO", session: null, completedAt: null },
    ] }]);
    expect((await request("/portal/recordings", "asatidz")).data[0].recordings).toEqual([
      { id: legacy.data.id, title: legacy.data.title, url: legacy.data.url },
    ]);
    expect((await request(portalMaterials, "other")).data).toEqual([]);

    await db.delete(schema.eventSessions).where(eq(schema.eventSessions.id, session.id));
    const remaining = await request(portalMaterials, "asatidz");
    expect(remaining.data[0].materials.find((item: { id: string }) => item.id === material.data.id)?.session).toBeNull();
  });

  it("stores completion for an eligible account only, with an idempotent mark and undo", async () => {
    const body = { title: "Modul fiqih", kind: "PDF", urls: [pdf], published: true };
    const created = await request(materialsPath(eventA), "manager", "POST", body);
    expect(created.status, JSON.stringify(created.error)).toBe(201);
    const url = `${portalMaterials}/${created.data.id}/completion`;
    expect((await request(url, undefined, "PUT", { completed: true })).status).toBe(401);
    expect((await request(url, "other", "PUT", { completed: true })).status).toBe(404);
    expect((await request(url, "asatidz", "PUT", { completed: true }, "cross-site")).status).toBe(403);
    const completed = await request(url, "asatidz", "PUT", { completed: true });
    expect(completed.status, JSON.stringify(completed.error)).toBe(200);
    expect(typeof completed.data.completedAt).toBe("string");
    expect((await request(url, "asatidz", "PUT", { completed: true })).data).toEqual(completed.data);
    expect((await request(portalMaterials, "asatidz")).data[0].materials[0].completedAt).toBe(completed.data.completedAt);
    const management = `${materialsPath(eventA)}/${created.data.id}`;
    expect((await request(management, "manager", "PATCH", { ...body, published: false })).status).toBe(200);
    expect((await request(url, "asatidz", "PUT", { completed: false })).status).toBe(404);
    expect((await request(management, "manager", "PATCH", body)).status).toBe(200);
    expect((await request(url, "asatidz", "PUT", { completed: false })).data.completedAt).toBeNull();
    expect((await request(url, "asatidz", "PUT", { completed: false })).data.completedAt).toBeNull();
    expect((await request(portalMaterials, "asatidz")).data[0].materials[0].completedAt).toBeNull();
  });

  it("returns PDF ranges only for a scoped admin or an eligible participant with a published source", async () => {
    const material = { title: "Panduan PDF", kind: "PDF", urls: [drive.url, pdf], published: false };
    const created = await request(materialsPath(eventA), "coordinator", "POST", material);
    expect(created.status).toBe(201);
    const admin = `${materialsPath(eventA)}/pdf-preview`;
    const portal = `${portalMaterials}/${created.data.id}/pdf-preview`;
    const open = (path: string, actor: keyof typeof actors | undefined, range = "bytes=0-511", url = pdf) =>
      request(path, actor, "POST", { url }, "same-origin", range);
    const bytes = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(503)]);
    const upstream = vi.fn().mockImplementation(() => new Response(new Uint8Array(bytes), {
      status: 206, headers: { "Content-Type": "application/pdf", "Content-Range": "bytes 0-511/1024", ETag: '"v1"' },
    }));
    vi.stubGlobal("fetch", upstream);

    expect((await open(portal, undefined)).status).toBe(401);
    expect((await open(portal, "asatidz")).status).toBe(404);
    expect((await open(admin, "viewer")).status).toBe(403);
    expect((await open(`${materialsPath(eventB)}/pdf-preview`, "coordinator")).status).toBe(403);
    expect((await open(admin, "coordinator", `bytes=0-${PDF_PREVIEW_CHUNK_BYTES}`)).status).toBe(422);
    expect((await open(admin, "coordinator", "bytes=0-511", "https://unconfigured.invalid/file.pdf")).status).toBe(422);
    expect(upstream).not.toHaveBeenCalled();
    const preview = await open(admin, "coordinator");
    expect(preview.status).toBe(206);
    expect(preview.headers).toMatchObject({ "Content-Type": "application/pdf", "Content-Range": "bytes 0-511/1024",
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ETag: '"v1"' });
    expect(preview.bytes).toEqual(bytes);
    expect(upstream).toHaveBeenLastCalledWith(pdf, expect.objectContaining({ redirect: "error", credentials: "omit",
      headers: expect.objectContaining({ Range: "bytes=0-511" }) }));

    const updated = await request(`${materialsPath(eventA)}/${created.data.id}`, "coordinator", "PATCH", { ...material, published: true });
    expect(updated.status).toBe(200);
    expect((await open(portal, "other")).status).toBe(404);
    expect((await open(portal, "asatidz", "bytes=0-511", pdf.replace("manasik.pdf", "other.pdf"))).status).toBe(404);
    expect(upstream).toHaveBeenCalledTimes(1);
    expect((await open(portal, "asatidz")).bytes).toEqual(bytes);

    upstream.mockResolvedValueOnce(new Response(new Uint8Array(512), { status: 206,
      headers: { "Content-Type": "application/pdf", "Content-Range": "bytes 0-511/1024" } }));
    expect((await open(portal, "asatidz")).status).toBe(502);
    upstream.mockResolvedValueOnce(new Response(new Uint8Array(bytes), { status: 206,
      headers: { "Content-Type": "application/pdf", "Content-Range": `bytes 0-511/${PDF_PREVIEW_MAX_BYTES + 1}` } }));
    expect((await open(portal, "asatidz")).status).toBe(422);
    upstream.mockResolvedValueOnce(new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf" } }));
    expect((await open(portal, "asatidz")).status).toBe(200);
  });

  it("accepts configured storage and rejects duplicates and expiring or untrusted links", async () => {
    vi.stubEnv("MATERIAL_PDF_HOSTS", " materials.example.org, https://invalid.example.org ");
    const base = { title: "Panduan PDF", kind: "PDF", published: false };
    expect((await request(materialsPath(eventA), "coordinator", "POST", { ...base, urls: [pdf, pdf + "?utm=test"] })).status).toBe(422);
    expect((await request(materialsPath(eventA), "coordinator", "POST", { ...base, urls: [pdf + "?X-Amz-Signature=test"] })).status).toBe(422);
    expect((await request(materialsPath(eventA), "coordinator", "POST", { ...base, urls: ["https://spoof.example.org/modul.pdf"] })).status).toBe(422);
    const stored = await request(materialsPath(eventA), "coordinator", "POST", { ...base, urls: ["https://materials.example.org/modul.pdf"] });
    expect(stored.status, JSON.stringify(stored.error)).toBe(201);
    expect(stored.data.sources).toMatchObject([{ provider: "S3", url: "https://materials.example.org/modul.pdf" }]);
    expect((await request(materialsPath(eventA), "coordinator")).data.storageHosts).toEqual(["materials.example.org"]);
    expect(parseMaterialSource("PDF", "https://s3.amazonaws.com/daurah-assets/modul.PDF?versionId=abc#page=2")?.url)
      .toEqual("https://s3.amazonaws.com/daurah-assets/modul.PDF?versionId=abc");
    expect(parseMaterialSource("PDF", "https://s3.amazonaws.com.evil.invalid/daurah-assets/modul.pdf")).toBeNull();
    expect(parseMaterialSource("VIDEO", pdf)).toBeNull();
    expect(parseMaterialSource("PDF", youtube.url)).toBeNull();
    expect(materialSourceError("PDF", pdf + "?X-Amz-Expires=3600")).toContain("kedaluwarsa");
  });
});

describe("recording link formats", () => {
  it.each(["https://youtu.be/M7lc1UVf-VE?si=tracking", "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    "https://m.youtube.com/live/M7lc1UVf-VE", "https://www.youtube.com/shorts/M7lc1UVf-VE",
    "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE"])("builds the same safe YouTube preview from %s", (url) => {
    expect(parseRecordingSource(url)).toEqual({ provider: "YouTube", url: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
      previewUrl: "https://www.youtube-nocookie.com/embed/M7lc1UVf-VE" });
  });
  it("retains the Drive access key in preview and direct links", () => {
    expect(parseRecordingSource(drive.url)).toEqual({ provider: "Google Drive",
      url: "https://drive.google.com/file/d/1A2b3C4d5E6f7G8h9I0j/view?resourcekey=0-UjiKey",
      previewUrl: "https://drive.google.com/file/d/1A2b3C4d5E6f7G8h9I0j/preview?resourcekey=0-UjiKey" });
  });
  it.each(["javascript:alert(1)", "http://youtu.be/M7lc1UVf-VE", "https://www.youtube.com:444/watch?v=M7lc1UVf-VE",
    "https://youtube.com.evil.invalid/watch?v=M7lc1UVf-VE", "https://drive.google.com/drive/folders/1A2b3C4d5E6f7G8h9I0j",
    "https://www.youtube.com/playlist?list=PLfoo", "https://fake:credentials@youtu.be/M7lc1UVf-VE", "<iframe></iframe>"])("rejects unsupported content %s", (url) => {
    expect(parseRecordingSource(url)).toBeNull();
  });
});
