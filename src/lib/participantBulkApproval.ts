export type ApprovalCandidate = {
  id: string;
  approvalStatus: string;
  confirmationStatus: string;
};

export type BulkApprovalItem = {
  participantId: string;
  status: "SUCCESS" | "FAILED" | "UNKNOWN" | "NOT_PROCESSED";
  message: string;
};

export type BulkApprovalResponse = {
  summary: { total: number; succeeded: number; failed: number };
  results: { participantId: string; status: "SUCCESS" | "FAILED"; message: string }[];
};

export function canApproveParticipant(participant: ApprovalCandidate) {
  return ["PENDING_REVIEW", "WAITLISTED"].includes(participant.approvalStatus)
    && ["INVITED", "CONFIRMED"].includes(participant.confirmationStatus);
}

export function eligibleApprovalIds(participants: ApprovalCandidate[], pendingOnly = false) {
  return [...new Set(participants.filter((item) => canApproveParticipant(item)
    && (!pendingOnly || item.approvalStatus === "PENDING_REVIEW")).map((item) => item.id))];
}

export function toggleApprovalSelection(selected: string[], ids: string[], checked: boolean) {
  return checked ? [...new Set([...selected, ...ids])] : selected.filter((id) => !ids.includes(id));
}

export function selectionAfterBulkApproval(selected: string[], submitted: string[], results: BulkApprovalItem[]) {
  // Keep unrelated selections; uncertain outcomes require a refresh before manual re-selection.
  return [...new Set([
    ...selected.filter((id) => !submitted.includes(id)),
    ...results.filter((item) => item.status === "FAILED").map((item) => item.participantId),
  ])];
}

/** Sequential, bounded requests. Never automatically retries an uncertain write. */
export async function runParticipantBulkApproval(
  participantIds: string[],
  requestBatch: (ids: string[]) => Promise<BulkApprovalResponse>,
  onProgress: (processed: number, total: number) => void,
  isCurrent: () => boolean = () => true,
): Promise<BulkApprovalItem[]> {
  const ids = [...new Set(participantIds)];
  const results: BulkApprovalItem[] = [];
  for (let index = 0; index < ids.length; index += 25) {
    if (!isCurrent()) break;
    const batch = ids.slice(index, index + 25);
    try {
      const response = await requestBatch(batch);
      const seen = new Set<string>();
      const valid = response && Array.isArray(response.results) && response.results.length === batch.length
        && response.results.every((item) => {
          if (!batch.includes(item.participantId) || seen.has(item.participantId)
            || !["SUCCESS", "FAILED"].includes(item.status)) return false;
          seen.add(item.participantId);
          return true;
        });
      if (!valid) throw new Error("API mengembalikan hasil yang tidak lengkap. Muat ulang daftar sebelum mencoba lagi.");
      results.push(...response.results);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Koneksi terputus saat memproses persetujuan.";
      // The server might already have approved part of this batch before a timeout.
      results.push(...batch.map((participantId) => ({ participantId, status: "UNKNOWN" as const,
        message: `Hasil belum dapat dipastikan: ${message} Periksa status terbaru sebelum mencoba lagi.` })));
      results.push(...ids.slice(index + batch.length).map((participantId) => ({ participantId,
        status: "NOT_PROCESSED" as const, message: "Belum diproses karena permintaan sebelumnya terhenti." })));
      if (isCurrent()) onProgress(index + batch.length, ids.length);
      break;
    }
    if (isCurrent()) onProgress(index + batch.length, ids.length);
  }
  return results;
}