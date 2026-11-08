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

  it("membandingkan batas undangan dengan tengah malam zona event, bukan zona server", () => {
    expect(() => validateEventDeadlines({
      startDate: "2027-02-10", timezone: "Asia/Jakarta",
      invitationResponseDeadline: "2027-02-09T18:00:00.000Z",
    })).toThrow(/tidak boleh melewati/i);
    expect(() => validateEventDeadlines({
      startDate: "2027-02-10", timezone: "Asia/Makassar",
      invitationResponseDeadline: "2027-02-09T15:00:00.000Z",
    })).not.toThrow();
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
