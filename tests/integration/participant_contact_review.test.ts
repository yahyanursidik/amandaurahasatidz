import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { eq } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../netlify/functions/lib/db/schema";
import { recordWhatsAppProposal } from "../../netlify/functions/lib/services/participantContactReview";
import { findParticipantsRepository } from "../../netlify/functions/lib/repositories/participantRepository";
import { updateOwnPortalProfileRepository } from "../../netlify/functions/lib/repositories/portalProfileRepository";
import { updateUstadzRepository } from "../../netlify/functions/lib/repositories/ustadzRepository";
import { resolveEventWhatsAppRecipientsService } from "../../netlify/functions/lib/services/participantWhatsAppService";

const local = vi.hoisted(() => ({ db: undefined as ReturnType<typeof drizzle<typeof schema>> | undefined }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => local.db! }));
const pg = new PGlite();
const db = drizzle(pg, { schema });
const uuid = (id: number) => `00000000-0000-4000-8000-${String(id).padStart(12, "0")}`;
const eventA = uuid(510), eventB = uuid(511), participantA = uuid(512), participantB = uuid(513), profileId = uuid(514);
const owner = uuid(515), other = uuid(516), admin = uuid(517);
const changedAt = new Date("2026-11-11T01:00:00Z");
const now = new Date("2026-11-13T01:00:00Z");
const oldNumber = "6281234567801", proposal = "6281234567802", chosen = "6281234567803";

async function profile() {
  return (await db.select().from(schema.ustadzProfiles).where(eq(schema.ustadzProfiles.id, profileId)))[0];
}
async function pending() { return (await findParticipantsRepository(eventA))[0]?.pendingWhatsapp; }
async function propose(number = proposal, id = participantA) {
  await recordWhatsAppProposal(db as never, id, number, oldNumber);
}

beforeAll(async () => {
  local.db = db;
  const migrations = join(process.cwd(), "drizzle");
  for (const name of readdirSync(migrations).filter((file) => file.endsWith(".sql")).sort()) {
    await pg.exec(readFileSync(join(migrations, name), "utf8"));
  }
}, 60_000);
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(now);
  await pg.exec("truncate table events, users, roles, ustadz_profiles, institutions cascade");
  await db.insert(schema.users).values([
    { id: owner, email: "owner@review.invalid", name: "Owner" },
    { id: other, email: "other@review.invalid", name: "Other" },
    { id: admin, email: "admin@review.invalid", name: "Admin" },
  ]);
  await db.insert(schema.events).values([eventA, eventB].map((id, index) => ({ id, code: `CONTACT-${index}`,
    slug: `contact-${index}`, name: "Daurah Uji Kontak", startDate: "2026-11-13", endDate: "2026-11-15",
    timezone: "Asia/Jakarta", status: "REGISTRATION_OPEN", attendanceConfirmationRequired: true })));
  await db.insert(schema.ustadzProfiles).values({ id: profileId, userId: owner, fullName: "Ahmad Uji",
    normalizedName: "ahmad uji", email: "owner@review.invalid", whatsapp: oldNumber, updatedAt: changedAt });
  await db.insert(schema.eventParticipants).values([
    { id: participantA, ustadzId: profileId, eventId: eventA, participantCode: "CONTACT-A", approvalStatus: "APPROVED", confirmationStatus: "INVITED" },
    { id: participantB, ustadzId: profileId, eventId: eventB, participantCode: "CONTACT-B", approvalStatus: "APPROVED", confirmationStatus: "INVITED" },
  ]);
});
afterEach(() => vi.useRealTimers());
afterAll(async () => { await pg.close(); local.db = undefined; });

describe("WhatsApp contact proposals have a complete, ownership-safe review workflow", () => {
  it("exposes the latest proposal in participant data and blocks using the outdated master contact", async () => {
    await propose("081234567802");
    expect(await pending()).toBe(proposal);
    const recipients = await resolveEventWhatsAppRecipientsService(eventA, [participantA], true);
    expect(recipients.recipients[0]).toMatchObject({ number: null, needsContactReview: true, confirmationAvailable: false });
    expect((await profile()).whatsapp).toBe(oldNumber);
  });

  it("resolves all reviewed proposals when the owner explicitly chooses another number", async () => {
    await propose();
    await propose("6281234567810", participantB);
    const saved = await updateOwnPortalProfileRepository(await profile(), owner, { whatsapp: chosen });
    expect(saved?.whatsapp).toBe(chosen);
    expect(await pending()).toBeNull();
    const rows = await db.select().from(schema.participantStatusHistories);
    const initial = rows.filter((row) => row.toStatus === "PENDING");
    const resolved = rows.filter((row) => row.toStatus === "RESOLVED");
    expect(initial).toHaveLength(2);
    expect(resolved.map((row) => row.fromStatus).sort()).toEqual(initial.map((row) => row.id).sort());
    expect(resolved.every((row) => row.changedBy === owner)).toBe(true);
    const recipients = await resolveEventWhatsAppRecipientsService(eventA, [participantA], true);
    expect(recipients.recipients[0]).toMatchObject({ number: chosen, confirmationAvailable: true });
    expect(recipients.recipients[0]).not.toHaveProperty("needsContactReview");
  });

  it("does not resolve reviews after an unrelated, unauthorized or stale profile update", async () => {
    await propose();
    const current = await profile();
    expect(await updateOwnPortalProfileRepository(current, other, { whatsapp: chosen })).toBeUndefined();
    expect(await pending()).toBe(proposal);
    expect(await updateOwnPortalProfileRepository({ ...current, updatedAt: new Date("2020-01-01") }, owner, { whatsapp: chosen })).toBeUndefined();
    expect(await pending()).toBe(proposal);
    expect((await updateOwnPortalProfileRepository(current, owner, { address: "Alamat baru" }))?.address).toBe("Alamat baru");
    expect(await pending()).toBe(proposal);
    expect((await db.select().from(schema.participantStatusHistories)).every((row) => row.toStatus === "PENDING")).toBe(true);
  });

  it("resolves an explicit authorized admin save and leaves a newer proposal pending, even with the same timestamp", async () => {
    await propose();
    const current = await profile();
    expect(await updateUstadzRepository(profileId, { whatsapp: chosen }, { actorUserId: admin, expectedUpdatedAt: new Date("2020-01-01") })).toBeNull();
    expect(await pending()).toBe(proposal);
    expect((await updateUstadzRepository(profileId, { whatsapp: chosen }, { actorUserId: admin, expectedUpdatedAt: current.updatedAt }))?.whatsapp).toBe(chosen);
    expect(await pending()).toBeNull();
    // A per-proposal resolution cannot swallow this future submission on the same clock tick.
    await recordWhatsAppProposal(db as never, participantA, "6281234567811", chosen);
    expect(await pending()).toBe("6281234567811");
    const recipients = await resolveEventWhatsAppRecipientsService(eventA, [participantA], true);
    expect(recipients.recipients[0]).toMatchObject({ number: null, needsContactReview: true });
  });
});
