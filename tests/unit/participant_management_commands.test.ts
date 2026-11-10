import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ find: vi.fn(), approval: vi.fn(), status: vi.fn(), replace: vi.fn(), options: vi.fn(), audit: vi.fn() }));
vi.mock("../../netlify/functions/lib/repositories/participantRepository", () => ({
  findParticipantByIdRepository: mocks.find, updateParticipantApprovalStatusRepository: mocks.approval,
  updateParticipantStatusRepository: mocks.status, replaceParticipantTxRepository: mocks.replace,
  findReplacementCandidatesRepository: mocks.options,
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));
import { cancelParticipantService, declineParticipantService, waitlistParticipantService, replaceParticipantService,
  getParticipantReplacementOptionsService, updateParticipantStatusService } from "../../netlify/functions/lib/services/participantService";
import { waitlistParticipantSchema, declineParticipantSchema, cancelParticipantSchema } from "../../netlify/functions/lib/validations/participantValidation";
const eventId = "11111111-1111-4111-8111-111111111111", other = "22222222-2222-4222-8222-222222222222";
const participant = { id: "participant", eventId, confirmationStatus: "CONFIRMED", approvalStatus: "PENDING_REVIEW" };
beforeEach(() => { vi.resetAllMocks(); mocks.find.mockResolvedValue(participant);
  mocks.approval.mockResolvedValue(participant); mocks.status.mockResolvedValue(participant);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No network in command tests"); })); });
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("scope dan integritas command peserta", () => {
  it.each([cancelParticipantService, declineParticipantService, waitlistParticipantService])("menolak command lintas event sebelum mutasi", async (action) => {
    await expect(action(participant.id, "Alasan", "actor", "request", other)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.approval).not.toHaveBeenCalled(); expect(mocks.status).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("memeriksa scope sebelum penggantian dan pencarian kandidat", async () => {
    await expect(replaceParticipantService(participant.id, "ustadz", "Alasan", "actor", "request", other)).rejects.toMatchObject({ statusCode: 404 });
    await expect(getParticipantReplacementOptionsService(other, participant.id, "Ahmad")).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.replace).not.toHaveBeenCalled(); expect(mocks.options).not.toHaveBeenCalled();
  });
  it.each(["CANCELLED", "REPLACED"])("tidak mengaktifkan command peserta %s", async (confirmationStatus) => {
    mocks.find.mockResolvedValue({ ...participant, confirmationStatus });
    await expect(waitlistParticipantService(participant.id, "Alasan", "actor", "request", eventId)).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.approval).not.toHaveBeenCalled();
  });
  it("menggunakan status penolakan konsisten dan mencatat aktor/alasan", async () => {
    await declineParticipantService(participant.id, "Dokumen belum sesuai", "actor", "request", eventId);
    expect(mocks.approval).toHaveBeenCalledWith(participant.id, "DECLINED", "Dokumen belum sesuai", "actor");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "PARTICIPANT_DECLINED", eventId }));
  });
  it("pembatalan idempoten tanpa menulis riwayat dua kali", async () => {
    mocks.find.mockResolvedValue({ ...participant, confirmationStatus: "CANCELLED" });
    expect((await cancelParticipantService(participant.id, "Alasan", "actor", "request", eventId)).confirmationStatus).toBe("CANCELLED");
    expect(mocks.status).not.toHaveBeenCalled(); expect(mocks.audit).not.toHaveBeenCalled();
  });
  it.each(["APPROVED", "WAITLISTED", "REJECTED", "REPLACED"])("PATCH status umum tidak dapat menyisipkan %s", async (status) => {
    await expect(updateParticipantStatusService(participant.id, status, "Alasan", "actor", "request", eventId)).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.status).not.toHaveBeenCalled();
  });
  it("menolak alasan kosong/spasi dan membatasi panjang alasan", () => {
    for (const schema of [waitlistParticipantSchema, declineParticipantSchema, cancelParticipantSchema]) {
      expect(schema.safeParse({ reason: "  " }).success).toBe(false);
      expect(schema.safeParse({ reason: "x".repeat(1001) }).success).toBe(false);
      expect(schema.parse({ reason: "  Alasan perubahan  " }).reason).toBe("Alasan perubahan");
    }
  });
});
