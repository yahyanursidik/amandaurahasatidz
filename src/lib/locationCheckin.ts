export const LOCATION_CHECKIN_PATH = "/portal/attendance";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const locationToken = /^loc_qr_[a-f0-9]{64}$/;

export type LocationCheckinTarget = {
  eventId: string;
  dayId?: string | null;
  sessionId?: string | null;
  rawLocationQrToken: string;
};

export function parseLocationCheckinHash(hash: string): LocationCheckinTarget | null {
  if (!hash.startsWith("#") || hash.length > 256) return null;
  const params = new URLSearchParams(hash.slice(1));
  const eventId = params.get("e") || "";
  const dayId = params.get("d");
  const sessionId = params.get("s");
  const rawLocationQrToken = params.get("qr") || "";
  if ([...params.keys()].length !== 3 || !uuid.test(eventId) || !locationToken.test(rawLocationQrToken) ||
    Boolean(dayId) === Boolean(sessionId) || !uuid.test(dayId || sessionId || "")) return null;
  return { eventId, ...(dayId ? { dayId } : { sessionId }), rawLocationQrToken };
}

export function locationCheckinHash(target: LocationCheckinTarget) {
  const params = new URLSearchParams({ e: target.eventId, qr: target.rawLocationQrToken });
  if (target.sessionId) params.set("s", target.sessionId);
  else if (target.dayId) params.set("d", target.dayId);
  return `#${params}`;
}

export function locationCheckinUrl(origin: string, target: LocationCheckinTarget) {
  return new URL(`${LOCATION_CHECKIN_PATH}${locationCheckinHash(target)}`, origin).toString();
}

export function parseLocationCheckinLink(input: string, origin: string) {
  try {
    const url = new URL(input.trim(), origin);
    if (url.origin !== origin || url.pathname !== LOCATION_CHECKIN_PATH || url.search || url.username || url.password) return null;
    return parseLocationCheckinHash(url.hash);
  } catch { return null; }
}
