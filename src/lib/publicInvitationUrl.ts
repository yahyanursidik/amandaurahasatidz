export function resolvePublicInvitationUrl(input: string, origin: string): string | null {
  try {
    const url = new URL(input.trim(), origin);
    if (url.origin !== origin || url.username || url.password || url.search || url.hash) return null;
    const segments = url.pathname.split("/").filter(Boolean);
    if (segments[0] !== "invitation") return null;
    const valid = segments.length === 2
      || segments.length === 3 && ["individual", "institution"].includes(segments[1])
      || segments.length === 4 && segments[1] === "institution";
    if (!valid || segments.some((segment) => !/^[a-zA-Z0-9_-]+$/.test(segment))) return null;
    return url.toString();
  } catch { return null; }
}
