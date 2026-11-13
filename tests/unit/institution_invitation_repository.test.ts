import { beforeEach, describe, expect, it, vi } from "vitest";
import { invitations, invitationLinks, eventParticipants } from "../../netlify/functions/lib/db/schema";

const mocks = vi.hoisted(() => ({ db: { select: vi.fn(), update: vi.fn(), insert: vi.fn() } }));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: () => mocks.db }));
vi.mock("../../netlify/functions/lib/db/transaction", () => ({ withTransaction: (callback: (tx: unknown) => unknown) => callback(mocks.db) }));
vi.mock("../../netlify/functions/lib/services/registrationCapacity", () => ({
  lockRegistrationEvent: async () => ({ id: "event", status: "PUBLISHED", invitationResponseDeadline: null }), assertRegistrationCapacity: async () => {},
}));
import { saveInstitutionDelegationRepository as save, updateInvitationRepository } from "../../netlify/functions/lib/repositories/invitationRepository";
import { createInstitutionAccessVerification } from "../../netlify/functions/lib/services/institutionAccessCodeService";
const saveInstitutionDelegationRepository = (id: string, payload: Parameters<typeof save>[1]) => save(id, payload, {
  eventId: "event", tokenHash: "hash", verificationToken: createInstitutionAccessVerification(id).verificationToken,
});

const invitation = { id: "invitation", eventId: "event", invitationType: "INSTITUTION", institutionId: "institution", quota: 3,
  invitationNumber: "UND-1", status: "SENT", updatedAt: new Date("2026-01-01") };
const actions: Array<{ type: string; table: unknown; values?: any }> = [];
let updatedRows: any[], selectRows: any[][];
beforeEach(() => {
  vi.clearAllMocks(); actions.length = 0; updatedRows = [{ ...invitation }]; selectRows = [];
  mocks.db.update.mockImplementation((table) => ({ set: (values: unknown) => {
    actions.push({ type: "update", table, values });
    return { where: () => ({ returning: async () => updatedRows, then: (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve) }) };
  } }));
  mocks.db.insert.mockImplementation((table) => ({ values: (values: unknown) => {
    actions.push({ type: "insert", table, values });
    return { returning: async () => [{ id: "response" }], onConflictDoNothing: () => ({ returning: async () => [{ id: "participant", participantCode: "P-TEST" }] }),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve([]).then(resolve) };
  } }));
  mocks.db.select.mockImplementation(() => ({ from: () => ({ where: () => ({
    limit: () => { const result = selectRows.shift() || []; return Object.assign(Promise.resolve(result), { for: async () => result }); },
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(selectRows.shift() || []).then(resolve),
  }) }) }));
});

describe("integritas penyimpanan undangan", () => {
  it("mengubah relasi dan merotasi tautan dalam transaksi yang sama", async () => {
    await updateInvitationRepository(invitation as any, { institutionId: "new-institution" }, { tokenHash: "new-hash", expiresAt: null });
    expect(actions.map(({ type, table }) => [type, table === invitations ? "invitation" : "links"]))
      .toEqual([["update", "invitation"], ["update", "links"], ["insert", "links"]]);
    expect(actions[2].values).toMatchObject({ invitationId: invitation.id, tokenHash: "new-hash" });
  });
  it("memperpanjang expiry tautan aktif tanpa mengganti token saat tenggat diedit", async () => {
    const deadline = new Date("2099-01-01");
    await updateInvitationRepository(invitation as any, { responseDeadline: deadline });
    expect(actions).toHaveLength(2); expect(actions[1]).toMatchObject({ type: "update", table: invitationLinks, values: { expiresAt: deadline } });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });
  it("membuka masa berlaku tautan yang sama saat pola berubah menjadi mandiri", async () => {
    selectRows = [[{ total: 1 }]];
    await updateInvitationRepository({ ...invitation, registrationMode: "DELEGATION", status: "ACCEPTED" } as any,
      { registrationMode: "INDIVIDUAL_SELF", status: "OPENED", quota: 15 });
    expect(actions).toHaveLength(2);
    expect(actions[0].values).toMatchObject({ registrationMode: "INDIVIDUAL_SELF", status: "OPENED", quota: 15 });
    expect(actions[1]).toMatchObject({ table: invitationLinks, values: { expiresAt: null } });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });
  it("menolak pindah ke perwakilan bila pendaftar mandiri baru masuk sebelum transaksi edit", async () => {
    selectRows = [[{ total: 1 }]];
    await expect(updateInvitationRepository({ ...invitation, registrationMode: "INDIVIDUAL_SELF", status: "OPENED" } as any,
      { registrationMode: "DELEGATION", quota: 3 })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });
  it("tidak mengeluarkan tautan pengganti jika revisi penyimpanan konflik", async () => {
    updatedRows = [];
    await expect(updateInvitationRepository(invitation as any, { quota: 1 }, { tokenHash: "new-hash", expiresAt: null })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });
  it("menolak penurunan kuota mandiri yang kalah cepat dari pendaftaran baru", async () => {
    selectRows = [[{ total: 3 }]];
    await expect(updateInvitationRepository({ ...invitation, registrationMode: "INDIVIDUAL_SELF" } as any, { quota: 2 }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.db.update).not.toHaveBeenCalled();
  });
  it.each(["ACCEPTED", "DECLINED", "REVOKED"])("tidak menyimpan respons kedua untuk undangan %s", async (status) => {
    selectRows = [[{ ...invitation, status }]];
    await expect(saveInstitutionDelegationRepository(invitation.id, { responseStatus: "ACCEPTED", isFinal: true, delegates: [] })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });
  it("membaca ulang kuota sebelum menulis, bukan hanya mengandalkan form lama", async () => {
    selectRows = [[{ ...invitation, quota: 1 }]];
    await expect(saveInstitutionDelegationRepository(invitation.id, { responseStatus: "ACCEPTED", isFinal: true,
      delegates: [{ fullName: "Ustadz Ahmad" }, { fullName: "Ustadz Hasan" }] })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });
  it("menolak pendaftaran mandiri saat kuota terpakai, di dalam transaksi terkunci", async () => {
    selectRows = [[{ ...invitation, registrationMode: "INDIVIDUAL_SELF", status: "OPENED" }], [{ total: 3 }]];
    await expect(saveInstitutionDelegationRepository(invitation.id, { responseStatus: "ACCEPTED", isFinal: true,
      delegates: [{ fullName: "Ustadz Ahmad" }] })).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.db.insert).not.toHaveBeenCalled();
  });
  it("menyimpan setiap asatidz mandiri tanpa menutup tautan lembaga", async () => {
    selectRows = [[{ ...invitation, registrationMode: "INDIVIDUAL_SELF", status: "OPENED" }], [{ total: 1 }],
      [{ expiresAt: new Date("2099-01-01") }],
      [{ id: "response", fullName: "Ustadz Ahmad", email: null, profileStatus: "ACTIVE" }], [], []];
    const saved = await saveInstitutionDelegationRepository(invitation.id, { responseStatus: "ACCEPTED", isFinal: true,
      delegates: [{ fullName: "Ustadz Ahmad", isLead: true }] });
    expect(saved.participants).toHaveLength(1);
    expect(actions.find(({ table }) => table === eventParticipants)?.values).toMatchObject({
      registrationSource: "INSTITUTION_INVITATION", isDelegationLead: false,
    });
    expect(actions.find(({ table }) => table === invitations)?.values).toMatchObject({ status: "OPENED" });
  });
  it("tidak mengambil alih peserta dari pendaftaran reguler atau undangan lain", async () => {
    const profile = { id: "ustadz", fullName: "Ustadz Ahmad", normalizedName: "ustadz ahmad", email: "ahmad@example.invalid", profileStatus: "ACTIVE" };
    selectRows = [[invitation], [{ expiresAt: new Date("2099-01-01") }], [profile], [profile], [{ id: "existing-participant" }]];
    await expect(saveInstitutionDelegationRepository(invitation.id, { responseStatus: "ACCEPTED", isFinal: true,
      delegates: [{ fullName: profile.fullName, email: profile.email, isLead: true }] })).rejects.toMatchObject({ statusCode: 409 });
    expect(actions.filter(({ table }) => table === eventParticipants)).toEqual([]);
    expect(mocks.db.update).not.toHaveBeenCalled();
  });
});
