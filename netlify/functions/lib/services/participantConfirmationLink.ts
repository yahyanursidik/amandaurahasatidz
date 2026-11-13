import { participantPrivateLinkBinding, signParticipantConfirmationToken } from "../utils/token";

type Registration = { id: string; eventId: string };
type PrivateRegistration = Registration & { ustadzId: string; email: string; qrRotatedAt: Date | null };
export const PRIVATE_REGISTRATION_LINK_MINUTES = 30;

export function participantConfirmationPath(token: string) {
  // The bearer credential stays in the fragment, outside static-server logs and Referer headers.
  return `/confirm#${encodeURIComponent(token)}`;
}

export function participantConfirmationUrl(token: string) {
  return new URL(participantConfirmationPath(token), process.env.APP_URL || process.env.URL || "http://localhost:3000").toString();
}

export function registrationReceiptPath(participant: Registration, eventEndDate: string) {
  return participantConfirmationPath(signConfirmationForParticipant(participant, eventEndDate));
}

export function registrationReceiptUrl(participant: Registration, eventEndDate: string) {
  return participantConfirmationUrl(signConfirmationForParticipant(participant, eventEndDate));
}

/** Receipt can be shared by a group leader; it never authorizes a decision or issues a QR. */
export function signConfirmationForParticipant(participant: Registration, eventEndDate: string) {
  const eventEnd = Date.parse(`${eventEndDate}T23:59:59.000Z`);
  if (!Number.isFinite(eventEnd)) throw new Error("Tanggal akhir event tidak valid untuk tautan konfirmasi.");
  return signParticipantConfirmationToken({ participantId: participant.id, eventId: participant.eventId, purpose: "RECEIPT",
    expiresAt: eventEnd + 2 * 86400000 });
}

/** Private access is only delivered by the server to the currently registered email. */
export function registrationStatusUrl(participant: PrivateRegistration, now = Date.now()) {
  return participantConfirmationUrl(signParticipantConfirmationToken({ participantId: participant.id, eventId: participant.eventId,
    purpose: "PRIVATE_ACCESS", binding: participantPrivateLinkBinding(participant.ustadzId, participant.email, participant.qrRotatedAt),
    expiresAt: now + PRIVATE_REGISTRATION_LINK_MINUTES * 60_000 }));
}
