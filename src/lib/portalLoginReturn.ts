import { LOCATION_CHECKIN_PATH, locationCheckinHash, parseLocationCheckinHash } from "./locationCheckin";

/** Return only to a same-portal application path, never to an external URL. */
export function portalLoginReturnPath(portal: "admin" | "committee" | "ustadz", from: unknown): string | null {
  if (typeof from !== "string") return null;
  // A scan opened before login may carry a short-lived capability only in the
  // fragment. No other fragments, queries or destinations are accepted.
  if (portal === "ustadz" && from.startsWith(`${LOCATION_CHECKIN_PATH}#`)) {
    const scan = parseLocationCheckinHash(from.slice(LOCATION_CHECKIN_PATH.length));
    return scan ? `${LOCATION_CHECKIN_PATH}${locationCheckinHash(scan)}` : null;
  }
  const root = portal === "ustadz" ? "/portal" : `/${portal}`;
  const path = from.replace(/\/+$/, "") || root;
  if (!new RegExp(`^${root}(?:/[a-zA-Z0-9_-]+)*$`).test(path)) return null;
  return path;
}
