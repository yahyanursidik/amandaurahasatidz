/** Legacy institution invitations stay single-response; self registration reserves one seat per submission. */
export type InvitationRegistrationMode = "DELEGATION" | "INDIVIDUAL_SELF";
export type InvitationPolicy = { invitationType?: string; registrationMode?: string; quota?: number | null; allowGroup?: boolean };

export function invitationIsSelfRegistration(invitation: InvitationPolicy): boolean {
  return invitation.invitationType !== "INDIVIDUAL" && invitation.registrationMode === "INDIVIDUAL_SELF";
}

export function invitationAllowsGroup(invitation: InvitationPolicy): boolean {
  return !invitationIsSelfRegistration(invitation) && invitation.invitationType !== "INDIVIDUAL" && invitation.allowGroup !== false && (invitation.quota || 1) > 1;
}

export function invitationParticipantLimit(invitation: InvitationPolicy): number {
  return invitationAllowsGroup(invitation) ? Math.max(1, invitation.quota || 1) : 1;
}

export const invitationStatusLabel: Record<string, string> = {
  DRAFT: "Draf", SENT: "Terkirim", OPENED: "Dibuka", ACCEPTED: "Bersedia hadir",
  DECLINED: "Berhalangan", REVOKED: "Dicabut",
};

export const isInvitationPending = (status: string) => ["DRAFT", "SENT", "OPENED"].includes(status);

export type InvitationInstitutionOption = {
  id: string; code: string; name: string; email?: string | null; phone?: string | null;
  whatsapp?: string | null; address?: string | null; cityCode?: string | null; provinceCode?: string | null;
  contactName?: string | null;
};

export type InstitutionInvitationValues = {
  institutionId: string;
  invitationNumber: string;
  registrationMode: InvitationRegistrationMode;
  allowGroup: boolean;
  quota: number;
  responseDeadline: string;
};
