import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ find: vi.fn(), lock: vi.fn(), capacity: vi.fn(), select: vi.fn(), audit: vi.fn(), email: vi.fn() }));
vi.mock("../../netlify/functions/lib/repositories/eventRepository", () => ({ findEventBySlugRepository: mocks.find }));
vi.mock("../../netlify/functions/lib/repositories/participantRepository", () => ({
  countApprovedParticipantsBySourceRepository: async () => 0,
  countApprovedParticipantsForEventRepository: async () => 0,
}));
vi.mock("../../netlify/functions/lib/db/transaction", () => ({ withTransaction: (fn: (tx: unknown) => unknown) => fn({ select: mocks.select }) }));
vi.mock("../../netlify/functions/lib/services/registrationCapacity", () => ({ lockRegistrationEvent: mocks.lock, assertRegistrationCapacity: mocks.capacity }));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));
vi.mock("../../netlify/functions/lib/services/participantCardEmailService", () => ({ queueRegistrationReceivedEmails: mocks.email }));
import { submitPublicRegistrationService } from "../../netlify/functions/lib/services/publicRegistrationService";

const event = { id: "event-1", status: "REGISTRATION_OPEN", audienceMode: "MIXED", regularAllowGroup: true, regularQuota: 20, capacity: 30 };
const person = { fullName: "Ustadz Ahmad", email: "ahmad@policy.invalid", whatsapp: "081234567890", city: "Bandung", province: "Jawa Barat" };
const group = { ...person, consentConfirmed: true as const, delegates: [{ ...person, email: "hasan@policy.invalid" }] };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.find.mockResolvedValue(event);
  mocks.lock.mockResolvedValue({ ...event, regularAllowGroup: false });
});

describe("perubahan kebijakan saat pendaftaran berjalan", () => {
  it("mengecek ulang izin rombongan setelah mendapatkan lock event, sebelum menulis identitas atau antrean", async () => {
    await expect(submitPublicRegistrationService("daurah", group, "test-policy-race"))
      .rejects.toMatchObject({ statusCode: 422, details: { reason: "REGULAR_GROUP_DISABLED" } });
    expect(mocks.lock).toHaveBeenCalledOnce();
    expect(mocks.capacity).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
    expect(mocks.audit).not.toHaveBeenCalled();
    expect(mocks.email).not.toHaveBeenCalled();
  });

  it("mengecek ulang batas grup setelah kuota diperkecil sebelum lock", async () => {
    mocks.lock.mockResolvedValue({ ...event, regularQuota: 1 });
    await expect(submitPublicRegistrationService("daurah", group, "test-quota-race")).rejects.toThrow(/Maksimal 1/);
    expect(mocks.capacity).not.toHaveBeenCalled();
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
