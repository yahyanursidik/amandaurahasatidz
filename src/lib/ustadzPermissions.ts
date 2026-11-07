import type { AuthIdentity } from "@/lib/refine/authProvider";

const MANAGER_ROLES = new Set(["SUPER_ADMIN", "SYSTEM_ADMIN", "DATA_STEWARD"]);
const MERGE_ROLES = new Set(["SUPER_ADMIN", "DATA_STEWARD"]);

export const canManageUstadz = (assignments: AuthIdentity["assignments"] | undefined) =>
  assignments?.some((assignment) => MANAGER_ROLES.has(assignment.roleCode)) || false;

export const canMergeUstadz = (assignments: AuthIdentity["assignments"] | undefined) =>
  assignments?.some((assignment) => MERGE_ROLES.has(assignment.roleCode)) || false;
