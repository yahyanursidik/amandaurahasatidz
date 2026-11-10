/** Registration is not an attendance confirmation when the event requires a later personal response. */
export function initialParticipantReviewState(confirmationRequired = true, now = new Date()) {
  return {
    confirmationStatus: confirmationRequired ? "INVITED" as const : "CONFIRMED" as const,
    approvalStatus: "PENDING_REVIEW" as const,
    confirmedAt: confirmationRequired ? null : now,
  };
}
