import { sql } from "drizzle-orm";
import { events } from "../db/schema";
import { DEFAULT_EVENT_POSTER } from "../../../../src/lib/eventPoster";

/** Evaluate in SQL so the inline image never travels in list/detail JSON. */
export const publicPosterUrl = sql<string | null>`case
  when ${events.posterUrl} like 'data:image/%' then
    '/api/v1/events/public/' || ${events.slug} || '/poster?v=' || floor(extract(epoch from ${events.updatedAt}) * 1000)::bigint::text
  when ${events.posterUrl} = '/images/event-poster-library-interior.png' then ${DEFAULT_EVENT_POSTER}
  else ${events.posterUrl} end`;

export const publicProgramColumns = {
  slug: events.slug, code: events.code, name: events.name, subtitle: events.subtitle,
  posterUrl: publicPosterUrl, posterAlt: events.posterAlt, startDate: events.startDate,
  endDate: events.endDate, venueName: events.venueName, audienceMode: events.audienceMode,
  status: events.status, regularQuota: events.regularQuota,
  registrationOpenAt: events.registrationOpenAt, registrationCloseAt: events.registrationCloseAt,
};
