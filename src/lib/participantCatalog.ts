export type ParticipantSummary = { total: number; approved: number; pending: number; institution: number; pendingEligible: number; completeContacts?: number; portalReady?: number };
export type ParticipantPageMeta = { page: number; pageSize: number; total: number; pageCount: number; filteredEligible: number; filteredPendingEligible?: number; summary: ParticipantSummary; institutions?: string[] };
export type ApprovalSelectionCandidate = { id: string; ustadzName: string; participantCode: string; approvalStatus: string; confirmationStatus: string };

/** Retain only the fields needed for cross-page approval, never an entire contact record. */
export function approvalSelectionCandidate(person: ApprovalSelectionCandidate): ApprovalSelectionCandidate {
  return { id: person.id, ustadzName: person.ustadzName, participantCode: person.participantCode,
    approvalStatus: person.approvalStatus, confirmationStatus: person.confirmationStatus };
}

export const emptyParticipantSummary = (): ParticipantSummary => ({ total: 0, approved: 0, pending: 0, institution: 0, pendingEligible: 0 });
