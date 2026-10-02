const ROOT = "/portal/ruang-asatidz";

/** Accept only known account-only Ruang routes, never external or arbitrary return URLs. */
export function ruangAsatidzLoginReturnPath(portal: string, from: unknown): string | null {
  if (portal !== "ustadz" || typeof from !== "string") return null;
  const path = from.replace(/\/+$/, "");
  if (path === ROOT || ["saran", "pengalaman", "kebutuhan", "pesan", "terhubung"].some((tab) => path === `${ROOT}/${tab}`)) return path;
  return /^\/portal\/ruang-asatidz\/pesan\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(path) ? path : null;
}