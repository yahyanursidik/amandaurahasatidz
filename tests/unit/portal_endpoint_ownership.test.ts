import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
const mocks = vi.hoisted(() => ({ db: vi.fn(), own: vi.fn(), qr: vi.fn(), confirm: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/repositories/portalProfileRepository", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/repositories/portalProfileRepository")>(), findOwnPortalProfileRepository: mocks.own,
}));
vi.mock("../../netlify/functions/lib/services/participantQrService", () => ({ getParticipantQrTokenService: mocks.qr }));
vi.mock("../../netlify/functions/lib/services/participantService", () => ({ updateParticipantStatusService: mocks.confirm }));
import { getPortalParticipantIdsService, getPortalParticipantQrService, getPortalDelegationService, getPortalPublicGroupService, confirmOwnPortalAttendanceService } from "../../netlify/functions/lib/services/portalService";
const userId = "44444444-4444-4444-8444-444444444444";
const dialect = new PgDialect();
function query(rows: unknown[]) {
  return { from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows), limit: vi.fn().mockResolvedValue(rows), then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(rows).then(resolve) };
}
beforeEach(() => { vi.clearAllMocks(); mocks.own.mockResolvedValue({ id: "own-profile" }); mocks.qr.mockResolvedValue({ participantId: "own-participant" }); });
describe("all portal participant endpoints scope to actor ownership", () => {
  it("announcement recipient IDs use DB ownership predicate and not profile contact email", async () => {
    const q = query([{ id: "own-participant" }]); mocks.db.mockReturnValue({ select: vi.fn(() => q) });
    expect(await getPortalParticipantIdsService(userId, "other-contact@example.invalid")).toEqual(["own-participant"]);
    const where = dialect.sqlToQuery(q.where.mock.calls[0][0]);
    expect(where.sql).toContain("candidate.user_id IS NULL"); expect(where.params).toContain(userId);
    expect(where.params).not.toContain("other-contact@example.invalid");
  });
  it("QR refuses another participant ID without generating or mutating its token", async () => {
    const q = query([{ id: "own-participant" }]); mocks.db.mockReturnValue({ select: vi.fn(() => q) });
    await expect(getPortalParticipantQrService(userId, "login@example.invalid", "other-participant")).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.qr).not.toHaveBeenCalled();
    expect(dialect.sqlToQuery(q.where.mock.calls[0][0]).params).toContain(userId);
  });
  it("QR only calls underlying generator for actor's selected participation", async () => {
    mocks.db.mockReturnValue({ select: vi.fn(() => query([{ id: "own-participant" }])) });
    expect(await getPortalParticipantQrService(userId, "login@example.invalid", "own-participant")).toEqual({ participantId: "own-participant" });
    expect(mocks.qr).toHaveBeenCalledExactlyOnceWith("own-participant");
  });
  it.each([getPortalDelegationService, getPortalPublicGroupService])("denies reading other participant's delegation/group", async (service) => {
    const q = query([]); const select = vi.fn(() => q); mocks.db.mockReturnValue({ select });
    await expect(service(userId, "login@example.invalid", "other-participant")).rejects.toBeDefined();
    expect(select).toHaveBeenCalledOnce();
    expect(dialect.sqlToQuery(q.where.mock.calls[0][0]).params).toContain(userId);
  });
  it("does not confirm a participation outside the signed-in profile", async () => {
    const q = query([]); mocks.db.mockReturnValue({ select: vi.fn(() => q) });
    await expect(confirmOwnPortalAttendanceService(userId, "login@example.invalid", "other-participant", "req-test"))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.confirm).not.toHaveBeenCalled();
    expect(dialect.sqlToQuery(q.where.mock.calls[0][0]).params).toContain(userId);
  });
  it("confirms only an eligible owned participation", async () => {
    const select = vi.fn()
      .mockReturnValueOnce(query([{ id: "own-participant", confirmationStatus: "INVITED", approvalStatus: "APPROVED", eventStatus: "PUBLISHED" }]))
      .mockReturnValueOnce(query([{ confirmationStatus: "CONFIRMED", approvalStatus: "APPROVED", confirmedAt: new Date() }]));
    mocks.db.mockReturnValue({ select });
    await confirmOwnPortalAttendanceService(userId, "login@example.invalid", "own-participant", "req-test");
    expect(mocks.confirm).toHaveBeenCalledExactlyOnceWith("own-participant", "CONFIRMED", expect.any(String), userId, "req-test");
  });
  it("refuses confirmation of a cancelled participation", async () => {
    mocks.db.mockReturnValue({ select: vi.fn(() => query([{
      id: "own-participant", confirmationStatus: "CANCELLED", approvalStatus: "APPROVED", eventStatus: "PUBLISHED",
    }])) });
    await expect(confirmOwnPortalAttendanceService(userId, "login@example.invalid", "own-participant", "req-test"))
      .rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.confirm).not.toHaveBeenCalled();
  });
});
