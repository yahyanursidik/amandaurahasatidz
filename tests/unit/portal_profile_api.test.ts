import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
const mocks = vi.hoisted(() => ({ session: vi.fn(), update: vi.fn(), overview: vi.fn(),
  resolve: vi.fn(), checkin: vi.fn(),
  db: vi.fn(() => { throw new Error("Unexpected DB access"); }) }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/services/authService", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/services/authService")>(), getUserSession: mocks.session,
}));
vi.mock("../../netlify/functions/lib/services/portalProfileService", () => ({ updatePortalProfileService: mocks.update }));
vi.mock("../../netlify/functions/lib/services/portalService", () => ({
  getPortalOverviewService: mocks.overview, getPortalParticipantIdsService: vi.fn(), getPortalParticipantQrService: vi.fn(),
  getPortalDelegationService: vi.fn(), getPortalPublicGroupService: vi.fn(), replacePortalDelegationMemberService: vi.fn(),
  resolvePortalUstadzIdService: mocks.resolve,
}));
vi.mock("../../netlify/functions/lib/services/selfCheckinService", () => ({ processSelfCheckinService: mocks.checkin }));
import { handler } from "../../netlify/functions/api";
import { ConflictError, NotFoundError, ValidationError } from "../../netlify/functions/lib/utils/errors";
const actorId = "44444444-4444-4444-8444-444444444444";
const loginEmail = "login@example.invalid";
async function request(method = "PATCH", path = "/portal/profile", body: unknown = { fullName: " Nama Baru ", email: " CONTACT@example.invalid " }) {
  const response = await handler({
    rawUrl: `https://unit.invalid/api/v1${path}`, rawQuery: "", path: `/api/v1${path}`, httpMethod: method,
    headers: { authorization: "Bearer mock", "x-request-id": "profile-api-test" }, multiValueHeaders: {},
    queryStringParameters: null, multiValueQueryStringParameters: null, body: JSON.stringify(body), isBase64Encoded: false,
  } as HandlerEvent, {} as HandlerContext, vi.fn());
  if (!response || typeof response.body !== "string") throw new Error("Expected JSON response");
  return { ...response, json: JSON.parse(response.body) };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "");
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network access"); }));
  mocks.session.mockResolvedValue({ userId: actorId, email: loginEmail, ustadzId: "stale-other-user-id", assignments: [{ roleCode: "USTADZ" }] });
  mocks.update.mockResolvedValue({ id: "own", fullName: "Nama Baru", email: "contact@example.invalid", loginEmail });
  mocks.overview.mockResolvedValue({ profile: { id: "own", email: "contact@example.invalid", loginEmail }, participations: [] });
  mocks.resolve.mockResolvedValue("own-resolved-profile");
  mocks.checkin.mockResolvedValue({ status: "SUCCESS" });
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("portal profile API", () => {
  it("self-checkin ignores stale cached profile id and never uses hardcoded demo fallback", async () => {
    const input = { eventId: actorId, sessionId: "22222222-2222-4222-8222-222222222222", rawLocationQrToken: `loc_qr_${"a".repeat(64)}` };
    expect((await request("POST", "/portal/self-checkin", input)).statusCode).toBe(200);
    expect(mocks.resolve).toHaveBeenCalledExactlyOnceWith(actorId, loginEmail);
    expect(mocks.checkin).toHaveBeenCalledExactlyOnceWith("own-resolved-profile", input.eventId, input.sessionId, input.rawLocationQrToken, actorId, "profile-api-test");
  });
  it("self-checkin rejects unknown spoofed IDs and malformed payload before calling services", async () => {
    expect((await request("POST", "/portal/self-checkin", { ustadzId: "someone-else" })).statusCode).toBe(422);
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.checkin).not.toHaveBeenCalled();
  });
  it.each([["PATCH", "/portal/profile"], ["GET", "/portal/overview"]])("requires authentication for %s %s", async (method, path) => {
    mocks.session.mockResolvedValue(null);
    expect((await request(method, path)).statusCode).toBe(401);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.overview).not.toHaveBeenCalled();
  });
  it("passes actor user ID, not cached profile ID; returns separate contact/login email", async () => {
    const response = await request();
    expect(response.statusCode).toBe(200);
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(actorId, loginEmail, { fullName: "Nama Baru", email: "contact@example.invalid" }, "profile-api-test");
    expect(response.json.data).toMatchObject({ email: "contact@example.invalid", loginEmail });
  });
  it("GET overview includes separate session loginEmail", async () => {
    const response = await request("GET", "/portal/overview");
    expect(response.statusCode).toBe(200);
    expect(mocks.overview).toHaveBeenCalledExactlyOnceWith(actorId, loginEmail);
    expect(response.json.data.profile).toMatchObject({ email: "contact@example.invalid", loginEmail });
  });
  it("accepts empty optional fields as null", async () => {
    expect((await request("PATCH", "/portal/profile", { email: "", birthDate: "", cityCode: "", provinceCode: "", city: "", province: "" })).statusCode).toBe(200);
    expect(mocks.update.mock.calls[0][2]).toEqual({ email: null, birthDate: null, cityCode: null, provinceCode: null, city: null, province: null });
  });
  it.each([{}, { fullName: " " }, { email: "invalid" }, { birthDate: "2000-02-30" }, { birthDate: "9999-01-01" },
    { fullName: "Nama", loginEmail: "other@example.invalid" }, { userId: actorId }, { profileStatus: "ACTIVE" },
    { approvalStatus: "APPROVED" }, { institutionId: actorId }])("rejects invalid/restricted payload before service call %j", async (body) => {
    const response = await request("PATCH", "/portal/profile", body);
    expect(response.statusCode).toBe(422);
    expect(response.json.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([new NotFoundError("No own profile"), new ConflictError("Ownership changed"), new ValidationError("Pilih kabupaten/kota")])("preserves specific service error %s", async (error) => {
    mocks.update.mockRejectedValue(error);
    const response = await request();
    expect(response.statusCode).toBe(error.statusCode);
    expect(response.json.error).toMatchObject({ code: error.code, message: error.message });
  });
});