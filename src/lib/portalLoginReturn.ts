import { LOCATION_CHECKIN_PATH, locationCheckinHash, parseLocationCheckinHash } from "./locationCheckin";
import { parseMaterialPortalPath } from "./eventMaterial";

/** Return only to a same-portal application path, never to an external URL. */
export function portalLoginReturnPath(portal: "admin" | "committee" | "ustadz", from: unknown): string | null {
  if (typeof from !== "string") return null;
  if (portal === "ustadz" && from.startsWith(`${LOCATION_CHECKIN_PATH}#`)) {
    const scan = parseLocationCheckinHash(from.slice(LOCATION_CHECKIN_PATH.length));
    return scan ? `${LOCATION_CHECKIN_PATH}${locationCheckinHash(scan)}` : null;
  }
  const material = portal === "ustadz" ? parseMaterialPortalPath(from) : null;
  if (material) return material;
  const root = portal === "ustadz" ? "/portal" : `/${portal}`;
  const path = from.replace(/\/+$/, "") || root;
  if (!new RegExp(`^${root}(?:/[a-zA-Z0-9_-]+)*$`).test(path)) return null;
  return path;
}
