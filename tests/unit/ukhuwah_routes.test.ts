import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerEvent } from "@netlify/functions";
import type { UserContext } from "../../netlify/functions/lib/middleware/rbac";
const mocks = vi.hoisted(() => ({ listUkhuwahLocations: vi.fn(), getUkhuwahLocation: vi.fn(), saveUkhuwahLocation: vi.fn(), listUkhuwahInstitutions: vi.fn(),
  listUkhuwahReports: vi.fn(), getUkhuwahReport: vi.fn(), saveUkhuwahReport: vi.fn(), submitUkhuwahReport: vi.fn(), moderateUkhuwahReport: vi.fn(), followupUkhuwahReport: vi.fn() }));
vi.mock("../../netlify/functions/lib/services/ukhuwahService", async original => ({ ...await original<typeof import("../../netlify/functions/lib/services/ukhuwahService")>(), ...mocks }));
import { handleUkhuwahRoute } from "../../netlify/functions/lib/routes/ukhuwahRoutes";
const id = "22222222-2222-4222-8222-222222222222";
let index = 0;
const actor = (roleCode: UserContext["assignments"][number]["roleCode"] = "USTADZ"): UserContext => ({ userId: `00000000-0000-4000-8000-${String(++index).padStart(12, "0")}`, email: "test@example.invalid", assignments: [{ roleCode }] });
const request = (path: string, method: string, user: UserContext | null, body?: unknown, query?: Record<string, string>) => handleUkhuwahRoute({ body: body === undefined ? null : JSON.stringify(body), queryStringParameters: query } as HandlerEvent, path, method, user, "test");
beforeEach(() => { vi.clearAllMocks(); Object.values(mocks).forEach(mock => mock.mockResolvedValue({ id })); });
describe("ukhuwah route security and dispatch", () => {
  it("does not intercept unrelated routes", async () => expect(await request("/events", "GET", null)).toBeNull());
  it.each(["/ukhuwah/locations", "/ukhuwah/reports", "/admin/ukhuwah/locations", "/admin/ukhuwah/reports"])("requires authentication for %s", async path => {
    await expect(request(path, "GET", null)).rejects.toMatchObject({ statusCode: 401 });
    Object.values(mocks).forEach(mock => expect(mock).not.toHaveBeenCalled());
  });
  it.each(["EVENT_ADMIN", "INSTITUTION_REPRESENTATIVE", "EVENT_VIEWER", "DATA_STEWARD"] as const)("does not allow %s access", async role => {
    await expect(request("/admin/ukhuwah/reports", "GET", actor(role))).rejects.toMatchObject({ statusCode: 403 });
    await expect(request("/ukhuwah/reports", "GET", actor(role))).rejects.toMatchObject({ statusCode: 403 });
  });
  it("rejects scoped super/system admin", async () => {
    const user = actor("SUPER_ADMIN"); user.assignments[0].eventId = id;
    await expect(request("/admin/ukhuwah/reports", "GET", user)).rejects.toMatchObject({ statusCode: 403 });
  });
  it("member cannot create locations or invoke moderation/followup", async () => {
    for (const [path, method] of [["/ukhuwah/locations", "POST"], [`/ukhuwah/reports/${id}/moderate`, "POST"], [`/ukhuwah/reports/${id}/followup`, "PATCH"]]) expect((await request(path, method, actor(), {}))?.statusCode).toBe(404);
    expect(mocks.saveUkhuwahLocation).not.toHaveBeenCalled(); expect(mocks.moderateUkhuwahReport).not.toHaveBeenCalled();
  });
  it("uses authenticated session and forces my-report scope", async () => {
    const user = actor(); const response = await request("/ukhuwah/my-reports", "GET", user, undefined, { mine: "false", search: "abc" });
    expect(mocks.listUkhuwahReports).toHaveBeenCalledWith(user, false, { mine: "true", search: "abc" });
    expect(response?.headers).toMatchObject({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  });
  it("rejects invalid UUID and malformed JSON before writes", async () => {
    await expect(request("/ukhuwah/reports/not-id", "GET", actor())).rejects.toMatchObject({ statusCode: 422 });
    await expect(handleUkhuwahRoute({ body: "{" } as HandlerEvent, "/ukhuwah/reports", "POST", actor(), "test")).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.saveUkhuwahReport).not.toHaveBeenCalled();
  });
  it("dispatches saved revision submit and admin decisions explicitly", async () => {
    const user = actor(); await request(`/ukhuwah/reports/${id}/submit`, "POST", user, { expectedVersion: 3, reviewed: true });
    expect(mocks.submitUkhuwahReport).toHaveBeenCalledWith(user, false, id, { expectedVersion: 3, reviewed: true }, "test");
    const admin = actor("SYSTEM_ADMIN"); await request(`/admin/ukhuwah/reports/${id}/moderate`, "POST", admin, { expectedVersion: 3, decision: "APPROVED", reason: "Ditinjau" });
    expect(mocks.moderateUkhuwahReport).toHaveBeenCalledWith(admin, id, expect.objectContaining({ decision: "APPROVED" }), "test");
  });
  it("returns created status and rate limits repeated mutations", async () => {
    const user = actor(); expect((await request("/ukhuwah/reports", "POST", user, {}))?.statusCode).toBe(201);
    for (let i = 1; i < 40; i++) await request("/ukhuwah/reports", "POST", user, {});
    expect((await request("/ukhuwah/reports", "POST", user, {}))?.statusCode).toBe(429);
  });
});