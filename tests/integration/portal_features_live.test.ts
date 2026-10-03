import { randomBytes, randomUUID } from "node:crypto";
import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { handler } from "../../netlify/functions/api";
import { hashPassword } from "../../netlify/functions/lib/utils/password";
import { INDONESIA_REGENCIES } from "../../src/lib/indonesiaRegionData";

// Lead-operated only. Ordinary tests do not open a DB connection or emit email.
const suite = process.env.RUN_PORTAL_FEATURES_LIVE === "1" ? describe : describe.skip;
suite("isolated staging portal features, real Neon HTTP and login cookies", () => {
  const runId = `portal-live-${randomUUID()}`;
  const password = randomBytes(24).toString("hex");
  const actors = ["owner", "other", "staff"].map((label) => ({ id: randomUUID(), profileId: randomUUID(), participantId: randomUUID(), email: `${runId}-${label}@integration.invalid` }));
  const eventId = randomUUID(), dayId = randomUUID(), sessionId = randomUUID();
  let sql: NeonQueryFunction<false, false>;
  let initialized = false;
  const cookies: string[] = [];
  async function request(path: string, method = "GET", actor?: number, body?: unknown, query: Record<string, string> | null = null) {
    const response = await handler({ path: `/api/v1${path}`, rawUrl: `http://integration.invalid/api/v1${path}`, rawQuery: "", httpMethod: method,
      headers: { "x-request-id": runId, ...(actor === undefined ? {} : { cookie: cookies[actor] }) }, multiValueHeaders: {},
      queryStringParameters: query, multiValueQueryStringParameters: null, body: body === undefined ? null : JSON.stringify(body), isBase64Encoded: false,
    } as HandlerEvent, {} as HandlerContext, () => undefined);
    if (!response || typeof response.body !== "string") throw new Error("Expected JSON API response");
    return { ...response, json: JSON.parse(response.body) };
  }
  beforeAll(async () => {
    const url = process.env.DATABASE_URL;
    if (!url || process.env.PORTAL_TEST_DATABASE_HOST !== new URL(url).hostname || process.env.PORTAL_TEST_ISOLATED_BRANCH !== "1") {
      throw new Error("Requires DATABASE_URL, PORTAL_TEST_DATABASE_HOST exact hostname, PORTAL_TEST_ISOLATED_BRANCH=1; isolated staging only.");
    }
    if (process.env.CONTEXT === "production") throw new Error("Refusing production context.");
    sql = neon(url);
    const roles = await sql`SELECT id, code FROM roles WHERE code IN ('USTADZ', 'EVENT_ADMIN')`;
    expect(roles).toHaveLength(2);
    // Force real database identity refresh, use temporary secrets and disable providers.
    vi.stubEnv("APP_ENV", "production"); vi.stubEnv("SESSION_SECRET", randomBytes(32).toString("hex"));
    vi.stubEnv("EMAIL_TRANSPORT", "mock"); vi.stubEnv("MAILKETING_API_TOKEN", ""); vi.stubEnv("SMTP_HOST", "");
    initialized = true;
    const passwordHash = hashPassword(password);
    await sql.transaction(actors.map((a) => sql`INSERT INTO users (id,email,name,password_hash,status)
      VALUES (${a.id}::uuid,${a.email},'Integration Original',${passwordHash},'ACTIVE')`));
    await sql`INSERT INTO events (id,code,slug,name,start_date,end_date,status,attendance_confirmation_required)
      VALUES (${eventId}::uuid,${runId},${runId},${runId},CURRENT_DATE,CURRENT_DATE,'ONGOING',true)`;
    await sql.transaction(actors.map((a, i) => sql`INSERT INTO user_role_assignments (user_id,role_id,event_id)
      VALUES (${a.id}::uuid,${roles.find((r) => r.code === (i === 2 ? 'EVENT_ADMIN' : 'USTADZ'))!.id}::uuid,${i === 2 ? eventId : null}::uuid)`));
    await sql.transaction(actors.slice(0, 2).flatMap((a) => [
      sql`INSERT INTO ustadz_profiles (id,user_id,full_name,normalized_name,email)
        VALUES (${a.profileId}::uuid,${a.id}::uuid,'Integration Original','integration original',${a.email})`,
      sql`INSERT INTO event_participants (id,event_id,ustadz_id,participant_code,confirmation_status,approval_status)
        VALUES (${a.participantId}::uuid,${eventId}::uuid,${a.profileId}::uuid,${`${runId}-${a.id}`},'CONFIRMED','APPROVED')`,
    ]));
    await sql`INSERT INTO event_days (id,event_id,day_number,date,title) VALUES (${dayId}::uuid,${eventId}::uuid,1,CURRENT_DATE,'Integration Day')`;
    await sql`INSERT INTO event_sessions (id,event_day_id,title,start_at,end_at)
      VALUES (${sessionId}::uuid,${dayId}::uuid,'Integration Session',now(),now()+interval '1 hour')`;
    for (let i = 0; i < actors.length; i++) {
      const login = await request("/auth/password/login", "POST", undefined, { email: actors[i].email, password, portal: i === 2 ? "admin" : "ustadz" });
      expect(login.statusCode, login.json.error?.message).toBe(200);
      const cookie = login.multiValueHeaders?.["Set-Cookie"]?.[0] || login.headers?.["Set-Cookie"];
      expect(cookie).toBeTruthy(); cookies[i] = String(cookie).split(";")[0];
    }
  }, 120000);
  afterAll(async () => {
    try {
      if (initialized) {
        const ids = actors.map((a) => a.id), profiles = actors.slice(0, 2).map((a) => a.profileId);
        await sql.transaction([
          sql`DELETE FROM audit_logs WHERE request_id=${runId} OR actor_user_id=ANY(${ids}::uuid[])`,
          sql`DELETE FROM email_jobs WHERE event_id=${eventId}::uuid`,
          sql`DELETE FROM checkin_logs WHERE event_id=${eventId}::uuid`,
          sql`DELETE FROM announcement_recipients r USING event_announcements a
            WHERE r.announcement_id=a.id AND a.event_id=${eventId}::uuid`,
          sql`DELETE FROM event_announcements WHERE event_id=${eventId}::uuid`,
          sql`DELETE FROM event_communication_templates WHERE event_id=${eventId}::uuid`,
          sql`DELETE FROM events WHERE id=${eventId}::uuid`,
          sql`DELETE FROM ustadz_profiles WHERE id=ANY(${profiles}::uuid[])`,
          sql`DELETE FROM users WHERE id=ANY(${ids}::uuid[])`,
        ]);
        expect(await sql`SELECT id FROM users WHERE id=ANY(${ids}::uuid[])`).toHaveLength(0);
        expect(await sql`SELECT id FROM events WHERE id=${eventId}::uuid`).toHaveLength(0);
        expect(await sql`SELECT id FROM ustadz_profiles WHERE id=ANY(${profiles}::uuid[])`).toHaveLength(0);
      }
    } finally { vi.unstubAllEnvs(); }
  }, 120000);
  it("updates profile + users.name atomically, contact email never changes login, preserves other actor and restrictions", async () => {
    expect((await request("/portal/profile", "PATCH", undefined, { fullName: "No Login" })).statusCode).toBe(401);
    const region = INDONESIA_REGENCIES.find((r) => r.id === "3273")!;
    const input = { fullName: "Integration Changed", email: `${runId}-contact@integration.invalid`, titlePrefix: "Dr.", titleSuffix: "Lc.",
      birthPlace: "Bandung", birthDate: "1990-01-02", address: "Integration Address", cityCode: region.id, provinceCode: region.provinceId };
    const saved = await request("/portal/profile", "PATCH", 0, input);
    expect(saved.statusCode, saved.json.error?.message).toBe(200);
    expect(saved.json.data).toMatchObject({ ...input, city: region.city, province: region.province, loginEmail: actors[0].email });
    const persisted = await sql`SELECT u.email AS login_email,u.name,p.email AS contact_email,p.full_name,p.city_code,p.province_code
      FROM users u JOIN ustadz_profiles p ON p.user_id=u.id WHERE u.id=${actors[0].id}::uuid`;
    expect(persisted[0]).toMatchObject({ login_email: actors[0].email, name: input.fullName, full_name: input.fullName, contact_email: input.email, city_code: region.id, province_code: region.provinceId });
    expect((await request("/portal/profile", "PATCH", 0, { fullName: "Forbidden", userId: actors[1].id })).statusCode).toBe(422);
    expect((await request("/portal/profile", "PATCH", 0, { profileStatus: "ACTIVE" })).statusCode).toBe(422);
    expect((await request("/portal/profile", "PATCH", 0, { cityCode: "invalid" })).statusCode).toBe(422);
    expect((await request("/portal/overview", "GET", 1)).json.data.profile.fullName).toBe("Integration Original");
    const again = await request("/auth/password/login", "POST", undefined, { email: actors[0].email, password, portal: "ustadz" });
    expect(again.statusCode).toBe(200);
    const overview = await request("/portal/overview", "GET", 0);
    expect(overview.json.data.profile).toMatchObject({ fullName: input.fullName, email: input.email, loginEmail: actors[0].email });
    expect(overview.json.data.participations[0].sessions.some((s: { id: string }) => s.id === sessionId)).toBe(true);
    expect(overview.json.data.participations[0].attendance).toEqual([]);
    const ownQr = await request("/portal/qr", "GET", 0, undefined, { participantId: actors[0].participantId });
    expect(ownQr.statusCode).toBe(200); expect(ownQr.json.data.participantId).toBe(actors[0].participantId);
    expect((await request("/portal/qr", "GET", 0, undefined, { participantId: actors[1].participantId })).statusCode).toBe(404);
    expect((await request("/portal/self-checkin", "POST", 0, { eventId, sessionId, rawLocationQrToken: "loc_qr_forged_never_issued" })).statusCode).toBe(422);
    expect(await sql`SELECT id FROM attendance_records WHERE event_id=${eventId}::uuid`).toHaveLength(0);
  }, 120000);
  it("template CRUD, draft preview and portal publication/read are event-scoped and never enqueue email", async () => {
    const draft = { title: "Integration portal notice", body: "Integration notice for {{ustadzName}}.", audienceType: "ALL_PARTICIPANTS", sendEmailNotification: false };
    const template = await request(`/events/${eventId}/communication-templates`, "POST", 2, { ...draft, name: "Integration Template", category: "CUSTOM" });
    expect(template.statusCode, template.json.error?.message).toBe(200);
    const templateId = template.json.data.id;
    expect((await request(`/events/${eventId}/communication-templates/${templateId}`, "PATCH", 2, { name: "Integration Revised" })).statusCode).toBe(200);
    expect((await request(`/events/${eventId}/announcements`, "GET", 0)).statusCode).toBe(403);
    const created = await request(`/events/${eventId}/announcements`, "POST", 2, draft);
    expect(created.statusCode, created.json.error?.message).toBe(200);
    const announcementId = created.json.data.id;
    expect((await request("/portal/announcements", "GET", 0)).json.data.some((a: { id: string }) => a.id === announcementId)).toBe(false);
    const firstPreview = await request(`/events/${eventId}/announcements/${announcementId}/preview`, "POST", 2, {});
    expect(firstPreview.statusCode).toBe(200);
    const edited = await request(`/events/${eventId}/announcements/${announcementId}`, "PATCH", 2,
      { ...draft, title: "Integration revised notice", body: "Revised integration notice for {{ustadzName}}." });
    expect(edited.statusCode).toBe(200);
    expect((await request(`/events/${eventId}/announcements/${announcementId}/publish`, "POST", 2,
      { sendEmailNotification: false, expectedUpdatedAt: firstPreview.json.data.expectedUpdatedAt })).statusCode).toBe(409);
    const preview = await request(`/events/${eventId}/announcements/${announcementId}/preview`, "POST", 2, {});
    expect(preview.statusCode).toBe(200);
    const published = await request(`/events/${eventId}/announcements/${announcementId}/publish`, "POST", 2,
      { sendEmailNotification: false, expectedUpdatedAt: preview.json.data.expectedUpdatedAt });
    expect(published.statusCode, published.json.error?.message).toBe(200);
    const portal = await request("/portal/announcements", "GET", 0);
    expect(portal.json.data.some((a: { id: string }) => a.id === announcementId)).toBe(true);
    expect((await request(`/portal/announcements/${announcementId}/read`, "POST", 0, {})).statusCode).toBe(200);
    expect((await request("/portal/announcements", "GET", 0)).json.data.find((a: { id: string }) => a.id === announcementId).isRead).toBe(true);
    expect((await request(`/events/${eventId}/announcements/${announcementId}/unpublish`, "POST", 2, {})).statusCode).toBe(200);
    expect((await request(`/events/${eventId}/communication-templates/${templateId}`, "DELETE", 2)).statusCode).toBe(200);
    expect(await sql`SELECT id FROM email_jobs WHERE event_id=${eventId}::uuid`).toHaveLength(0);
  }, 120000);
  it("issues a real dynamic session QR, records only own attendance and exposes own history", async () => {
    const issued = await request(`/events/${eventId}/sessions/${sessionId}/location-qr`, "GET", 2);
    expect(issued.statusCode, issued.json.error?.message).toBe(200);
    expect(issued.json.data.rawToken).toMatch(/^loc_qr_[a-f0-9]{64}$/);
    const checkedIn = await request("/portal/self-checkin", "POST", 0,
      { eventId, sessionId, rawLocationQrToken: issued.json.data.rawToken });
    expect(checkedIn.statusCode, checkedIn.json.error?.message).toBe(200);
    expect(checkedIn.json.data).toMatchObject({ status: "SUCCESS", method: "SELF_SCAN" });
    const rows = await sql`SELECT participant_id,checkin_method FROM attendance_records WHERE event_id=${eventId}::uuid`;
    expect(rows).toHaveLength(1); expect(rows[0]).toMatchObject({ participant_id: actors[0].participantId, checkin_method: "SELF_SCAN" });
    const owner = await request("/portal/overview", "GET", 0), other = await request("/portal/overview", "GET", 1);
    expect(owner.json.data.participations[0].attendance).toHaveLength(1);
    expect(other.json.data.participations[0].attendance).toHaveLength(0);
    expect(await sql`SELECT id FROM email_jobs WHERE event_id=${eventId}::uuid`).toHaveLength(0);
  }, 120000);
});