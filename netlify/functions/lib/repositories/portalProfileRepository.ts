import { and, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { ustadzProfiles, users } from "../db/schema";

// Session email and cached profile IDs are deliberately not ownership authorities.
export function portalProfileOwnership(userId: string) {
  return sql`(${ustadzProfiles.userId} = ${userId}::uuid OR (
    ${ustadzProfiles.userId} IS NULL
    AND lower(btrim(${ustadzProfiles.email})) = (SELECT lower(btrim(email)) FROM users WHERE id = ${userId}::uuid)
    AND NOT EXISTS (SELECT 1 FROM ustadz_profiles linked WHERE linked.user_id = ${userId}::uuid)
    AND (SELECT count(*) FROM ustadz_profiles candidate WHERE candidate.user_id IS NULL
      AND lower(btrim(candidate.email)) = (SELECT lower(btrim(email)) FROM users WHERE id = ${userId}::uuid)) = 1
  ))`;
}

export async function findOwnPortalProfileRepository(userId: string) {
  const db = getDbClient();
  const linked = await db.select().from(ustadzProfiles).where(eq(ustadzProfiles.userId, userId)).limit(1);
  if (linked[0]) return linked[0];
  return (await db.select().from(ustadzProfiles).where(portalProfileOwnership(userId)).limit(1))[0];
}

type Profile = typeof ustadzProfiles.$inferSelect;

export async function updateOwnPortalProfileRepository(
  existing: Profile, userId: string, changes: Partial<typeof ustadzProfiles.$inferInsert>,
) {
  const db = getDbClient();
  const columns = getTableColumns(ustadzProfiles);
  const values = { ...changes, userId, updatedAt: new Date().toISOString() };
  const assignments = Object.entries(values).filter(([, value]) => value !== undefined).map(([key, value]) =>
    sql`${sql.identifier(columns[key as keyof typeof columns].name)} = ${value}`);
  const jsonFields = Object.entries(columns).flatMap(([key, column]) => [sql`${key}::text`, sql`p.${sql.identifier(column.name)}`]);
  // One PostgreSQL statement is atomic on Neon HTTP (no interactive transaction fallback).
  // Linking a safe legacy fallback makes future contact-email edits independent of login email.
  const result = await db.execute(sql`
    WITH updated_profile AS (
      UPDATE ${ustadzProfiles} SET ${sql.join(assignments, sql`, `)}
      WHERE ${and(eq(ustadzProfiles.id, existing.id), portalProfileOwnership(userId),
        isNull(ustadzProfiles.deletedAt), isNull(ustadzProfiles.mergedIntoId),
        sql`date_trunc('milliseconds', ${ustadzProfiles.updatedAt}) = ${existing.updatedAt.toISOString()}::timestamptz`,
        sql`${ustadzProfiles.profileStatus} NOT IN ('MERGED', 'ARCHIVED')`)}
      RETURNING *
    ), updated_user AS (
      UPDATE ${users} SET name = p.full_name, updated_at = now()
      FROM updated_profile p WHERE ${users.id} = ${userId}::uuid
      RETURNING ${users.id}
    )
    SELECT jsonb_build_object(${sql.join(jsonFields, sql`, `)}) AS profile
    FROM updated_profile p JOIN updated_user u ON u.id = p.user_id
  `);
  const saved = (result.rows[0] as { profile: Profile } | undefined)?.profile;
  if (!saved) return undefined;
  // JSONB bypasses Drizzle column decoders; restore the normal repository Date contract.
  return { ...saved, createdAt: new Date(saved.createdAt), updatedAt: new Date(saved.updatedAt),
    deletedAt: saved.deletedAt ? new Date(saved.deletedAt) : null };
}