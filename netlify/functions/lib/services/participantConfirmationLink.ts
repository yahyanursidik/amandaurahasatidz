import { signParticipantConfirmationToken } from "../utils/token";

export function participantConfirmationPath(token: string) {
  // The bearer credential stays in the fragment, outside static-server logs and Referer headers.
  return `/confirm#${encodeURIComponent(token)}`;
}

export function participantConfirmationUrl(token: string) {
  return new URL(participantConfirmationPath(token), process.env.APP_URL || process.env.URL || "http://localhost:3000").toString();
}

/** The same private link shows the current receipt/status and, when allowed, a decision or the QR. */
export function registrationStatusPath(participant: { id: string; eventId: string }, eventEndDate: string) {
  return participantConfirmationPath(signConfirmationForParticipant(participant, eventEndDate));
}

export function registrationStatusUrl(participant: { id: string; eventId: string }, eventEndDate: string) {
  return participantConfirmationUrl(signConfirmationForParticipant(participant, eventEndDate));
}

export function signConfirmationForParticipant(participant: { id: string; eventId: string }, eventEndDate: string) {
  const eventEnd = Date.parse(`${eventEndDate}T23:59:59.000Z`);
  if (!Number.isFinite(eventEnd)) throw new Error("Tanggal akhir event tidak valid untuk tautan konfirmasi.");
  return signParticipantConfirmationToken({ participantId: participant.id, eventId: participant.eventId,
    expiresAt: eventEnd + 2 * 86400000 });
}
