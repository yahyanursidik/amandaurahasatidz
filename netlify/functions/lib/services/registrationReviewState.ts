/** A submitted registration records intent to attend, not an admin decision. */
export function initialParticipantReviewState(now = new Date()) {
  return {
    confirmationStatus: "CONFIRMED" as const,
    approvalStatus: "PENDING_REVIEW" as const,
    confirmedAt: now,
  };
}
