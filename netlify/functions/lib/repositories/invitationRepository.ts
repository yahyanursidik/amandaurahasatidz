import { getDbClient } from "../db/client";
import { invitations, invitationLinks, invitationResponses, institutions, events } from "../db/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export async function findInvitationsRepository(eventId?: string) {
  const db = getDbClient();
  const conditions = [];
  if (eventId) {
    conditions.push(eq(invitations.eventId, eventId));
  }

  return await db
    .select({
      id: invitations.id,
      eventId: invitations.eventId,
      eventName: events.name,
      invitationType: invitations.invitationType,
      institutionId: invitations.institutionId,
      institutionName: institutions.name,
      invitationNumber: invitations.invitationNumber,
      quota: invitations.quota,
      status: invitations.status,
      sentAt: invitations.sentAt,
      respondedAt: invitations.respondedAt,
    })
    .from(invitations)
    .innerJoin(events, eq(invitations.eventId, events.id))
    .leftJoin(institutions, eq(invitations.institutionId, institutions.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(invitations.createdAt));
}

export async function findInvitationByIdRepository(id: string) {
  const db = getDbClient();
  const found = await db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
  return found[0] || null;
}

export async function findInvitationByTokenHashRepository(tokenHash: string) {
  const db = getDbClient();

  const link = await db
    .select()
    .from(invitationLinks)
    .where(eq(invitationLinks.tokenHash, tokenHash))
    .limit(1);

  if (link.length === 0) return null;

  const inv = await db
    .select({
      invitation: invitations,
      event: events,
      institution: institutions,
    })
    .from(invitations)
    .innerJoin(events, eq(invitations.eventId, events.id))
    .leftJoin(institutions, eq(invitations.institutionId, institutions.id))
    .where(eq(invitations.id, link[0].invitationId))
    .limit(1);

  if (inv.length === 0) return null;

  // Update last accessed time & use count
  await db
    .update(invitationLinks)
    .set({
      lastAccessedAt: new Date(),
      usedCount: sql`${invitationLinks.usedCount} + 1`,
    })
    .where(eq(invitationLinks.id, link[0].id));

  return {
    link: link[0],
    invitation: inv[0].invitation,
    event: inv[0].event,
    institution: inv[0].institution,
  };
}

export async function createInvitationRepository(
  invData: typeof invitations.$inferInsert,
  tokenHash: string
) {
  const db = getDbClient();

  const createdInv = await db.insert(invitations).values(invData).returning();
  const createdLink = await db
    .insert(invitationLinks)
    .values({
      invitationId: createdInv[0].id,
      tokenHash,
      expiresAt: new Date(Date.now() + 14 * 86400000), // 14 days default
    })
    .returning();

  return {
    invitation: createdInv[0],
    link: createdLink[0],
  };
}

export async function updateInvitationStatusRepository(id: string, status: string, extra: Record<string, any> = {}) {
  const db = getDbClient();
  const updated = await db
    .update(invitations)
    .set({ status, ...extra, updatedAt: new Date() })
    .where(eq(invitations.id, id))
    .returning();

  return updated[0] || null;
}

export async function saveInvitationResponseRepository(
  invitationId: string,
  responseStatus: string,
  notes?: string | null,
  isFinal = false
) {
  const db = getDbClient();
  const created = await db
    .insert(invitationResponses)
    .values({
      invitationId,
      responseStatus,
      notes: notes || null,
      isFinal,
      submittedAt: new Date(),
    })
    .returning();

  await db
    .update(invitations)
    .set({
      status: responseStatus === "ACCEPTED" ? "ACCEPTED" : "DECLINED",
      respondedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invitations.id, invitationId));

  return created[0];
}
