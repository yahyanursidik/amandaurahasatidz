import { ROLE_PERMISSIONS, type PermissionCode, type RoleCode } from "@/config/permissions";

export type ParticipantCommand = "waitlist" | "decline" | "cancel" | "replace";
export type ParticipantCommandTarget = { id: string; name: string; participantCode: string; confirmationStatus: string; approvalStatus: string };

export const participantCommandLabels: Record<ParticipantCommand, string> = {
  waitlist: "Daftar tunggu", decline: "Tolak peserta", cancel: "Batalkan peserta", replace: "Ganti peserta",
};
const commandPermission: Record<ParticipantCommand, PermissionCode> = {
  waitlist: "participants.waitlist", decline: "participants.approve", cancel: "participants.cancel", replace: "participants.replace",
};

export function participantStaffPermissions(assignments: Array<{ roleCode: string; eventId?: string | null; startsAt?: string | Date | null; endsAt?: string | Date | null }> = [], eventId: string) {
  const permissions = new Set<PermissionCode>();
  const globalRoles = ["SUPER_ADMIN", "SYSTEM_ADMIN", "DATA_STEWARD", "REPORT_VIEWER"];
  for (const assignment of assignments) {
    if (["USTADZ", "INSTITUTION_REPRESENTATIVE"].includes(assignment.roleCode) ||
      assignment.startsAt && new Date(assignment.startsAt) > new Date() || assignment.endsAt && new Date(assignment.endsAt) < new Date()) continue;
    if (!globalRoles.includes(assignment.roleCode) && assignment.eventId !== eventId && assignment.eventId !== "*") continue;
    for (const permission of ROLE_PERMISSIONS[assignment.roleCode as RoleCode] || []) permissions.add(permission);
  }
  return [...permissions];
}

export function availableParticipantCommands(participant: ParticipantCommandTarget, permissions: PermissionCode[]): ParticipantCommand[] {
  if (!["INVITED", "CONFIRMED"].includes(participant.confirmationStatus)) return [];
  return (["waitlist", "decline", "cancel", "replace"] as const).filter((command) => {
    if (!permissions.includes(commandPermission[command])) return false;
    if (command === "cancel") return true;
    if (["DECLINED", "REJECTED"].includes(participant.approvalStatus)) return false;
    return command !== "waitlist" || participant.approvalStatus !== "WAITLISTED";
  });
}
