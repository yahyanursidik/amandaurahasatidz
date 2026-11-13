import { eventApi } from "./eventApi";
import { eventWhatsAppFilterParams, type EventWhatsAppFilters, type EventWhatsAppPage, type EventWhatsAppResolution } from "./eventParticipantWhatsApp";

const endpoint = (id: string) => `/events/${encodeURIComponent(id)}/participants/whatsapp`;
export function listEventWhatsAppRecipients(eventId: string, filters: EventWhatsAppFilters, page: number, signal: AbortSignal) {
  const query = eventWhatsAppFilterParams(filters);
  query.set("page", String(page));
  query.set("pageSize", "50");
  return eventApi<EventWhatsAppPage>(`${endpoint(eventId)}?${query}`, { signal, cache: "no-store" });
}
export function resolveEventWhatsAppRecipients(eventId: string, participantIds: string[], confirmation: boolean, signal: AbortSignal, statusLinkFor?: string) {
  return eventApi<EventWhatsAppResolution>(endpoint(eventId), {
    method: "POST", cache: "no-store", signal, body: JSON.stringify({ participantIds, confirmation, statusLinkFor }),
  });
}
