import { beforeEach, describe, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { hashToken } from "../../netlify/functions/lib/utils/token";
const mocks = vi.hoisted(() => ({ db: vi.fn(), own: vi.fn(), record: vi.fn(), log: vi.fn(), eligible: vi.fn(), units: vi.fn() }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/repositories/portalProfileRepository", async (original) => ({
  ...await original<typeof import("../../netlify/functions/lib/repositories/portalProfileRepository")>(), findOwnPortalProfileRepository: mocks.own,
}));
vi.mock("../../netlify/functions/lib/repositories/attendanceRepository", () => ({ recordCheckinTransactionRepository: mocks.record, recordCheckinLogRepository: mocks.log }));
vi.mock("../../netlify/functions/lib/services/deadlineService", () => ({ assertParticipantEligibleForCheckin: mocks.eligible }));
vi.mock("../../netlify/functions/lib/services/attendanceService", () => ({ getAttendanceCheckinUnitsService: mocks.units }));
import { processSelfCheckinService } from "../../netlify/functions/lib/services/selfCheckinService";
import { getOrGenerateLocationQrTokenService } from "../../netlify/functions/lib/services/dynamicQrService";
const eventId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const userId = "44444444-4444-4444-8444-444444444444";
const rawToken = `loc_qr_${"a".repeat(64)}`;
const dialect = new PgDialect();
let index = 0;
function chain(rows: unknown[]) {
  return { from: vi.fn().mockReturnThis(), innerJoin: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue(rows) };
}
beforeEach(() => { vi.clearAllMocks(); mocks.record.mockResolvedValue({ checkinAt: new Date() }); mocks.units.mockResolvedValue({ units: [{ sessionId, isOpen: true }] }); });
async function attempt(token = rawToken, rows: unknown[][] = [[{ id: "token" }], [{ dayId: "day" }], [{ id: "participant", participantCode: "P-1" }], [{ id: eventId }]]) {
  const profileId = `profile-${++index}`;
  mocks.own.mockResolvedValue({ id: profileId });
  const queries = rows.map(chain);
  const select = vi.fn(); queries.forEach((q) => select.mockReturnValueOnce(q));
  mocks.db.mockReturnValue({ select });
  const result = processSelfCheckinService(profileId, eventId, sessionId, token, userId, "unit");
  return { result, queries };
}
describe("self checkin ownership and bearer token security", () => {
  it("requires actor authentication, not just a profile id", async () => {
    await expect(processSelfCheckinService("profile", eventId, sessionId, rawToken)).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.db).not.toHaveBeenCalled();
  });
  it("rejects stale/another user's supplied profile ID", async () => {
    mocks.own.mockResolvedValue({ id: "own" });
    await expect(processSelfCheckinService("someone-else", eventId, sessionId, rawToken, userId)).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it.each(["loc_qr_forged-but-prefixed", "wrong-token-with-no-prefix"])("rejects arbitrary token even with expected prefix: %s", async (token) => {
    const { result } = await attempt(token, [[]]);
    await expect(result).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledOnce();
  });
  it("queries exact token hash, event/session, validFrom/Until, nonrevocation and actor ownership", async () => {
    const { result, queries } = await attempt();
    expect(await result).toMatchObject({ status: "SUCCESS", participantCode: "P-1" });
    const tokenQuery = dialect.sqlToQuery(queries[0].where.mock.calls[0][0]);
    expect(tokenQuery.params).toContain(hashToken(rawToken));
    expect(tokenQuery.params).toContain(eventId); expect(tokenQuery.params).toContain(sessionId);
    expect(tokenQuery.sql).toContain('"token_hash" =');
    expect(tokenQuery.sql).toContain('"valid_from" <='); expect(tokenQuery.sql).toContain('"valid_until" >');
    expect(tokenQuery.sql).toContain('"revoked_at" is null');
    const participantQuery = dialect.sqlToQuery(queries[2].where.mock.calls[0][0]);
    expect(participantQuery.sql).toContain("candidate.user_id IS NULL");
    expect(participantQuery.params).toContain(userId);
    expect(mocks.eligible).toHaveBeenCalledOnce();
    expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ eventId, sessionId, actorUserId: userId, participantId: "participant", method: "SELF_SCAN" }));
  });
  it("cannot record attendance if session is outside requested event", async () => {
    const { result } = await attempt(rawToken, [[{ id: "token" }], []]);
    await expect(result).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("cannot record attendance for someone not enrolled in the event", async () => {
    const { result } = await attempt(rawToken, [[{ id: "token" }], [{ dayId: "day" }], []]);
    await expect(result).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it.each([{ units: [] }, { units: [{ sessionId, isOpen: false }] }])("denies disabled/out-of-window session self-checkin %j", async ({ units }) => {
    mocks.units.mockResolvedValue({ units });
    const { result } = await attempt();
    await expect(result).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it("preserves approval/confirmation restrictions before attendance writes", async () => {
    mocks.eligible.mockImplementationOnce(() => { throw new Error("not approved"); });
    const { result } = await attempt();
    await expect(result).rejects.toThrow("not approved");
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
describe("dynamic location QR generation", () => {
  it("issues a real bearer token whose exact hash is stored, never fabricates it from hash", async () => {
    const values = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "token-id" }]) });
    mocks.db.mockReturnValue({ select: vi.fn(() => chain([{ id: sessionId }])), insert: vi.fn(() => ({ values })) });
    const result = await getOrGenerateLocationQrTokenService(eventId, sessionId);
    expect(result.rawToken).toMatch(/^loc_qr_[a-f0-9]{64}$/);
    expect(values.mock.calls[0][0]).toMatchObject({ eventId, eventSessionId: sessionId, tokenHash: hashToken(result.rawToken) });
    expect(result.secondsRemaining).toBe(30);
  });
  it("denies cross-event sessions before inserting a location QR", async () => {
    const insert = vi.fn();
    mocks.db.mockReturnValue({ select: vi.fn(() => chain([])), insert });
    await expect(getOrGenerateLocationQrTokenService(eventId, sessionId)).rejects.toMatchObject({ statusCode: 404 });
    expect(insert).not.toHaveBeenCalled();
  });
});