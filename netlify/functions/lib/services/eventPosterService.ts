import { createHash } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { events } from "../db/schema";
import { NotFoundError } from "../utils/errors";
import { DEFAULT_EVENT_POSTER } from "../../../../src/lib/eventPoster";

export async function getPublicEventPosterService(slug: string, ifNoneMatch?: string, version?: string): Promise<{
  statusCode: number; headers: Record<string, string>; body: string; isBase64Encoded?: boolean;
}> {
  const [event] = await getDbClient().select({ posterUrl: events.posterUrl, updatedAt: events.updatedAt })
    .from(events).where(and(eq(events.slug, slug), isNull(events.archivedAt),
      inArray(events.status, ["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED"]))).limit(1);
  if (!event) throw new NotFoundError("Poster kegiatan tidak tersedia.");
  const source = event.posterUrl || DEFAULT_EVENT_POSTER;
  const currentVersion = String(new Date(event.updatedAt).getTime());
  const headers: Record<string, string> = {
    "Cache-Control": version === currentVersion ? "public, max-age=31536000, immutable" : "public, max-age=60, s-maxage=300",
    "X-Content-Type-Options": "nosniff",
  };
  if (!source.startsWith("data:")) {
    const target = source === "/images/event-poster-library-interior.png" ? DEFAULT_EVENT_POSTER : source;
    return { statusCode: 302, headers: { ...headers, Location: /^(?:https?:\/\/|\/images\/)/i.test(target) ? target : DEFAULT_EVENT_POSTER }, body: "" };
  }
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/i.exec(source);
  if (!match || source.length > 900_000) throw new NotFoundError("Format poster tidak tersedia.");
  const etag = `"${createHash("sha256").update(source).digest("hex")}"`;
  const responseHeaders = { ...headers, "Content-Type": match[1].toLowerCase(), ETag: etag };
  if (ifNoneMatch?.split(",").some((value) => value.trim().replace(/^W\//, "") === etag || value.trim() === "*")) {
    return { statusCode: 304, headers: responseHeaders, body: "" };
  }
  return { statusCode: 200, headers: responseHeaders, isBase64Encoded: true, body: match[2] };
}
