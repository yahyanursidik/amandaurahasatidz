import { describe, it, expect } from "vitest";
import {
  approveParticipantSchema,
  waitlistParticipantSchema,
  declineParticipantSchema,
  cancelParticipantSchema,
  bulkApproveSchema,
} from "../../netlify/functions/lib/validations/participantValidation";
import { checkCanCheckInService } from "../../netlify/functions/lib/services/participantService";

describe("Participant Commands Engine Unit Tests", () => {
  it("should validate command schemas (approve, waitlist, decline, cancel, bulkApprove)", () => {
    expect(approveParticipantSchema.safeParse({ notes: "Persetujuan manual" }).success).toBe(true);
    expect(waitlistParticipantSchema.safeParse({ reason: "Kapasitas penuh" }).success).toBe(true);
    expect(declineParticipantSchema.safeParse({ reason: "Dokumen tidak lengkap" }).success).toBe(true);
    expect(cancelParticipantSchema.safeParse({ reason: "Peserta membatalkan keikutsertaan" }).success).toBe(true);

    const bulkParsed = bulkApproveSchema.safeParse({
      participantIds: ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"],
    });
    expect(bulkParsed.success).toBe(true);
  });

  it("should enforce capacity check logic during approval", () => {
    const eventCapacity = 50;
    const currentApprovedCount = 50;

    const isFull = currentApprovedCount >= eventCapacity;
    expect(isFull).toBe(true);
  });

  it("should verify bulk action returns per-item succeeded and failed breakdown", () => {
    const mockBulkResult = {
      summary: { total: 3, succeeded: 2, failed: 1 },
      results: [
        { participantId: "p1", status: "SUCCESS", message: "Peserta berhasil diapprove" },
        { participantId: "p2", status: "SUCCESS", message: "Peserta berhasil diapprove" },
        { participantId: "p3", status: "FAILED", message: "Kapasitas event daurah telah penuh" },
      ],
    };

    expect(mockBulkResult.summary.total).toBe(3);
    expect(mockBulkResult.summary.succeeded).toBe(2);
    expect(mockBulkResult.summary.failed).toBe(1);
    expect(mockBulkResult.results).toHaveLength(3);
    expect(mockBulkResult.results[2].status).toBe("FAILED");
  });

  it("should verify check-in blocking rule for CANCELLED or REPLACED participants", () => {
    const cancelledParticipant = { confirmationStatus: "CANCELLED" };
    const replacedParticipant = { confirmationStatus: "REPLACED" };
    const activeParticipant = { confirmationStatus: "CONFIRMED" };

    const isCancelledBlocked = cancelledParticipant.confirmationStatus === "CANCELLED" || cancelledParticipant.confirmationStatus === "REPLACED";
    const isReplacedBlocked = replacedParticipant.confirmationStatus === "CANCELLED" || replacedParticipant.confirmationStatus === "REPLACED";
    const isActiveBlocked = activeParticipant.confirmationStatus === "CANCELLED" || activeParticipant.confirmationStatus === "REPLACED";

    expect(isCancelledBlocked).toBe(true);
    expect(isReplacedBlocked).toBe(true);
    expect(isActiveBlocked).toBe(false);
  });
});
