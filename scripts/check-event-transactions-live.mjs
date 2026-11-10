/** Opt-in live regression on an explicitly supplied, isolated Neon branch only.
 * Reuses local role credentials in memory; never rewrites .env or touches its endpoint.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer } from 'vite';

const root = path.resolve(import.meta.dirname, '..');
const [endpoint, branchId] = process.argv.slice(2);
if (!/^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(endpoint || '') || !/^br-[a-z0-9-]+$/.test(branchId || '')) {
  throw new Error('Supply the verified temporary branch endpoint and branch ID. Production endpoint is forbidden.');
}
const env = dotenv.parse(await readFile(path.join(root, '.env')));
const source = new URL(env.DATABASE_URL || '');
if (source.hostname.replace('-pooler.', '.') === endpoint.replace('-pooler.', '.')) throw new Error('Refusing to test against the configured database.');
const target = new URL(source); target.hostname = endpoint;
process.env.DATABASE_URL = target.toString(); process.env.APP_ENV = 'test';
const server = await createServer({ root, configFile: false, envDir: false, server: { middlewareMode: true },
  resolve: { alias: { '@': path.join(root, 'src') } } });
try {
  const { getDbClient } = await server.ssrLoadModule('/netlify/functions/lib/db/client.ts');
  const { withTransaction } = await server.ssrLoadModule('/netlify/functions/lib/db/transaction.ts');
  const schema = await server.ssrLoadModule('/netlify/functions/lib/db/schema.ts');
  const { eq, and, inArray } = await server.ssrLoadModule('drizzle-orm');
  const { saveInstitutionDelegationRepository, updateInvitationRepository } = await server.ssrLoadModule('/netlify/functions/lib/repositories/invitationRepository.ts');
  const { approveParticipantService, cancelParticipantService, replaceParticipantService, waitlistParticipantService } = await server.ssrLoadModule('/netlify/functions/lib/services/participantService.ts');
  const { submitPublicRegistrationService } = await server.ssrLoadModule('/netlify/functions/lib/services/publicRegistrationService.ts');
  const { hashToken } = await server.ssrLoadModule('/netlify/functions/lib/utils/token.ts');
  const db = getDbClient(), run = randomUUID().slice(0, 8), checks = [];
  const { events, institutions, invitations, invitationLinks, invitationResponses, eventParticipants, ustadzProfiles, users } = schema;
  const [institution] = await db.insert(institutions).values({ code: `QA-${run}`, name: `QA institution ${run}` }).returning();
  async function makeEvent(capacity = 10) {
    const key = randomUUID();
    return (await db.insert(events).values({ code: `QA-${key}`, slug: `qa-${key}`, name: `QA atomic registration ${run}`, startDate: '2099-01-01',
      endDate: '2099-01-03', status: 'PUBLISHED', audienceMode: 'MIXED', capacity, invitationQuota: capacity, regularQuota: null,
      invitationResponseDeadline: new Date('2098-12-31') }).returning())[0];
  }
  async function makeInvitation(event) {
    const tokenHash = hashToken(randomUUID());
    const [invitation] = await db.insert(invitations).values({ eventId: event.id, institutionId: institution.id, invitationType: 'INSTITUTION',
      invitationNumber: `QA-${randomUUID()}`, quota: 3, status: 'SENT', responseDeadline: new Date('2098-12-31') }).returning();
    await db.insert(invitationLinks).values({ invitationId: invitation.id, tokenHash, expiresAt: new Date('2098-12-31') });
    return { invitation, context: { eventId: event.id, tokenHash } };
  }
  const person = (suffix, isLead = true) => ({ fullName: `QA Ustadz ${suffix} ${run}`, email: `qa-${run}-${suffix}@example.invalid`,
    whatsapp: '6281234567890', city: 'KOTA BANDUNG', province: 'JAWA BARAT', isLead });
  const payload = (delegates) => ({ responseStatus: 'ACCEPTED', isFinal: true, delegates });
  const [role] = await db.select().from(schema.roles).where(eq(schema.roles.code, 'USTADZ')).limit(1);
  assert.ok(role, 'The isolated parent schema must already have the USTADZ role');

  const sentinel = `QA-ROLLBACK-${randomUUID()}`;
  await assert.rejects(withTransaction(async (tx) => {
    await tx.insert(institutions).values({ code: sentinel, name: sentinel }); throw new Error('forced rollback');
  }), /forced rollback/);
  assert.equal((await db.select().from(institutions).where(eq(institutions.code, sentinel))).length, 0);
  checks.push('interactive transaction rolls back all writes');

  const rollbackEvent = await makeEvent(), rollbackInvite = await makeInvitation(rollbackEvent);
  const first = person('rollback-first'), conflict = person('rollback-conflict', false);
  await db.insert(ustadzProfiles).values({ fullName: 'Different owner', normalizedName: 'different owner', email: conflict.email, profileStatus: 'ACTIVE' });
  await assert.rejects(saveInstitutionDelegationRepository(rollbackInvite.invitation.id, payload([first, conflict]), rollbackInvite.context));
  assert.equal((await db.select().from(users).where(eq(users.email, first.email))).length, 0, 'first account rolled back');
  assert.equal((await db.select().from(ustadzProfiles).where(eq(ustadzProfiles.email, first.email))).length, 0, 'first profile rolled back');
  assert.equal((await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, rollbackEvent.id))).length, 0, 'no partial group');
  assert.equal((await db.select().from(invitationResponses).where(eq(invitationResponses.invitationId, rollbackInvite.invitation.id))).length, 0, 'no partial response');
  checks.push('a later identity conflict rolls back the entire group and portal account');

  const sameEvent = await makeEvent(3), sameInvite = await makeInvitation(sameEvent), samePayload = payload([person('double')]);
  const duplicate = await Promise.allSettled([saveInstitutionDelegationRepository(sameInvite.invitation.id, samePayload, sameInvite.context),
    saveInstitutionDelegationRepository(sameInvite.invitation.id, samePayload, sameInvite.context)]);
  assert.equal(duplicate.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, sameEvent.id))).length, 1);
  assert.equal((await db.select().from(invitationResponses).where(eq(invitationResponses.invitationId, sameInvite.invitation.id))).length, 1);
  checks.push('simultaneous final responses have exactly one effect');

  const capacityEvent = await makeEvent(1), a = await makeInvitation(capacityEvent), b = await makeInvitation(capacityEvent);
  const capacity = await Promise.allSettled([saveInstitutionDelegationRepository(a.invitation.id, payload([person('capacity-a')]), a.context),
    saveInstitutionDelegationRepository(b.invitation.id, payload([person('capacity-b')]), b.context)]);
  assert.equal(capacity.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, capacityEvent.id))).length, 1);
  checks.push('competing invitations cannot overbook the last seat');

  const mixedEvent = await makeEvent(1), mixedInvite = await makeInvitation(mixedEvent);
  const [pendingProfile] = await db.insert(ustadzProfiles).values({ fullName: `QA Pending ${run}`, normalizedName: `qa pending ${run}`, profileStatus: 'ACTIVE' }).returning();
  const [pending] = await db.insert(eventParticipants).values({ eventId: mixedEvent.id, ustadzId: pendingProfile.id, participantCode: `QA-${randomUUID()}`,
    registrationSource: 'ADMIN_ENTRY', confirmationStatus: 'CONFIRMED', approvalStatus: 'PENDING_REVIEW' }).returning();
  const mixed = await Promise.allSettled([saveInstitutionDelegationRepository(mixedInvite.invitation.id, payload([person('mixed')]), mixedInvite.context),
    approveParticipantService(pending.id, undefined, undefined, 'QA concurrent approval', mixedEvent.id)]);
  assert.equal(mixed.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await db.select().from(eventParticipants).where(and(eq(eventParticipants.eventId, mixedEvent.id), eq(eventParticipants.approvalStatus, 'APPROVED')))).length, 1);
  checks.push('staff approval and invitation registration share one capacity lock');

  const regularEvent = await makeEvent(1), regularInvite = await makeInvitation(regularEvent);
  await db.update(events).set({ status: 'REGISTRATION_OPEN' }).where(eq(events.id, regularEvent.id));
  const regular = await Promise.allSettled([saveInstitutionDelegationRepository(regularInvite.invitation.id, payload([person('regular-invite')]), regularInvite.context),
    submitPublicRegistrationService(regularEvent.slug, { ...person('regular-public'), consentConfirmed: true }, 'qa-regular-race')]);
  assert.equal(regular.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, regularEvent.id))).length, 1);
  checks.push('regular and invitation registration cannot overbook shared capacity');

  const [confirmed] = await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, sameEvent.id));
  const [replacementProfile] = await db.insert(ustadzProfiles).values({ fullName: `QA Replacement ${run}`, normalizedName: `qa replacement ${run}`, profileStatus: 'ACTIVE' }).returning();
  const replacement = await replaceParticipantService(confirmed.id, replacementProfile.id, 'QA replacement', undefined, undefined, sameEvent.id);
  assert.equal(replacement.oldParticipant.confirmationStatus, 'REPLACED');
  assert.equal(replacement.oldParticipant.qrTokenVersion, confirmed.qrTokenVersion + 1);
  assert.equal(replacement.newParticipant.registrationSource, confirmed.registrationSource);
  assert.equal(replacement.newParticipant.invitationId, confirmed.invitationId);
  assert.equal(replacement.newParticipant.approvalStatus, 'PENDING_REVIEW');
  await approveParticipantService(replacement.newParticipant.id, undefined, undefined, 'QA approve replacement', sameEvent.id);
  await waitlistParticipantService(replacement.newParticipant.id, 'QA waitlist', undefined, undefined, sameEvent.id);
  await approveParticipantService(replacement.newParticipant.id, undefined, undefined, 'QA approve again', sameEvent.id);
  const cancelled = await cancelParticipantService(replacement.newParticipant.id, 'QA cancel', undefined, undefined, sameEvent.id);
  assert.equal(cancelled.confirmationStatus, 'CANCELLED');
  assert.ok(cancelled.qrTokenVersion > replacement.newParticipant.qrTokenVersion);
  assert.equal((await db.select().from(schema.participantStatusHistories).where(eq(schema.participantStatusHistories.participantId, replacement.newParticipant.id))).length, 5);
  checks.push('replacement, waitlist, approval, cancellation and QR invalidation preserve linked history');

  const revokedEvent = await makeEvent(), revoked = await makeInvitation(revokedEvent);
  await db.update(invitationLinks).set({ revokedAt: new Date() }).where(eq(invitationLinks.invitationId, revoked.invitation.id));
  await assert.rejects(saveInstitutionDelegationRepository(revoked.invitation.id, payload([person('revoked')]), revoked.context));
  assert.equal((await db.select().from(eventParticipants).where(eq(eventParticipants.eventId, revokedEvent.id))).length, 0);
  checks.push('revoked bearer link is rechecked inside the transaction');

  const editEvent = await makeEvent(), edit = await makeInvitation(editEvent);
  const changed = await updateInvitationRepository(edit.invitation, { quota: 1 });
  assert.equal(changed.quota, 1, 'database microseconds do not cause false revision conflicts');
  await assert.rejects(updateInvitationRepository(edit.invitation, { quota: 2 }));
  const newHash = hashToken(randomUUID());
  await updateInvitationRepository(changed, { invitationNumber: `QA-EDIT-${randomUUID()}` }, { tokenHash: newHash, expiresAt: new Date('2098-12-31') });
  const links = await db.select().from(invitationLinks).where(eq(invitationLinks.invitationId, edit.invitation.id));
  assert.equal(links.filter(link => !link.revokedAt).length, 1);
  assert.equal(links.find(link => !link.revokedAt).tokenHash, newHash);
  checks.push('invitation edit uses precise revision checks and atomic link rotation');
  console.log(JSON.stringify({ result: 'PASS', branchId, checks }, null, 2));
} finally { await server.close(); }
