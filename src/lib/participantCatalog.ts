export type ParticipantSummary = { total: number; approved: number; pending: number; institution: number; pendingEligible: number; completeContacts?: number; portalReady?: number };
export type ParticipantPageMeta = { page: number; pageSize: number; total: number; pageCount: number; filteredEligible: number; filteredPendingEligible?: number; summary: ParticipantSummary; institutions?: string[] };
export type ApprovalSelectionCandidate = { id: string; ustadzName: string; participantCode: string; approvalStatus: string; confirmationStatus: string };

/** Retain only the fields needed for cross-page approval, never an entire contact record. */
export function approvalSelectionCandidate(person: ApprovalSelectionCandidate): ApprovalSelectionCandidate {
  return { id: person.id, ustadzName: person.ustadzName, participantCode: person.participantCode,
    approvalStatus: person.approvalStatus, confirmationStatus: person.confirmationStatus };
}

export const emptyParticipantSummary = (): ParticipantSummary => ({ total: 0, approved: 0, pending: 0, institution: 0, pendingEligible: 0 });

export type ParticipantSourceFilter = "ALL" | "REGULAR" | "INSTITUTION" | "INDIVIDUAL";

export function participantSourceCategory(source?: string | null): Exclude<ParticipantSourceFilter, "ALL"> {
  if (["INSTITUTION_DELEGATION", "INSTITUTION_DELEGATION_REPLACEMENT", "INSTITUTION_INVITATION"].includes(source || "")) return "INSTITUTION";
  if (source === "INDIVIDUAL_INVITATION") return "INDIVIDUAL";
  return "REGULAR";
}

const registrationSourceLabels: Record<string, string> = {
  DIRECT_PUBLIC: "Pendaftaran publik",
  PUBLIC_REGISTRATION: "Pendaftaran publik",
  DIRECT_ADMIN_UPLOAD: "Unggahan admin",
  ADMIN_ENTRY: "Entri admin",
  INSTITUTION_DELEGATION: "Undangan lembaga",
  INSTITUTION_INVITATION: "Undangan lembaga",
  INSTITUTION_DELEGATION_REPLACEMENT: "Pengganti delegasi",
  REPLACEMENT: "Peserta pengganti",
  INDIVIDUAL_INVITATION: "Undangan pribadi",
};

export function participantSourceLabel(source?: string | null): string {
  return source ? registrationSourceLabels[source] || source.replaceAll("_", " ") : "Jalur belum dicatat";
}

const approvalLabels: Record<string, string> = {
  APPROVED: "Disetujui", PENDING_REVIEW: "Menunggu tinjauan", WAITLISTED: "Daftar tunggu",
  REJECTED: "Ditolak", DECLINED: "Ditolak", CANCELLED: "Dibatalkan",
};
const confirmationLabels: Record<string, string> = {
  CONFIRMED: "Sudah konfirmasi", INVITED: "Belum konfirmasi", CANCELLED: "Batal hadir", REPLACED: "Diganti",
};

export function participantApprovalLabel(status: string): string {
  return approvalLabels[status] || status.replaceAll("_", " ");
}

export function participantConfirmationLabel(status: string): string {
  return confirmationLabels[status] || status.replaceAll("_", " ");
}
