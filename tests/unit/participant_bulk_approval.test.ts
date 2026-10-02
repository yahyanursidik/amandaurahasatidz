import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  findParticipant: vi.fn(), findEvent: vi.fn(), countTotal: vi.fn(), countSource: vi.fn(),
  update: vi.fn(), audit: vi.fn(), db: vi.fn(() => { throw new Error("Unexpected database access"); }),
}));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/repositories/participantRepository", () => ({
  findParticipantsRepository: vi.fn(), findParticipantByIdRepository: mocks.findParticipant,
  countInstitutionParticipantsRepository: vi.fn(), countApprovedParticipantsForEventRepository: mocks.countTotal,
  countApprovedParticipantsBySourceRepository: mocks.countSource,
  updateParticipantStatusRepository: vi.fn(), updateParticipantApprovalStatusRepository: mocks.update,
  replaceParticipantTxRepository: vi.fn(), provisionParticipantPortalAccountRepository: vi.fn(),
}));
vi.mock("../../netlify/functions/lib/repositories/eventRepository", () => ({ findEventByIdRepository: mocks.findEvent }));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));

import { approveParticipantService, bulkApproveParticipantsService } from "../../netlify/functions/lib/services/participantService";
import { bulkApproveSchema } from "../../netlify/functions/lib/validations/participantValidation";
import { NotFoundError, ValidationError } from "../../netlify/functions/lib/utils/errors";

const eventId = "11111111-1111-4111-8111-111111111111";
const otherEventId = "22222222-2222-4222-8222-222222222222";
const actorId = "33333333-3333-4333-8333-333333333333";
const requestId = "bulk-approval-service-test";
const ids = Array.from({ length: 26 }, (_, i) => `aaaaaaaa-aaaa-4aaa-8aaa-${String(i + 1).padStart(12, "0")}`);
const participant = (id = ids[0], changes: Record<string, unknown> = {}) => ({
  id, eventId, confirmationStatus: "CONFIRMED", approvalStatus: "PENDING_REVIEW",
  registrationSource: "DIRECT_PUBLIC", ...changes,
});
const event = (changes: Record<string, unknown> = {}) => ({
  id: eventId, status: "REGISTRATION_OPEN", archivedAt: null,
  capacity: 100, regularQuota: 50, invitationQuota: 50, ...changes,
});
const approve = (id = ids[0]) => approveParticipantService(id, actorId, requestId, "Reviewed", eventId);
const bulk = (participantIds = ids.slice(0, 2)) => bulkApproveParticipantsService(eventId, participantIds, actorId, requestId);

beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.mockImplementation(() => { throw new Error("Unexpected database access"); });
  mocks.findParticipant.mockImplementation(async (id) => participant(id));
  mocks.findEvent.mockResolvedValue(event());
  mocks.countTotal.mockResolvedValue(0);
  mocks.countSource.mockResolvedValue(0);
  mocks.update.mockImplementation(async (id) => participant(id, { approvalStatus: "APPROVED" }));
  mocks.audit.mockResolvedValue(undefined);
});

describe("bulk approval schema and direct-service boundaries", () => {
  it("accepts exactly 25 unique UUIDs, rejecting empty, invalid, oversized and duplicate lists", () => {
    expect(bulkApproveSchema.safeParse({ participantIds: ids.slice(0, 25) }).success).toBe(true);
    for (const participantIds of [[], ["bad-id"], ids, [ids[0], ids[0]], [ids[0], ids[0].toUpperCase()]]) {
      expect(bulkApproveSchema.safeParse({ participantIds }).success).toBe(false);
    }
  });

  it.each([[], ids, [ids[0], ids[0]], [ids[0], ids[0].toUpperCase()]].map((participantIds) => ({ participantIds })))(
    "rejects invalid direct-service batch before reads or writes: $participantIds", async ({ participantIds }) => {
      await expect(bulk(participantIds)).rejects.toBeInstanceOf(ValidationError);
      expect(mocks.findParticipant).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.audit).not.toHaveBeenCalled();
    },
  );

  it("requires a valid event UUID before processing a batch", async () => {
    for (const invalidEventId of ["", "not-a-uuid"]) {
      await expect(bulkApproveParticipantsService(invalidEventId, [ids[0]], actorId, requestId)).rejects.toBeInstanceOf(ValidationError);
    }
    expect(mocks.findParticipant).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });
});

describe("event-scoped single and bulk approval", () => {
  it.each(["PENDING_REVIEW", "APPROVED"])("blocks cross-event %s before any participant mutation or audit", async (approvalStatus) => {
    mocks.findParticipant.mockResolvedValue(participant(ids[0], { eventId: otherEventId, approvalStatus }));
    await expect(approve()).rejects.toBeInstanceOf(NotFoundError);
    expect(mocks.findEvent).not.toHaveBeenCalled();
    expect(mocks.countTotal).not.toHaveBeenCalled();
    expect(mocks.countSource).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    const result = await bulk([ids[0]]);
    expect(result.summary).toEqual({ total: 1, succeeded: 0, failed: 1 });
    expect(result.results[0]).toMatchObject({ participantId: ids[0], status: "FAILED" });
    expect(mocks.update).not.toHaveBeenCalled();
    // Only the attempt summary is audited against the requested event, not the foreign participant.
    expect(mocks.audit).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({
      action: "PARTICIPANTS_BULK_APPROVED", resourceType: "EVENT", resourceId: eventId, eventId,
    }));
  });

  it.each(["CANCELLED", "REPLACED", "REJECTED", "DECLINED"])("blocks inactive confirmation %s even when already approved", async (confirmationStatus) => {
    mocks.findParticipant.mockResolvedValue(participant(ids[0], { confirmationStatus, approvalStatus: "APPROVED" }));
    await expect(approve()).rejects.toBeInstanceOf(ValidationError);
    expect((await bulk([ids[0]])).summary.failed).toBe(1);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalledWith(expect.objectContaining({ action: "PARTICIPANT_APPROVED" }));
  });

  it.each(["REJECTED", "DECLINED", "CANCELLED", "REPLACED"])("does not revive approval status %s", async (approvalStatus) => {
    mocks.findParticipant.mockResolvedValue(participant(ids[0], { approvalStatus }));
    await expect(approve()).rejects.toBeInstanceOf(ValidationError);
    expect((await bulk([ids[0]])).summary.failed).toBe(1);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it.each(["INVITED", "CONFIRMED"])("accepts active %s pending and waitlisted participants", async (confirmationStatus) => {
    mocks.findParticipant.mockImplementation(async (id) => participant(id, {
      confirmationStatus, approvalStatus: id === ids[0] ? "PENDING_REVIEW" : "WAITLISTED",
    }));
    expect((await bulk()).summary).toEqual({ total: 2, succeeded: 2, failed: 0 });
    expect(mocks.update).toHaveBeenCalledTimes(2);
  });

  it("keeps the optional expectedEventId last and preserves unscoped service callers", async () => {
    await approveParticipantService(ids[0], actorId, requestId, "Reviewed");
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith(ids[0], "APPROVED", "Reviewed", actorId);
  });

  it("returns idempotent success at full capacity and quota without a second participant audit", async () => {
    const existing = participant(ids[0], { approvalStatus: "APPROVED" });
    mocks.findParticipant.mockResolvedValue(existing);
    mocks.findEvent.mockResolvedValue(event({ capacity: 0, regularQuota: 0 }));
    expect(await approve()).toBe(existing);
    expect(mocks.audit).not.toHaveBeenCalled();
    expect((await bulk([ids[0]])).summary).toEqual({ total: 1, succeeded: 1, failed: 0 });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.countTotal).not.toHaveBeenCalled();
    expect(mocks.countSource).not.toHaveBeenCalled();
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["missing", null], ["completed", event({ status: "COMPLETED" })],
    ["cancelled", event({ status: "CANCELLED" })], ["archived", event({ status: "ARCHIVED" })],
    ["archived timestamp with stale status", event({ archivedAt: new Date() })],
  ])("rejects %s events for both commands, including idempotent attempts", async (_label, target) => {
    mocks.findEvent.mockResolvedValue(target);
    for (const approvalStatus of ["PENDING_REVIEW", "APPROVED"]) {
      mocks.findParticipant.mockResolvedValue(participant(ids[0], { approvalStatus }));
      await expect(approve()).rejects.toThrow();
      expect((await bulk([ids[0]])).summary.failed).toBe(1);
    }
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.countTotal).not.toHaveBeenCalled();
  });
});

describe("partial results, quotas, capacity and audit", () => {
  it("continues after foreign, missing and repository-failed participants without rolling back success", async () => {
    mocks.findParticipant.mockImplementation(async (id) => {
      if (id === ids[0]) return participant(id, { eventId: otherEventId });
      if (id === ids[1]) return null;
      return participant(id);
    });
    mocks.update.mockImplementation(async (id) => {
      if (id === ids[2]) throw new Error("Write failed");
      return participant(id, { approvalStatus: "APPROVED" });
    });
    const result = await bulk(ids.slice(0, 4));
    expect(result.summary).toEqual({ total: 4, succeeded: 1, failed: 3 });
    expect(result.results.map((r) => r.status)).toEqual(["FAILED", "FAILED", "FAILED", "SUCCESS"]);
    expect(result.results[2].message).toBe("Write failed");
    expect(mocks.update.mock.calls.map((call) => call[0])).toEqual([ids[2], ids[3]]);
  });

  it("rechecks source quotas per item and continues to an available invitation allocation", async () => {
    const records = new Map(ids.slice(0, 4).map((id, index) => [id, participant(id, {
      registrationSource: index === 2 ? "INSTITUTION_DELEGATION" : index === 3 ? "ADMIN_ENTRY" : "DIRECT_PUBLIC",
    })]));
    mocks.findParticipant.mockImplementation(async (id) => records.get(id));
    mocks.findEvent.mockResolvedValue(event({ regularQuota: 1, invitationQuota: 1 }));
    mocks.countSource.mockImplementation(async (_eventId, regular) => [...records.values()].filter((p) =>
      p.approvalStatus === "APPROVED" && (["DIRECT_PUBLIC", "ADMIN_ENTRY"].includes(p.registrationSource) === regular)).length);
    mocks.update.mockImplementation(async (id) => {
      const approved = { ...records.get(id)!, approvalStatus: "APPROVED" };
      records.set(id, approved);
      return approved;
    });
    const result = await bulk(ids.slice(0, 4));
    expect(result.summary).toEqual({ total: 4, succeeded: 2, failed: 2 });
    expect(result.results.map((r) => r.status)).toEqual(["SUCCESS", "FAILED", "SUCCESS", "FAILED"]);
    expect(result.results[1].message).toMatch(/Kuota reguler/);
    expect(mocks.countSource.mock.calls).toEqual([[eventId, true], [eventId, true], [eventId, false], [eventId, true]]);
  });

  it.each([true, false])("rejects exhausted zero %s source quota before writes", async (regular) => {
    mocks.findEvent.mockResolvedValue(event({ regularQuota: 0, invitationQuota: 0 }));
    mocks.findParticipant.mockResolvedValue(participant(ids[0], { registrationSource: regular ? "DIRECT_PUBLIC" : "INSTITUTION_DELEGATION" }));
    expect((await bulk([ids[0]])).summary.failed).toBe(1);
    expect(mocks.countSource).toHaveBeenCalledExactlyOnceWith(eventId, regular);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("rechecks total capacity after each success and reports later failures", async () => {
    mocks.findEvent.mockResolvedValue(event({ capacity: 1 }));
    mocks.countTotal.mockImplementation(async () => mocks.update.mock.calls.length);
    const result = await bulk(ids.slice(0, 3));
    expect(result.summary).toEqual({ total: 3, succeeded: 1, failed: 2 });
    expect(result.results[1].message).toMatch(/Kapasitas/);
    expect(mocks.update).toHaveBeenCalledTimes(1);
  });

  it("treats zero capacity as full rather than unlimited", async () => {
    mocks.findEvent.mockResolvedValue(event({ capacity: 0 }));
    await expect(approve()).rejects.toThrow(/Kapasitas/);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it("preserves null capacity and quota as unlimited", async () => {
    mocks.findEvent.mockResolvedValue(event({ capacity: null, regularQuota: null }));
    expect((await bulk()).summary.succeeded).toBe(2);
    expect(mocks.countTotal).not.toHaveBeenCalled();
    expect(mocks.countSource).not.toHaveBeenCalled();
  });

  it("audits the batch under an EVENT UUID with the IDs, exact results and summary", async () => {
    mocks.findParticipant.mockImplementation(async (id) => id === ids[1] ? null : participant(id));
    const result = await bulk();
    const batchAudit = mocks.audit.mock.calls.find(([input]) => input.action === "PARTICIPANTS_BULK_APPROVED")![0];
    expect(batchAudit).toMatchObject({ actorUserId: actorId, requestId, resourceType: "EVENT", resourceId: eventId, eventId });
    expect(z.string().uuid().safeParse(batchAudit.resourceId).success).toBe(true);
    expect(batchAudit.afterData).toEqual({ participantIds: ids.slice(0, 2), ...result });
    expect(mocks.audit).toHaveBeenCalledTimes(2); // One changed participant, one batch attempt.
    expect(mocks.db).not.toHaveBeenCalled();
  });
});