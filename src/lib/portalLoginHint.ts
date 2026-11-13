import { PORTAL_LABELS, PORTAL_LOGIN_PATHS, type PortalCode } from "@/config/portalAccess";

/** Accept only the same-app portal recommendation returned after password verification. */
export function portalLoginHint(error: unknown, currentPortal: PortalCode) {
  if (!error || typeof error !== "object" || !("details" in error)) return null;
  const details = error.details;
  if (!details || typeof details !== "object" || !("recommendedPortal" in details) || !("loginPath" in details)) return null;
  const portal = details.recommendedPortal;
  if (portal !== "admin" && portal !== "committee" && portal !== "ustadz" || portal === currentPortal) return null;
  if (details.loginPath !== PORTAL_LOGIN_PATHS[portal]) return null;
  return { path: PORTAL_LOGIN_PATHS[portal], label: PORTAL_LABELS[portal] };
}
