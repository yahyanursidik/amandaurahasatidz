import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  find: vi.fn(), list: vi.fn(), number: vi.fn(), token: vi.fn(), create: vi.fn(), update: vi.fn(), count: vi.fn(),
  status: vi.fn(), opened: vi.fn(), rotate: vi.fn(), save: vi.fn(), event: vi.fn(), institution: vi.fn(), options: vi.fn(), audit: vi.fn(),
  ustadzOptions: vi.fn(), recipient: vi.fn(), openIndividual: vi.fn(), participantForUstadz: vi.fn(),
}));
vi.mock("../../netlify/functions/lib/repositories/invitationRepository", () => ({
  findInvitationByIdRepository: mocks.find, findInvitationsRepository: mocks.list,
  findInvitationByEventAndNumberRepository: mocks.number, findInvitationByTokenHashRepository: mocks.token,
  createInvitationRepository: mocks.create, updateInvitationRepository: mocks.update,
  countInvitationParticipantsRepository: mocks.count, updateInvitationStatusRepository: mocks.status,
  rotateInvitationLinkRepository: mocks.rotate, saveInstitutionDelegationRepository: mocks.save,
  markInvitationOpenedRepository: mocks.opened,
  findInvitationUstadzOptionsRepository: mocks.ustadzOptions,
  findInvitationUstadzRecipientRepository: mocks.recipient,
  findOpenIndividualInvitationRepository: mocks.openIndividual,
  findUstadzEventParticipationRepository: mocks.participantForUstadz,
}));
vi.mock("../../netlify/functions/lib/repositories/eventRepository", () => ({ findEventByIdRepository: mocks.event, findRegistrationEventRepository: mocks.event }));
vi.mock("../../netlify/functions/lib/repositories/institutionRepository", () => ({
  findInstitutionByIdRepository: mocks.institution, findInvitationInstitutionOptionsRepository: mocks.options,
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));

import { createInvitationService, editInvitationService, getInvitationInstitutionsService, getInvitationUstadzOptionsService, getInvitationsService,
  sendInvitationService, revokeInvitationService, regenerateInvitationLinkService,
  getPublicInstitutionInvitationService, getPublicIndividualInvitationService, submitInstitutionResponseService,
} from "../../netlify/functions/lib/services/invitationService";
import { createInvitationSchema, updateInvitationSchema } from "../../netlify/functions/lib/validations/invitationValidation";
import { invitationAllowsGroup, invitationParticipantLimit } from "../../src/lib/institutionInvitation";

const eventId = "11111111-1111-4111-8111-111111111111";
const id = "22222222-2222-4222-8222-222222222222";
const institutionId = "33333333-3333-4333-8333-333333333333";
const otherId = "44444444-4444-4444-8444-444444444444";
const deadline = new Date("2099-01-20T08:00:00Z");
const invitation = { id, eventId, institutionId, invitationType: "INSTITUTION", invitationNumber: "UND-01",
  quota: 3, status: "SENT", respondedAt: null, responseDeadline: deadline, updatedAt: new Date("2026-01-01") };
const event = { id: eventId, name: "Daurah Uji", audienceMode: "MIXED", status: "PUBLISHED", defaultInstitutionQuota: 4,
  invitationResponseDeadline: deadline, startDate: "2099-02-01", endDate: "2099-02-03", timezone: "Asia/Makassar" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Network disabled in invitation unit tests"); }));
  mocks.find.mockResolvedValue({ ...invitation }); mocks.number.mockResolvedValue(null); mocks.count.mockResolvedValue(0);
  mocks.event.mockResolvedValue({ ...event });
  mocks.institution.mockResolvedValue({ id: institutionId, name: "Ma'had Uji", code: "MU", status: "ACTIVE", deletedAt: null });
  mocks.update.mockImplementation(async (existing, changes) => ({ ...existing, ...changes }));
  mocks.create.mockImplementation(async (input) => ({ invitation: { id, ...input } }));
  mocks.rotate.mockResolvedValue({ id: "link", expiresAt: deadline }); mocks.options.mockResolvedValue([]);
  mocks.ustadzOptions.mockResolvedValue([]); mocks.openIndividual.mockResolvedValue(null);
  mocks.participantForUstadz.mockResolvedValue(null);
  mocks.recipient.mockResolvedValue({ id: otherId, fullName: "Ustadz Uji", email: "ustadz@example.invalid",
    whatsapp: "081200000000", phone: null, profileStatus: "ACTIVE", deletedAt: null, mergedIntoId: null });
  mocks.token.mockResolvedValue({ invitation: { ...invitation }, event: { ...event }, link: { id: "link", expiresAt: deadline },
    institution: { name: "Ma'had Uji", code: "MU", email: "private@example.invalid" } });
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("kebijakan rombongan kompatibel dengan undangan lama", () => {
  it("menurunkan kebijakan dari kuota, tanpa kolom atau migrasi tambahan", () => {
    expect(invitationAllowsGroup({ quota: 3 })).toBe(true);
    expect(invitationAllowsGroup({ quota: 1 })).toBe(false);
    expect(invitationParticipantLimit({ quota: 99, allowGroup: false })).toBe(1);
    expect(invitationParticipantLimit({ quota: 99, invitationType: "INDIVIDUAL" })).toBe(1);
  });
  it("memvalidasi PATCH parsial dan menolak penggantian status/type/event melalui payload", () => {
    expect(updateInvitationSchema.parse({ allowGroup: false })).toEqual({ allowGroup: false });
    for (const value of [{}, { quota: 1.5 }, { quota: 1001 }, { responseDeadline: "tanggal-rusak" },
      { status: "ACCEPTED" }, { eventId: otherId }, { invitationType: "INDIVIDUAL" }]) {
      expect(updateInvitationSchema.safeParse(value).success).toBe(false);
    }
  });
  it("membuat satu perwakilan walaupun klien menyisipkan kuota lebih besar", async () => {
    const input = createInvitationSchema.parse({ eventId, institutionId, invitationType: "INSTITUTION", invitationNumber: "UND-1", allowGroup: false, quota: 50 });
    const saved = await createInvitationService(input, "actor", "request");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ quota: 1, institutionId }), expect.any(String));
    expect(saved.invitation.allowGroup).toBe(false);
  });
  it("menggunakan kuota default event jika tidak dikirim, tetapi menolak rombongan kuota satu", async () => {
    await createInvitationService({ eventId, institutionId, invitationType: "INSTITUTION", invitationNumber: "UND-2" }, "actor", "request");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ quota: 4 }), expect.any(String));
    await expect(editInvitationService(eventId, id, { allowGroup: true, quota: 1 }, "actor", "request")).rejects.toMatchObject({ statusCode: 422 });
  });
  it("menolak lembaga nonaktif dan jalur event yang tidak sesuai", async () => {
    mocks.institution.mockResolvedValue({ status: "INACTIVE" });
    await expect(createInvitationService({ eventId, institutionId, invitationType: "INSTITUTION", invitationNumber: "UND-1" }, "actor", "request")).rejects.toMatchObject({ statusCode: 422 });
    mocks.event.mockResolvedValue({ ...event, audienceMode: "PUBLIC_OPEN" });
    await expect(createInvitationService({ eventId, institutionId, invitationType: "INSTITUTION", invitationNumber: "UND-1" }, "actor", "request")).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("mengembalikan izin rombongan dan tenggat event pada daftar", async () => {
    mocks.list.mockResolvedValue([{ ...invitation, responseDeadline: null, eventResponseDeadline: deadline }]);
    expect(await getInvitationsService(eventId)).toEqual([expect.objectContaining({ allowGroup: true, responseDeadline: deadline })]);
  });
});

describe("edit undangan dan integritas relasi", () => {
  it("menolak formulir dengan revisi yang sudah tertinggal", async () => {
    await expect(editInvitationService(eventId, id, { quota: 2, expectedUpdatedAt: "2025-01-01T00:00:00Z" }, "actor", "request")).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("menyimpan pengaturan tanpa memutar tautan jika penerima tidak berubah", async () => {
    const saved = await editInvitationService(eventId, id, { invitationNumber: "UND-02", allowGroup: false, quota: 9 }, "actor", "request");
    expect(mocks.update).toHaveBeenCalledWith(invitation, expect.objectContaining({ quota: 1, invitationNumber: "UND-02" }), undefined);
    expect(saved).not.toHaveProperty("publicUrl");
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "INVITATION_UPDATED", eventId, beforeData: invitation }));
  });
  it("mengunci lembaga setelah respons final/ada peserta dan mencegah kuota di bawah jumlah peserta", async () => {
    mocks.count.mockResolvedValue(2);
    await expect(editInvitationService(eventId, id, { institutionId: otherId }, "actor", "request")).rejects.toMatchObject({ statusCode: 409 });
    await expect(editInvitationService(eventId, id, { allowGroup: false }, "actor", "request")).rejects.toMatchObject({ statusCode: 409 });
    mocks.count.mockResolvedValue(0); mocks.find.mockResolvedValue({ ...invitation, status: "DECLINED", respondedAt: new Date() });
    await expect(editInvitationService(eventId, id, { institutionId: otherId }, "actor", "request")).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("mengizinkan edit metadata respons final tanpa mengubah peserta atau statusnya", async () => {
    mocks.find.mockResolvedValue({ ...invitation, status: "ACCEPTED", respondedAt: new Date() }); mocks.count.mockResolvedValue(2);
    await editInvitationService(eventId, id, { invitationNumber: "UND-02", quota: 3 }, "actor", "request");
    const changes = mocks.update.mock.calls[0][1];
    expect(changes).not.toHaveProperty("status"); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("mengganti lembaga dengan tautan baru dan mereset status pengiriman", async () => {
    const result = await editInvitationService(eventId, id, { institutionId: otherId }, "actor", "request");
    expect(mocks.update).toHaveBeenCalledWith(invitation, expect.objectContaining({ institutionId: otherId, status: "DRAFT", sentAt: null }),
      expect.objectContaining({ tokenHash: expect.any(String), expiresAt: deadline }));
    expect(result.publicUrl).toMatch(/^\/invitation\/institution\/mahad-uji\/inv_inst_/);
  });
  it("memperbarui batas waktu tautan bersama tenggat undangan dan menolak tanggal baru yang lewat", async () => {
    await editInvitationService(eventId, id, { responseDeadline: "2099-01-21T08:00:00Z" }, "actor", "request");
    expect(mocks.update).toHaveBeenCalledWith(invitation, expect.objectContaining({ responseDeadline: new Date("2099-01-21T08:00:00Z") }), undefined);
    await expect(editInvitationService(eventId, id, { responseDeadline: "2000-01-01T00:00:00Z" }, "actor", "request")).rejects.toMatchObject({ statusCode: 422 });
  });
  it("menolak duplikat nomor serta undangan/event yang sudah dikunci", async () => {
    mocks.number.mockResolvedValue({ id: otherId });
    await expect(editInvitationService(eventId, id, { invitationNumber: "UND-02" }, "actor", "request")).rejects.toMatchObject({ statusCode: 409 });
    mocks.find.mockResolvedValue({ ...invitation, status: "REVOKED" });
    await expect(editInvitationService(eventId, id, { quota: 2 }, "actor", "request")).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
});

describe("undangan perorangan", () => {
  const individual = { ...invitation, invitationType: "INDIVIDUAL", institutionId: null, ustadzId: otherId, quota: 1 };
  it("membatasi undangan ke satu profil aktif dan satu kursi", async () => {
    const input = createInvitationSchema.parse({ eventId, ustadzId: otherId, invitationType: "INDIVIDUAL", invitationNumber: "PR-01" });
    const result = await createInvitationService(input, "actor", "request");
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ ustadzId: otherId, institutionId: null, quota: 1 }), expect.any(String));
    expect(result.publicUrl).toMatch(/^\/invitation\/individual\/inv_ind_/);
    expect(result.invitation.ustadzName).toBe("Ustadz Uji");
    expect(createInvitationSchema.safeParse({ ...input, quota: 2 }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ ...input, institutionId }).success).toBe(false);
  });
  it("menolak profil nonaktif, undangan aktif ganda, dan peserta yang sudah terdaftar", async () => {
    mocks.recipient.mockResolvedValueOnce({ profileStatus: "INACTIVE" });
    await expect(createInvitationService({ eventId, ustadzId: otherId, invitationType: "INDIVIDUAL", invitationNumber: "PR-01" }, "actor", "request"))
      .rejects.toMatchObject({ statusCode: 422 });
    mocks.openIndividual.mockResolvedValueOnce({ id, invitationNumber: "PR-LAMA" });
    await expect(createInvitationService({ eventId, ustadzId: otherId, invitationType: "INDIVIDUAL", invitationNumber: "PR-01" }, "actor", "request"))
      .rejects.toMatchObject({ statusCode: 409 });
    mocks.participantForUstadz.mockResolvedValueOnce({ id });
    await expect(createInvitationService({ eventId, ustadzId: otherId, invitationType: "INDIVIDUAL", invitationNumber: "PR-01" }, "actor", "request"))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it("mengedit tenggat tanpa mengganti tautan, tetapi memutar tautan bila penerima berubah", async () => {
    mocks.find.mockResolvedValue(individual);
    const unchanged = await editInvitationService(eventId, id, { invitationNumber: "PR-02" }, "actor", "request");
    expect(unchanged).not.toHaveProperty("publicUrl");
    expect(mocks.update).toHaveBeenCalledWith(individual, expect.objectContaining({ ustadzId: otherId, quota: 1 }), undefined);
    const nextRecipient = "55555555-5555-4555-8555-555555555555";
    const changed = await editInvitationService(eventId, id, { ustadzId: nextRecipient }, "actor", "request");
    expect(mocks.openIndividual).toHaveBeenCalledWith(eventId, nextRecipient, id);
    expect(mocks.update).toHaveBeenLastCalledWith(individual, expect.objectContaining({ ustadzId: nextRecipient, status: "DRAFT", sentAt: null }),
      expect.objectContaining({ tokenHash: expect.any(String) }));
    expect(changed.publicUrl).toMatch(/^\/invitation\/individual\/inv_ind_/);
  });
  it("mengunci penerima setelah respons dan tidak menerima kuota rombongan", async () => {
    mocks.find.mockResolvedValue({ ...individual, respondedAt: new Date() });
    await expect(editInvitationService(eventId, id, { ustadzId: institutionId }, "actor", "request")).rejects.toMatchObject({ statusCode: 409 });
    await expect(editInvitationService(eventId, id, { quota: 2 }, "actor", "request")).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("halaman publik menampilkan nama penerima tanpa membocorkan kontak direktori", async () => {
    mocks.token.mockResolvedValue({ invitation: individual, event, link: { id: "link", expiresAt: deadline } });
    const result = await getPublicIndividualInvitationService("inv_ind_token", "request");
    expect(result.recipient).toEqual({ fullName: "Ustadz Uji" });
    expect(result.invitation).toMatchObject({ quota: 1, allowGroup: false });
    expect(JSON.stringify(result)).not.toContain("ustadz@example.invalid");
  });
  it("picker memakai izin event, bukan direktori global", async () => {
    await getInvitationUstadzOptionsService(eventId, "Uji", 2, 20);
    expect(mocks.ustadzOptions).toHaveBeenCalledWith("Uji", 2, 20);
  });
});

describe("keamanan lingkup event dan formulir publik", () => {
  it.each([sendInvitationService, revokeInvitationService, regenerateInvitationLinkService])("menolak ID undangan dari event lain sebelum mutasi", async (action) => {
    await expect(action(otherId, id, "actor", "request")).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.status).not.toHaveBeenCalled(); expect(mocks.rotate).not.toHaveBeenCalled();
  });
  it("menolak PATCH lintas event", async () => {
    await expect(editInvitationService(otherId, id, { quota: 5 }, "actor", "request")).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it.each([sendInvitationService, revokeInvitationService, regenerateInvitationLinkService])("tidak membuka kembali status final melalui aksi tautan", async (action) => {
    mocks.find.mockResolvedValue({ ...invitation, status: "ACCEPTED" });
    await expect(action(eventId, id, "actor", "request")).rejects.toThrow();
    expect(mocks.status).not.toHaveBeenCalled(); expect(mocks.rotate).not.toHaveBeenCalled();
  });
  it("memakai master aktif untuk picker tanpa mengambil riwayat global", async () => {
    await getInvitationInstitutionsService(eventId, 2, 50);
    expect(mocks.options).toHaveBeenCalledWith(2, 50); expect(mocks.institution).not.toHaveBeenCalled();
  });
  it("mengirim identitas lembaga tanpa kontak PIC, dan kebijakan peserta pada API publik", async () => {
    const result = await getPublicInstitutionInvitationService("inv_inst_token", "request");
    expect(result.invitation).toMatchObject({ quota: 3, allowGroup: true });
    expect(result.invitation.status).toBe("OPENED"); expect(mocks.opened).toHaveBeenCalledWith(id);
    expect(result.institution).toEqual({ name: "Ma'had Uji", code: "MU", verificationRequired: false });
    expect(JSON.stringify(result)).not.toContain("private@example.invalid");
  });
  it("menolak token yang dibuka melalui tipe undangan yang salah", async () => {
    await expect(getPublicIndividualInvitationService("inv_inst_token", "request")).rejects.toMatchObject({ statusCode: 404 });
    mocks.token.mockResolvedValue({ invitation: { ...invitation, invitationType: "INDIVIDUAL" }, event, link: {} });
    await expect(getPublicInstitutionInvitationService("inv_ind_token", "request")).rejects.toMatchObject({ statusCode: 404 });
  });
  it("menolak peserta tambahan dari klien ketika kuota terbaru menjadi satu", async () => {
    mocks.token.mockResolvedValue({ invitation: { ...invitation, quota: 1 }, event, link: {} });
    await expect(submitInstitutionResponseService("token", { responseStatus: "ACCEPTED", isFinal: true, delegates: [{}, {}] }, "request")).rejects.toMatchObject({ statusCode: 422 });
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("menolak respons pada event yang dibatalkan", async () => {
    mocks.token.mockResolvedValue({ invitation, event: { ...event, status: "CANCELLED" }, link: {} });
    await expect(submitInstitutionResponseService("token", { responseStatus: "ACCEPTED", delegates: [{}] }, "request")).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
