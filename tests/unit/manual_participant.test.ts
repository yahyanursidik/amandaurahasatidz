import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), transaction: vi.fn() },
  audit: vi.fn(), institution: vi.fn(),
}));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => mocks.db }));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));
vi.mock("../../netlify/functions/lib/services/registrationInstitutionService", () => ({ resolveRegistrationInstitution: mocks.institution }));

import { events, eventParticipants, ustadzProfiles } from "../../netlify/functions/lib/db/schema";
import { createManualParticipantService } from "../../netlify/functions/lib/services/manualParticipantService";
import { manualParticipantSchema } from "../../netlify/functions/lib/validations/participantValidation";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../../netlify/functions/lib/utils/errors";

const eventId = "11111111-1111-4111-8111-111111111111";
const actorId = "22222222-2222-4222-8222-222222222222";
const profileId = "33333333-3333-4333-8333-333333333333";
const participantId = "44444444-4444-4444-8444-444444444444";
const institutionId = "55555555-5555-4555-8555-555555555555";
const input: z.infer<typeof manualParticipantSchema> = {
  fullName: "Ahmad Hasan", email: "ahmad@example.org", whatsapp: "081234567890",
};
const profile = {
  id: profileId, fullName: input.fullName, normalizedName: "ahmad hasan",
  email: input.email, phone: "6281234567890", whatsapp: "6281234567890",
  address: "Alamat lama", profileStatus: "ACTIVE", deletedAt: null, mergedIntoId: null,
};
let rows: Map<object, unknown[]>;
let writes: Array<{ table: object; data: Record<string, unknown> }>;
let participantRace: boolean;
const conflictTarget = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  rows = new Map<object, unknown[]>([[events, [{ id: eventId, status: "REGISTRATION_OPEN", archivedAt: null }]],
    [ustadzProfiles, []], [eventParticipants, []]]);
  writes = [];
  participantRace = false;
  mocks.db.select.mockImplementation(() => ({
    from: (table: object) => ({
      where: () => ({
        limit: () => {
          const result = rows.get(table) || [];
          return Object.assign(Promise.resolve(result), { for: vi.fn(async () => result) });
        },
      }),
    }),
  }));
  mocks.db.insert.mockImplementation((table: object) => ({
    values: (data: Record<string, unknown>) => {
      writes.push({ table, data });
      const builder = {
        onConflictDoNothing: (target: unknown) => { conflictTarget(target); return builder; },
        returning: async () => table === eventParticipants && participantRace ? [] : [{
          ...data, id: table === ustadzProfiles ? profileId : participantId,
        }],
      };
      return builder;
    },
  }));
  // Real withTransaction helper, fake database: no database connections or mutations.
  mocks.db.transaction.mockImplementation(async (callback: (tx: typeof mocks.db) => Promise<unknown>) => callback(mocks.db));
  mocks.institution.mockResolvedValue(null);
  mocks.audit.mockResolvedValue(undefined);
});

function create(overrides: Partial<z.infer<typeof manualParticipantSchema>> = {}) {
  return createManualParticipantService(eventId, { ...input, ...overrides }, actorId, "manual-test-request");
}

describe("manualParticipantSchema", () => {
  it.each(["0812-3456-7890", "+62 812 3456 7890", "6281234567890", "81234567890"])(
    "normalizes Indonesian mobile format %s without changing global helpers", (whatsapp) => {
      expect(manualParticipantSchema.parse({ ...input, whatsapp }).whatsapp).toBe("6281234567890");
    },
  );
  it.each(["", "123", "12345678901", "+1 202 555 0199", "08bad1234567890", "628123456789012345"])(
    "rejects malformed or non-Indonesian phone %s", (whatsapp) => {
      expect(manualParticipantSchema.safeParse({ ...input, whatsapp }).success).toBe(false);
    },
  );
  it.each(["fullName", "email", "whatsapp"])("requires %s", (field) => {
    expect(manualParticipantSchema.safeParse({ ...input, [field]: undefined }).success).toBe(false);
    expect(manualParticipantSchema.safeParse({ ...input, [field]: " " }).success).toBe(false);
  });
  it("validates optional fields and requires a real boolean for confirmation", () => {
    expect(manualParticipantSchema.parse({ ...input, email: " AHMAD@example.org ", fullName: " Ahmad Hasan " }))
      .toMatchObject({ email: input.email, fullName: input.fullName });
    for (const invalid of [{ attendanceConfirmed: "true" }, { attendanceConfirmed: 1 },
      { phone: "bad" }, { phone: "" }, { institutionName: "ab" }, { address: "x".repeat(501) },
      { notes: "x".repeat(2001) }, { fullName: "Ustadz" }, { email: "bad-email" }]) {
      expect(manualParticipantSchema.safeParse({ ...input, ...invalid }).success).toBe(false);
    }
    expect(manualParticipantSchema.safeParse({ ...input, phone: null, institutionName: " ", attendanceConfirmed: false }).success).toBe(true);
  });
});

describe("createManualParticipantService (mocked database)", () => {
  it("creates a normalized profile and pending, invited ADMIN_ENTRY participant, with UUID audit resource", async () => {
    const result = await create({ address: " Alamat baru ", notes: " Catatan panitia " });
    expect(result).toMatchObject({ participantId, ustadzId: profileId, reusedProfile: false,
      approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED", registrationSource: "ADMIN_ENTRY" });
    expect(result.participantCode).toMatch(/^P-[0-9A-F]{32}$/);
    expect(writes[0]).toEqual({ table: ustadzProfiles, data: {
      fullName: input.fullName, normalizedName: "ahmad hasan", email: input.email,
      phone: "6281234567890", whatsapp: "6281234567890", address: "Alamat baru", profileStatus: "ACTIVE",
    } });
    expect(writes[1].data).toMatchObject({ eventId, ustadzId: profileId, institutionId: null,
      participantCode: result.participantCode, registrationSource: "ADMIN_ENTRY", approvalStatus: "PENDING_REVIEW",
      confirmationStatus: "INVITED", confirmedAt: null, approvedAt: null, approvedBy: null, notes: "Catatan panitia" });
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: actorId,
      action: "MANUAL_PARTICIPANT_CREATED", resourceType: "EVENT_PARTICIPANT", resourceId: participantId,
      eventId, requestId: "manual-test-request", afterData: result }));
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it.each([undefined, false, true])("only explicit true confirms attendance (%s); never approves", async (attendanceConfirmed) => {
    const result = await create({ attendanceConfirmed });
    expect(result.confirmationStatus).toBe(attendanceConfirmed === true ? "CONFIRMED" : "INVITED");
    const saved = writes.find((write) => write.table === eventParticipants)!.data;
    expect(saved.confirmedAt).toEqual(attendanceConfirmed === true ? expect.any(Date) : null);
    expect(saved.approvalStatus).toBe("PENDING_REVIEW");
    expect(saved.approvedAt).toBeNull();
    expect(saved.approvedBy).toBeNull();
  });

  it("preserves explicit phone and resolves optional institution using the supplied transaction", async () => {
    mocks.institution.mockResolvedValue(institutionId);
    const result = await create({ phone: "81299998888", institutionName: " Komunitas Ilmu " });
    expect(mocks.institution).toHaveBeenCalledWith(mocks.db, "Komunitas Ilmu");
    expect(writes[0].data.phone).toBe("6281299998888");
    expect(writes[1].data.institutionId).toBe(institutionId);
    expect(result.institutionId).toBe(institutionId);
  });

  it("reuses a single exact normalized identity without overwriting master data", async () => {
    rows.set(ustadzProfiles, [{ ...profile, email: " AHMAD@EXAMPLE.ORG ", phone: "0812-3456-7890", whatsapp: "+62 812 3456 7890" }]);
    const result = await create({ address: "Alamat baru" });
    expect(result.reusedProfile).toBe(true);
    expect(writes).toHaveLength(1);
    expect(writes[0].table).toBe(eventParticipants);
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("allows exact name plus contact when master email is missing, without backfilling it", async () => {
    rows.set(ustadzProfiles, [{ ...profile, email: null }]);
    expect((await create()).reusedProfile).toBe(true);
    expect(writes.map((write) => write.table)).toEqual([eventParticipants]);
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it.each([
    { fullName: "Hasan Lain" }, { email: "other@example.org" },
    { phone: "6281999999999" }, { whatsapp: "6281999999999" },
    { deletedAt: new Date() }, { mergedIntoId: actorId }, { profileStatus: "ARCHIVED" },
  ])("refuses conflicting or inactive identity %j before any writes", async (changes) => {
    rows.set(ustadzProfiles, [{ ...profile, ...changes }]);
    await expect(create()).rejects.toBeInstanceOf(ConflictError);
    expect(writes).toHaveLength(0);
    expect(mocks.institution).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.db.update).not.toHaveBeenCalled();
  });

  it("refuses ambiguous profiles, even when one matches email and the other shares a phone", async () => {
    rows.set(ustadzProfiles, [profile, { ...profile, id: actorId, email: "other@example.org" }]);
    await expect(create()).rejects.toThrow(/beberapa profil/);
    expect(writes).toHaveLength(0);
    expect(mocks.institution).not.toHaveBeenCalled();
  });

  it.each(["INVITED", "CONFIRMED", "CANCELLED", "REPLACED"])("refuses an existing event participant (%s), never updates", async (confirmationStatus) => {
    rows.set(ustadzProfiles, [profile]);
    rows.set(eventParticipants, [{ id: participantId, confirmationStatus }]);
    await expect(create({ institutionName: "Komunitas Baru" })).rejects.toThrow(/sudah terdaftar/);
    expect(writes).toHaveLength(0);
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.institution).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it("uses the event/profile unique constraint to refuse a concurrent duplicate without updating", async () => {
    rows.set(ustadzProfiles, [profile]);
    participantRace = true;
    await expect(create()).rejects.toBeInstanceOf(ConflictError);
    expect(conflictTarget).toHaveBeenCalledWith({ target: [eventParticipants.eventId, eventParticipants.ustadzId] });
    expect(mocks.db.update).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
  });

  it.each(["ARCHIVED", "COMPLETED", "CANCELLED"])("rejects event status %s before writes", async (status) => {
    rows.set(events, [{ id: eventId, status }]);
    await expect(create()).rejects.toBeInstanceOf(ForbiddenError);
    expect(writes).toHaveLength(0);
    expect(mocks.institution).not.toHaveBeenCalled();
  });
  it("rejects archivedAt even if status is stale", async () => {
    rows.set(events, [{ id: eventId, status: "ONGOING", archivedAt: new Date() }]);
    await expect(create()).rejects.toBeInstanceOf(ForbiddenError);
    expect(writes).toHaveLength(0);
  });
  it.each(["DRAFT", "PUBLISHED", "REGISTRATION_CLOSED", "ONGOING"])("allows admin entry for nonterminal status %s", async (status) => {
    rows.set(events, [{ id: eventId, status }]);
    expect((await create()).approvalStatus).toBe("PENDING_REVIEW");
  });
  it("rejects a nonexistent event", async () => {
    rows.set(events, []);
    await expect(create()).rejects.toBeInstanceOf(NotFoundError);
    expect(writes).toHaveLength(0);
  });
  it("validates again at the service boundary before touching the database", async () => {
    await expect(create({ attendanceConfirmed: "true" as unknown as boolean })).rejects.toBeInstanceOf(ValidationError);
    expect(mocks.db.select).not.toHaveBeenCalled();
    expect(mocks.db.transaction).not.toHaveBeenCalled();
  });
  it("uses existing Neon HTTP fallback once when interactive transactions are unsupported", async () => {
    mocks.db.transaction.mockRejectedValueOnce(new Error("No transactions support in neon-http driver"));
    expect((await create()).participantId).toBe(participantId);
    expect(writes).toHaveLength(2);
    expect(mocks.audit).toHaveBeenCalledTimes(1);
  });
  it("does not retry unrelated database failures or audit a failed creation", async () => {
    mocks.db.transaction.mockRejectedValueOnce(new Error("Database connection failed"));
    await expect(create()).rejects.toThrow("Database connection failed");
    expect(writes).toHaveLength(0);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("propagates institution resolution failure before profile creation", async () => {
    mocks.institution.mockRejectedValueOnce(new ConflictError("Institution conflict"));
    await expect(create({ institutionName: "Komunitas Ilmu" })).rejects.toThrow("Institution conflict");
    expect(writes).toHaveLength(0);
    expect(mocks.audit).not.toHaveBeenCalled();
  });
  it("generates independent UUID-derived codes for separate creations", async () => {
    const first = await create();
    const second = await create();
    expect(first.participantCode).not.toBe(second.participantCode);
  });
});