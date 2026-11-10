import { beforeEach, describe, expect, it, vi } from "vitest";
import { signParticipantConfirmationToken } from "../../netlify/functions/lib/utils/token";

const state = vi.hoisted(() => ({
  participant: { id: "123e4567-e89b-42d3-a456-426614174000", eventId: "123e4567-e89b-42d3-a456-426614174001",
    approvalStatus: "PENDING_REVIEW", confirmationStatus: "INVITED", participantCode: "PAR-2099-001", qrTokenVersion: 1 },
  event: { id: "123e4567-e89b-42d3-a456-426614174001", status: "REGISTRATION_OPEN", endDate: "2099-12-31",
    timezone: "Asia/Jakarta", attendanceConfirmationDeadline: null as Date | null, lateConfirmationPolicy: "BLOCK",
    name: "Daurah Asatidz", slug: "daurah-asatidz", attendanceConfirmationRequired: true },
  update: vi.fn(),
  history: vi.fn(),
  audit: vi.fn(),
  email: vi.fn(),
  lastUpdate: {} as Record<string, unknown>,
}));

vi.mock("../../netlify/functions/lib/services/registrationCapacity", () => ({
  lockRegistrationEvent: async () => state.event,
}));
vi.mock("../../netlify/functions/lib/db/transaction", () => ({
  withTransaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
    select: (fields?: Record<string, unknown>) => ({ from: () => ({ where: () => ({
      limit: () => fields?.id ? Promise.resolve([]) : { for: async () => [state.participant] },
    }) }) }),
    update: state.update,
    insert: () => ({ values: state.history }),
  }),
}));
vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => ({ select: (fields: Record<string, unknown>) => {
    const query = { from: () => query, innerJoin: () => query, where: () => query, orderBy: () => query,
      limit: async () => fields.reason ? state.history.mock.calls.map((call) => call[0] as { toStatus?: string; reason?: string })
        .filter((record) => record.toStatus === "CANCELLED").slice(-1) : fields.eventName ? [{
        participantId: state.participant.id, eventId: state.participant.eventId,
        participantCode: state.participant.participantCode, qrTokenVersion: state.participant.qrTokenVersion,
        approvalStatus: state.participant.approvalStatus, confirmationStatus: state.participant.confirmationStatus,
        participantName: "Ustadz Ahmad", eventName: state.event.name, eventSlug: state.event.slug,
        eventStatus: state.event.status, startDate: "2099-01-01", endDate: state.event.endDate,
        timezone: state.event.timezone, venueName: "Masjid Ilmu", publicContactWhatsapp: null,
        attendanceConfirmationRequired: state.event.attendanceConfirmationRequired,
        attendanceConfirmationDeadline: state.event.attendanceConfirmationDeadline,
        lateConfirmationPolicy: state.event.lateConfirmationPolicy, archivedAt: null,
      }] : [],
    }; return query;
  } }),
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: state.audit }));
vi.mock("../../netlify/functions/lib/services/participantCardEmailService", () => ({ queueParticipantConfirmationOutcomeEmail: state.email }));

import { submitPublicParticipantConfirmationService } from "../../netlify/functions/lib/services/participantConfirmationService";

const token = signParticipantConfirmationToken({ participantId: state.participant.id,
  eventId: state.event.id, expiresAt: Date.parse("2099-12-31T23:59:59Z") });

describe("keputusan kehadiran melalui tautan pribadi", () => {
  beforeEach(() => {
    state.participant.approvalStatus = "PENDING_REVIEW";
    state.participant.confirmationStatus = "INVITED";
    state.event.attendanceConfirmationDeadline = null;
    state.event.lateConfirmationPolicy = "BLOCK";
    state.update.mockClear();
    state.history.mockReset().mockResolvedValue([]);
    state.audit.mockReset().mockResolvedValue(undefined);
    state.email.mockReset().mockResolvedValue(1);
    state.lastUpdate = {};
    state.update.mockImplementation(() => ({ set: (values: Record<string, unknown>) => {
      state.lastUpdate = values;
      return { where: () => ({ returning: async () => {
        Object.assign(state.participant, values);
        return [state.participant];
      } }) };
    } }));
  });

  it.each(["CONFIRM", "DECLINE"] as const)("menolak %s sebelum persetujuan admin", async (decision) => {
    await expect(submitPublicParticipantConfirmationService(token, decision, "test-request"))
      .rejects.toThrow(/Tunggu persetujuan admin/);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("menolak aktivasi kembali setelah peserta berhalangan", async () => {
    state.participant.approvalStatus = "APPROVED";
    state.participant.confirmationStatus = "CANCELLED";
    await expect(submitPublicParticipantConfirmationService(token, "CONFIRM", "test-request"))
      .rejects.toThrow(/tidak aktif/);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("menghormati batas konfirmasi BLOCK", async () => {
    state.participant.approvalStatus = "APPROVED";
    state.event.attendanceConfirmationDeadline = new Date("2020-01-01T00:00:00Z");
    await expect(submitPublicParticipantConfirmationService(token, "CONFIRM", "test-request"))
      .rejects.toThrow(/Batas konfirmasi/);
    expect(state.update).not.toHaveBeenCalled();
  });

  it("menyimpan jawaban hadir dan mengaktifkan kartu setelah persetujuan", async () => {
    state.participant.approvalStatus = "APPROVED";
    const result = await submitPublicParticipantConfirmationService(token, "CONFIRM", "test-request");
    expect(result.confirmationStatus).toBe("CONFIRMED");
    expect(result.approvalStatus).toBe("APPROVED");
    expect(result.cardUrl).toContain("/card?token=pqr_");
    expect(state.lastUpdate.confirmedAt).toBeInstanceOf(Date);
    expect(state.audit).toHaveBeenCalledOnce();
    expect(state.email).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), "CONFIRM");
  });

  it("respons hadir melewati tenggat REVIEW memerlukan persetujuan ulang", async () => {
    state.participant.approvalStatus = "APPROVED";
    state.event.attendanceConfirmationDeadline = new Date("2020-01-01T00:00:00Z");
    state.event.lateConfirmationPolicy = "REVIEW";
    const result = await submitPublicParticipantConfirmationService(token, "CONFIRM", "test-request");
    expect(result.confirmationStatus).toBe("CONFIRMED");
    expect(result.approvalStatus).toBe("PENDING_REVIEW");
    expect(result.cardUrl).toBeNull();
    expect(state.history).toHaveBeenCalledTimes(2);
  });

  it("berhalangan melepas tempat dan menonaktifkan kartu", async () => {
    state.participant.approvalStatus = "APPROVED";
    const result = await submitPublicParticipantConfirmationService(token, "DECLINE", "test-request");
    expect(result.confirmationStatus).toBe("CANCELLED");
    expect(result.cardUrl).toBeNull();
    expect(state.lastUpdate.qrTokenVersion).toBeDefined();
    expect(state.email).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), "DECLINE");
    expect(result.cancellationKind).toBe("DECLINED");
  });

  it("pengunduran diri setelah konfirmasi dibedakan dalam riwayat, audit, dan email", async () => {
    state.participant.approvalStatus = "APPROVED";
    state.participant.confirmationStatus = "CONFIRMED";
    const result = await submitPublicParticipantConfirmationService(token, "DECLINE", "test-request");
    expect(result.confirmationStatus).toBe("CANCELLED");
    expect(result.cancellationKind).toBe("WITHDRAWN");
    expect(state.history).toHaveBeenCalledWith(expect.objectContaining({ reason: expect.stringContaining("Mengundurkan diri") }));
    expect(state.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "PUBLIC_PARTICIPANT_WITHDRAWN" }));
    expect(state.email).toHaveBeenCalledWith(expect.any(Object), expect.any(Object), "WITHDRAW");
  });
});
