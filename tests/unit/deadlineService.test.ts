import { describe, expect, it } from "vitest";
import {
  assertAttendanceConfirmationAllowed,
  assertParticipantEligibleForCheckin,
  validateEventDeadlines,
} from "../../netlify/functions/lib/services/deadlineService";

describe("event confirmation deadlines", () => {
  it("rejects an invitation deadline after the event starts", () => {
    expect(() => validateEventDeadlines({
      startDate: "2026-08-10",
      invitationResponseDeadline: "2026-08-11T00:00:00Z",
    })).toThrow(/tidak boleh melewati/i);
  });

  it("routes late confirmations to review when configured", () => {
    const result = assertAttendanceConfirmationAllowed({
      attendanceConfirmationDeadline: "2026-08-01T00:00:00Z",
      lateConfirmationPolicy: "REVIEW",
    }, new Date("2026-08-02T00:00:00Z"));
    expect(result.needsReview).toBe(true);
  });

  it("blocks late confirmations when configured", () => {
    expect(() => assertAttendanceConfirmationAllowed({
      attendanceConfirmationDeadline: "2026-08-01T00:00:00Z",
      lateConfirmationPolicy: "BLOCK",
    }, new Date("2026-08-02T00:00:00Z"))).toThrow(/telah berakhir/i);
  });

  it("requires confirmation and approval before check-in", () => {
    expect(() => assertParticipantEligibleForCheckin(
      { confirmationStatus: "INVITED", approvalStatus: "PENDING_REVIEW" },
      { attendanceConfirmationRequired: true },
    )).toThrow(/belum mengonfirmasi/i);

    expect(() => assertParticipantEligibleForCheckin(
      { confirmationStatus: "CONFIRMED", approvalStatus: "PENDING_REVIEW" },
      { attendanceConfirmationRequired: true },
    )).toThrow(/belum disetujui/i);
  });
});
