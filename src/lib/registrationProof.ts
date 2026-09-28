import type { ParticipantCardDetails } from "@/components/public/ParticipantQrCard";

type Proof<TEvent, TResult> = { event: TEvent; result: TResult };

/** A registration receipt stays in this tab across refreshes, but not in permanent browser storage. */
export function readRegistrationProof<TEvent, TResult extends { participants?: Array<Pick<ParticipantCardDetails, "qrToken" | "cardUrl" | "participantCode">> }>(key: string): Proof<TEvent, TResult> | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const proof = JSON.parse(raw) as Proof<TEvent, TResult>;
    if (!proof?.event || !proof?.result || !Array.isArray(proof.result.participants) ||
      proof.result.participants.some((person) => !person.qrToken?.startsWith("pqr_") || !person.cardUrl || !person.participantCode)) return null;
    return proof;
  } catch { return null; }
}

export function saveRegistrationProof<TEvent, TResult>(key: string, proof: Proof<TEvent, TResult>): void {
  try { window.sessionStorage.setItem(key, JSON.stringify(proof)); }
  catch { /* The on-screen receipt and email link remain available if storage is disabled. */ }
}
