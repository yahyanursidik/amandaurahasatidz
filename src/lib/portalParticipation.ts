export type PortalParticipationChoice = {
  participantId: string;
  startDate: string;
  endDate: string;
  eventStatus: string;
  confirmationStatus: string;
};

const selectionKey = "aman-daurah:portal-participant";

export const readPortalParticipationSelection = () => {
  try { return window.sessionStorage.getItem(selectionKey); }
  catch { return null; }
};

export const savePortalParticipationSelection = (participantId: string) => {
  try { window.sessionStorage.setItem(selectionKey, participantId); }
  catch { /* Private browsing may block storage; the current page still works. */ }
};

export const choosePortalParticipationId = <T extends PortalParticipationChoice>(
  participations: T[],
  preferredId: string | null,
  today: string,
): string => {
  const available = participations.filter((item) =>
    !["CANCELLED", "ARCHIVED"].includes(item.eventStatus) &&
    !["CANCELLED", "REPLACED"].includes(item.confirmationStatus));
  const choices = available.length ? available : participations;
  if (!choices.length) return "";
  if (preferredId && choices.some((item) => item.participantId === preferredId)) return preferredId;

  const ongoing = choices.filter((item) => item.startDate <= today && item.endDate >= today)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (ongoing[0]) return ongoing[0].participantId;

  const upcoming = choices.filter((item) => item.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (upcoming[0]) return upcoming[0].participantId;

  return [...choices].sort((a, b) => b.endDate.localeCompare(a.endDate))[0].participantId;
};
