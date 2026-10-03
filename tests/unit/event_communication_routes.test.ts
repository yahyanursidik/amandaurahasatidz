import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerEvent } from "@netlify/functions";
import type { UserContext } from "../../netlify/functions/lib/middleware/rbac";
import type { RoleCode } from "../../src/config/permissions";

const mocks = vi.hoisted(() => ({
  createAnnouncementService: vi.fn(), getEventAnnouncementsService: vi.fn(),
  listCommunicationInstitutionsService: vi.fn(),
  previewAnnouncementService: vi.fn(), previewSavedAnnouncementService: vi.fn(),
  publishAnnouncementService: vi.fn(), unpublishAnnouncementService: vi.fn(), updateAnnouncementService: vi.fn(),
  listCommunicationTemplatesService: vi.fn(), saveCommunicationTemplateService: vi.fn(), archiveCommunicationTemplateService: vi.fn(),
}));
vi.mock("../../netlify/functions/lib/services/announcementService", () => mocks);
vi.mock("../../netlify/functions/lib/services/communicationTemplateService", () => mocks);
import { handleCommunicationRoute } from "../../netlify/functions/lib/routes/communicationRoutes";

const eventId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const root = `/events/${eventId}`;
const revision = "2026-10-03T00:00:00.000Z";
const content = { title: "Info peserta", body: "Isi pengumuman peserta", emailSubject: "Subjek khusus", sendEmailNotification: true };
function actor(roleCode: RoleCode, scope: string | null = eventId): UserContext {
  return { userId: id, email: "unit@example.invalid", assignments: [{ roleCode, eventId: scope }] };
}
function request(suffix: string, method: string, session: UserContext | null, body?: unknown) {
  return handleCommunicationRoute({ body: body === undefined ? null : JSON.stringify(body) } as HandlerEvent,
    `${root}/${suffix}`, method, session, "communication-route-test");
}
beforeEach(() => {
  vi.clearAllMocks();
  Object.values(mocks).forEach((mock) => mock.mockResolvedValue({ id }));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network disabled in route tests"); }));
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("communication routes authentication and event scope", () => {
  it("leaves unrelated routes to other modules", async () => {
    expect(await handleCommunicationRoute({} as HandlerEvent, "/portal/announcements", "GET", null, "test")).toBeNull();
  });
  it.each(["announcements", "communication-templates", `announcements/${id}/preview`])("requires authentication: %s", async (suffix) => {
    await expect(request(suffix, suffix.endsWith("preview") ? "POST" : "GET", null)).rejects.toMatchObject({ statusCode: 401 });
    Object.values(mocks).forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });
  it.each(["USTADZ", "INSTITUTION_REPRESENTATIVE", "CHECKIN_OFFICER"] as const)("denies %s access to draft/recipient admin APIs", async (role) => {
    await expect(request("announcements", "GET", actor(role))).rejects.toMatchObject({ statusCode: 403 });
    await expect(request(`announcements/${id}/preview`, "POST", actor(role))).rejects.toMatchObject({ statusCode: 403 });
    Object.values(mocks).forEach((mock) => expect(mock).not.toHaveBeenCalled());
  });
  it.each([null, id])("denies event admin with missing/wrong assignment: %s", async (scope) => {
    await expect(request("announcements", "GET", actor("EVENT_ADMIN", scope))).rejects.toMatchObject({ statusCode: 403 });
  });
  it("denies expired event assignments", async () => {
    const session = actor("EVENT_ADMIN"); session.assignments[0].endsAt = new Date("2000-01-01");
    await expect(request("communication-templates", "GET", session)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("permits a dual-role staff member using only their valid staff assignment", async () => {
    const session = actor("USTADZ", null); session.assignments.push({ roleCode: "EVENT_ADMIN", eventId });
    expect((await request("announcements", "GET", session))?.statusCode).toBe(200);
    expect(mocks.getEventAnnouncementsService).toHaveBeenCalledWith(eventId);
  });
  it("allows information officer drafting but not publishing", async () => {
    const session = actor("INFORMATION_OFFICER");
    const response = await request("announcements", "POST", session, { ...content, eventId: id });
    expect(response?.statusCode).toBe(200);
    expect(mocks.createAnnouncementService).toHaveBeenCalledWith(expect.objectContaining({ ...content, eventId }), id, "communication-route-test");
    await expect(request(`announcements/${id}/publish`, "POST", session, { expectedUpdatedAt: revision })).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.publishAnnouncementService).not.toHaveBeenCalled();
  });
  it("passes the reviewed revision, scoped id and actor to publishing", async () => {
    const response = await request(`announcements/${id}/publish`, "POST", actor("COMMITTEE_LEAD"), { expectedUpdatedAt: revision, sendEmailNotification: true });
    expect(response?.statusCode).toBe(200);
    expect(response?.headers).toMatchObject({ "Cache-Control": "no-store" });
    expect(mocks.publishAnnouncementService).toHaveBeenCalledWith(eventId, id, true, id, "communication-route-test", revision);
  });
  it("routes saved preview through staff read permission", async () => {
    await request(`announcements/${id}/preview`, "POST", actor("EVENT_VIEWER"));
    expect(mocks.previewSavedAnnouncementService).toHaveBeenCalledWith(eventId, id);
    await expect(request("announcements/preview", "POST", actor("EVENT_VIEWER"), content)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("lists event institutions without granting access to the global directory", async () => {
    const response = await request("announcements/institutions", "GET", actor("INFORMATION_OFFICER"));
    expect(response?.statusCode).toBe(200);
    expect(mocks.listCommunicationInstitutionsService).toHaveBeenCalledWith(eventId);
    await expect(request("announcements/institutions", "GET", actor("USTADZ"))).rejects.toMatchObject({ statusCode: 403 });
  });
  it("saves and archives event-scoped templates", async () => {
    const session = actor("EVENT_ADMIN");
    await request("communication-templates", "POST", session, { ...content, name: "Template acara" });
    expect(mocks.saveCommunicationTemplateService).toHaveBeenCalledWith(eventId, null,
      expect.objectContaining({ name: "Template acara", category: "CUSTOM" }), id, "communication-route-test");
    await request(`communication-templates/${id}`, "PATCH", session, { name: "Template diperbarui" });
    expect(mocks.saveCommunicationTemplateService).toHaveBeenLastCalledWith(eventId, id, { name: "Template diperbarui" }, id, "communication-route-test");
    await request(`communication-templates/${id}`, "DELETE", session);
    expect(mocks.archiveCommunicationTemplateService).toHaveBeenCalledWith(eventId, id, id, "communication-route-test");
  });
  it("rejects malformed JSON before mutations", async () => {
    await expect(handleCommunicationRoute({ body: "{" } as HandlerEvent, `${root}/announcements`, "POST", actor("EVENT_ADMIN"), "test")).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.createAnnouncementService).not.toHaveBeenCalled();
  });
  it.each(["announcements/not-uuid/preview", "communication-templates/not-uuid"])("rejects malformed resource ids: %s", async (suffix) => {
    await expect(request(suffix, suffix.endsWith("preview") ? "POST" : "PATCH", actor("EVENT_ADMIN"), content)).rejects.toMatchObject({ statusCode: 422 });
  });
});