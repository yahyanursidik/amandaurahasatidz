/** Return only to a same-portal application path, never to an external URL. */
export function portalLoginReturnPath(portal: "admin" | "committee" | "ustadz", from: unknown): string | null {
  if (typeof from !== "string") return null;
  const root = portal === "ustadz" ? "/portal" : `/${portal}`;
  const path = from.replace(/\/+$/, "") || root;
  if (!new RegExp(`^${root}(?:/[a-zA-Z0-9_-]+)*$`).test(path)) return null;
  return path;
}
