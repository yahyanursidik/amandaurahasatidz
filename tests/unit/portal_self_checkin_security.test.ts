import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "../../netlify/functions/lib/utils/token";
import { ValidationError } from "../../netlify/functions/lib/utils/errors";

const mocks = vi.hoisted(() => ({ record: vi.fn(), log: vi.fn() }));
vi.mock("../../netlify/functions/lib/repositories/attendanceRepository", () => ({
  recordCheckinTransactionRepository: mocks.record,
  recordCheckinLogRepository: mocks.log,
  DuplicateAttendanceError: class extends Error {},
}));

import { processSelfCheckinService } from "../../netlify/functions/lib/services/selfCheckinService";

const eventId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const dayId = "33333333-3333-4333-8333-333333333333";
const actorUserId = "44444444-4444-4444-8444-444444444444";
const rawLocationQrToken = `loc_qr_${"a".repeat(64)}`;
const input = { eventId, sessionId, rawLocationQrToken };

beforeEach(() => {
  mocks.record.mockReset().mockResolvedValue({ participantCode: "P-1", attendanceUnit: { sessionId } });
  mocks.log.mockReset().mockResolvedValue([]);
});

describe("self-check-in request boundary", () => {
  it("requires a signed-in actor before any writes", async () => {
    await expect(processSelfCheckinService(input)).rejects.toMatchObject({ statusCode: 401 });
    expect(mocks.record).not.toHaveBeenCalled();
  });

  it.each([
    { ...input, participantId: dayId }, { ...input, ustadzId: dayId }, { ...input, actorUserId },
    { ...input, dayId }, { ...input, sessionId: undefined },
    { ...input, rawLocationQrToken: "loc_qr_forged" }, { ...input, rawLocationQrToken: "not-a-qr" },
  ])("rejects a forged identity, unit, or credential before persistence", async (body) => {
    await expect(processSelfCheckinService(body, actorUserId)).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.record).not.toHaveBeenCalled();
    expect(mocks.log).not.toHaveBeenCalled();
  });

  it("passes only the server actor, selected unit, and hash to the transaction", async () => {
    await expect(processSelfCheckinService(input, actorUserId, "unit")).resolves.toMatchObject({
      status: "SUCCESS", method: "SELF_SCAN", participantCode: "P-1",
    });
    expect(mocks.record).toHaveBeenCalledWith({
      eventId, sessionId, dayId: undefined, locationTokenHash: hashToken(rawLocationQrToken),
      method: "SELF_SCAN", actorUserId, requestId: "unit",
    });
  });

  it("does not leak the bearer token into failure logs", async () => {
    mocks.record.mockRejectedValueOnce(new ValidationError("QR kedaluwarsa."));
    await expect(processSelfCheckinService(input, actorUserId, "unit")).rejects.toThrow("QR kedaluwarsa.");
    expect(mocks.log).toHaveBeenCalledWith(expect.objectContaining({ eventId, scannedBy: actorUserId, result: "FAILED" }));
    expect(JSON.stringify(mocks.log.mock.calls)).not.toContain(rawLocationQrToken);
  });
});
