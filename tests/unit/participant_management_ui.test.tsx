import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ParticipantManagementDialog } from "../../src/components/participants/ParticipantManagementDialog";
import { availableParticipantCommands, participantStaffPermissions } from "../../src/lib/participantManagement";
const eventId = "event-1";
const participant = { id: "p", name: "Ustadz Ahmad", participantCode: "P-001", confirmationStatus: "CONFIRMED", approvalStatus: "APPROVED" };

describe("aksi peserta mengikuti role, event dan status", () => {
  it("menyediakan empat aksi untuk admin event yang sah", () => {
    const permissions = participantStaffPermissions([{ roleCode: "EVENT_ADMIN", eventId }], eventId);
    expect(availableParticipantCommands(participant, permissions)).toEqual(["waitlist", "decline", "cancel", "replace"]);
    const html = renderToStaticMarkup(<ParticipantManagementDialog eventId={eventId} participant={participant} permissions={permissions} onCompleted={() => {}} />);
    for (const label of ["Kelola status", "Daftar tunggu", "Tolak peserta", "Batalkan peserta", "Ganti peserta", "Alasan *"]) expect(html).toContain(label);
    expect(html).toContain('aria-haspopup="dialog"'); expect(html).toMatch(/minlength="3"/i);
  });
  it.each(["USTADZ", "INSTITUTION_REPRESENTATIVE", "CHECKIN_OFFICER", "REPORT_VIEWER"])("tidak memberi aksi pengelolaan kepada %s", (roleCode) => {
    const permissions = participantStaffPermissions([{ roleCode, eventId }], eventId);
    expect(availableParticipantCommands(participant, permissions)).toEqual([]);
  });
  it("mengabaikan penugasan event lain, belum mulai dan sudah berakhir", () => {
    for (const assignment of [{ roleCode: "EVENT_ADMIN", eventId: "other" }, { roleCode: "EVENT_ADMIN" },
      { roleCode: "EVENT_ADMIN", eventId, endsAt: "2000-01-01" }, { roleCode: "EVENT_ADMIN", eventId, startsAt: "2099-01-01" }]) {
      expect(availableParticipantCommands(participant, participantStaffPermissions([assignment], eventId))).toEqual([]);
    }
  });
  it("terminal dan penolakan tidak menawarkan aksi pemulihan diam-diam", () => {
    const permissions = participantStaffPermissions([{ roleCode: "SUPER_ADMIN" }], eventId);
    expect(availableParticipantCommands({ ...participant, confirmationStatus: "CANCELLED" }, permissions)).toEqual([]);
    expect(availableParticipantCommands({ ...participant, confirmationStatus: "REPLACED" }, permissions)).toEqual([]);
    expect(availableParticipantCommands({ ...participant, approvalStatus: "DECLINED" }, permissions)).toEqual(["cancel"]);
    expect(availableParticipantCommands({ ...participant, approvalStatus: "WAITLISTED" }, permissions)).not.toContain("waitlist");
  });
});
