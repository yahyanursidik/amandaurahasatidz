import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerEvent } from "@netlify/functions";
import type { UserContext } from "../../netlify/functions/lib/middleware/rbac";
const mocks = vi.hoisted(() => ({ createYtsNote: vi.fn(), getYtsNoteSummaries: vi.fn(), listYtsNotes: vi.fn(), updateYtsNote: vi.fn() }));
vi.mock("../../netlify/functions/lib/services/ustadzNotesService", async original => ({ ...await original<typeof import("../../netlify/functions/lib/services/ustadzNotesService")>(), ...mocks }));
import { handleUstadzNotesRoute } from "../../netlify/functions/lib/routes/ustadzNotesRoutes";
const profileId = "22222222-2222-4222-8222-222222222222", noteId = "33333333-3333-4333-8333-333333333333";
let index = 0;
const actor = (roleCode: UserContext["assignments"][number]["roleCode"] = "SYSTEM_ADMIN"): UserContext => ({ userId: `00000000-0000-4000-8000-${String(++index).padStart(12, "0")}`, email: "test@example.invalid", assignments: [{ roleCode }] });
const request = (path: string, method: string, user: UserContext | null, body?: unknown, query?: Record<string, string>) => handleUstadzNotesRoute({ body: body === undefined ? null : JSON.stringify(body), queryStringParameters: query } as HandlerEvent, path, method, user, "test");
beforeEach(() => { vi.clearAllMocks(); Object.values(mocks).forEach(mock => mock.mockResolvedValue({ id: noteId })); });
describe("guarded YTS note routes", () => {
  it.each(["/ustadz", "/portal/profile", "/admin/ustadz-notes-other", "/ustadz-notes/summary"])("does not intercept %s", async path => expect(await request(path, "GET", null)).toBeNull());
  it.each(["/admin/ustadz-notes/summary", `/admin/ustadz-notes/${profileId}`])("requires login %s", async path => {
    await expect(request(path, "GET", null)).rejects.toMatchObject({ statusCode: 401 }); Object.values(mocks).forEach(mock => expect(mock).not.toHaveBeenCalled());
  });
  it.each(["USTADZ", "DATA_STEWARD", "EVENT_ADMIN", "REPORT_VIEWER"] as const)("rejects %s for reads and writes", async role => {
    await expect(request(`/admin/ustadz-notes/${profileId}`, "GET", actor(role))).rejects.toMatchObject({ statusCode: 403 });
    await expect(request(`/admin/ustadz-notes/${profileId}`, "POST", actor(role), {})).rejects.toMatchObject({ statusCode: 403 });
    Object.values(mocks).forEach(mock => expect(mock).not.toHaveBeenCalled());
  });
  it("denies scoped and expired admin before service dispatch", async () => {
    const user = actor(); user.assignments[0].eventId = noteId;
    await expect(request("/admin/ustadz-notes/summary", "GET", user)).rejects.toMatchObject({ statusCode: 403 });
    user.assignments[0].eventId = null; user.assignments[0].endsAt = new Date("2000-01-01");
    await expect(request("/admin/ustadz-notes/summary", "GET", user)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("dedicated summary response is never cacheable", async () => {
    const user = actor(); const response = await request("/admin/ustadz-notes/summary", "GET", user, undefined, { ids: profileId });
    expect(response?.statusCode).toBe(200); expect(response?.headers).toMatchObject({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    expect(mocks.getYtsNoteSummaries).toHaveBeenCalledWith(user, { ids: profileId });
  });
  it("dispatches create/edit/archive using session identity", async () => {
    const user = actor(); const input = { title: "Uji", body: "Internal", flag: "RED" };
    expect((await request(`/admin/ustadz-notes/${profileId}`, "POST", user, input))?.statusCode).toBe(201);
    expect(mocks.createYtsNote).toHaveBeenCalledWith(user, profileId, input, "test");
    await request(`/admin/ustadz-notes/${profileId}/${noteId}`, "PATCH", user, { ...input, expectedVersion: 2 });
    expect(mocks.updateYtsNote).toHaveBeenCalledWith(user, profileId, noteId, { ...input, expectedVersion: 2 }, "test", false);
    await request(`/admin/ustadz-notes/${profileId}/${noteId}/archive`, "PATCH", user, { expectedVersion: 2, archived: true });
    expect(mocks.updateYtsNote).toHaveBeenLastCalledWith(user, profileId, noteId, { expectedVersion: 2, archived: true }, "test", true);
  });
  it("rejects bad JSON and ids without writes", async () => {
    await expect(request("/admin/ustadz-notes/not-id", "GET", actor())).rejects.toMatchObject({ statusCode: 422 });
    await expect(handleUstadzNotesRoute({ body: "{" } as HandlerEvent, `/admin/ustadz-notes/${profileId}`, "POST", actor(), "test")).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.createYtsNote).not.toHaveBeenCalled();
  });
  it("does not permit DELETE and rate limits edits", async () => {
    expect((await request(`/admin/ustadz-notes/${profileId}/${noteId}`, "DELETE", actor()))?.statusCode).toBe(404);
    const user = actor(); for (let i = 0; i < 40; i++) await request(`/admin/ustadz-notes/${profileId}`, "POST", user, {});
    expect((await request(`/admin/ustadz-notes/${profileId}`, "POST", user, {}))?.statusCode).toBe(429);
  });
});