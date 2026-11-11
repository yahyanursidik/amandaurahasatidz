type Assignment = { roleCode: string; eventId?: string | null; startsAt?: string | Date | null; endsAt?: string | Date | null };

export function isCommitteeOrganizerOnly(assignments: Assignment[] = []) {
  const now = Date.now();
  const activeAssignments = assignments.filter((assignment) =>
    (!assignment.startsAt || new Date(assignment.startsAt).getTime() <= now)
    && (!assignment.endsAt || new Date(assignment.endsAt).getTime() > now));
  const activeRoles = activeAssignments.map((assignment) => assignment.roleCode);
  return activeAssignments.some((assignment) => assignment.roleCode === "COMMITTEE_ORGANIZER" && !assignment.eventId)
    && !activeRoles.some((role) => ["SUPER_ADMIN", "SYSTEM_ADMIN", "DATA_STEWARD", "REPORT_VIEWER"].includes(role));
}
