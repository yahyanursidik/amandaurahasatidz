import { sql, type SQL } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { eventParticipants, participantStatusHistories } from "../db/schema";
import { normalizeWhatsAppNumber } from "../../../../src/lib/participantCommunication";

const contactType = "WHATSAPP_REVIEW";
type Database = ReturnType<typeof getDbClient>;

/** A public form may propose an update, but must not overwrite an existing profile. */
export async function recordWhatsAppProposal(tx: Database, participantId: string, proposed: string | null, existing: string | null) {
  const number = normalizeWhatsAppNumber(proposed);
  if (!number || number === normalizeWhatsAppNumber(existing)) return;
  await tx.insert(participantStatusHistories).values({ participantId, statusType: contactType, toStatus: "PENDING", reason: number });
}

export const submittedWhatsAppForParticipant = sql<string | null>`(
  select proposed.reason from participant_status_histories proposed
  where proposed.participant_id = ${eventParticipants.id}
    and proposed.status_type = ${contactType} and proposed.to_status = 'PENDING'
    and not exists (select 1 from participant_status_histories resolved
      where resolved.participant_id = proposed.participant_id and resolved.status_type = ${contactType}
        and resolved.to_status = 'RESOLVED' and resolved.from_status = proposed.id::text)
  order by proposed.changed_at desc, proposed.id desc limit 1
)`;

/** Resolve only proposals visible in this atomic profile-save statement's snapshot.
 * Each resolution references its own proposal UUID; a concurrent/newer proposal is never
 * hidden by a blanket timestamp or a later RESOLVED marker. The CTE must reference a
 * guarded updated_profile result, so a failed ownership/version update resolves nothing. */
export function resolveWhatsAppProposalsForProfileSql(updatedProfile: SQL, actorUserId: string | null) {
  return sql`INSERT INTO ${participantStatusHistories}
    (participant_id, status_type, from_status, to_status, reason, changed_by)
    SELECT proposed.participant_id, ${contactType}, proposed.id::text, 'RESOLVED',
      'Nomor WhatsApp ditinjau dan disimpan melalui profil.', ${actorUserId}::uuid
    FROM participant_status_histories proposed
    JOIN event_participants participant ON participant.id = proposed.participant_id
    JOIN ${updatedProfile} saved_profile ON saved_profile.id = participant.ustadz_id
    WHERE proposed.status_type = ${contactType} AND proposed.to_status = 'PENDING'
      AND NOT EXISTS (SELECT 1 FROM participant_status_histories resolved
        WHERE resolved.participant_id = proposed.participant_id AND resolved.status_type = ${contactType}
          AND resolved.to_status = 'RESOLVED' AND resolved.from_status = proposed.id::text)
    RETURNING id`;
}
