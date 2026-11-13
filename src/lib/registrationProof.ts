import type { ParticipantCardDetails } from "@/components/public/ParticipantQrCard";

type Proof<TEvent, TResult> = { event: TEvent; result: TResult };

/** A registration receipt stays in this tab across refreshes, but not in permanent browser storage. */
export function readRegistrationProof<TEvent, TResult extends { participants?: Array<Pick<ParticipantCardDetails, "participantCode">> }>(key: string): Proof<TEvent, TResult> | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const proof = JSON.parse(raw) as Proof<TEvent, TResult>;
    if (!proof?.event || !proof?.result || !Array.isArray(proof.result.participants) ||
      proof.result.participants.some((person) => typeof person?.participantCode !== "string" || !person.participantCode)) return null;
    // Receipts are snapshots, not authoritative attendance passes. Old tabs may
    // still hold a QR token or a card link created before moderation.
    for (const person of proof.result.participants as Array<{ qrToken?: unknown; cardUrl?: unknown } & Pick<ParticipantCardDetails, "participantCode">>) {
      delete person.qrToken;
      delete person.cardUrl;
    }
    return proof;
  } catch { return null; }
}

export function saveRegistrationProof<TEvent, TResult>(key: string, proof: Proof<TEvent, TResult>): void {
  // A one-time credential may appear in the immediate API response, but never in browser storage.
  try { window.sessionStorage.setItem(key, JSON.stringify(proof, (field, value) =>
    ["temporaryPassword", "qrToken", "cardUrl"].includes(field) ? undefined : value)); }
  catch { /* The on-screen receipt and email link remain available if storage is disabled. */ }
}
