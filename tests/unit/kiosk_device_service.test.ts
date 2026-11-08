import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashToken } from "../../netlify/functions/lib/utils/token";

const mocks = vi.hoisted(() => ({
  rows: [] as Array<Array<Record<string, unknown>>>,
  selected: [] as Array<Record<string, unknown>>,
  audit: vi.fn(),
}));
vi.mock("../../netlify/functions/lib/services/auditService", () => ({ createAuditLog: mocks.audit }));
vi.mock("../../netlify/functions/lib/db/client", () => ({
  getDbClient: () => ({
    update: () => ({ set: () => ({ where: () => ({ returning: async () => mocks.rows.shift() || [] }) }) }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => mocks.selected }) }) }),
  }),
}));

import { pairKioskDeviceService, requireKioskDeviceService } from "../../netlify/functions/lib/services/kioskService";

const eventId = "00000000-0000-4000-8000-000000000001";
const deviceId = "00000000-0000-4000-8000-000000000002";
const pairingToken = `kpair_${"a".repeat(64)}`;
const deviceToken = `kdev_${"b".repeat(64)}`;

beforeEach(() => { mocks.rows.length = 0; mocks.selected = []; mocks.audit.mockClear(); });

describe("sesi perangkat kiosk", () => {
  it("menggunakan tautan aktivasi satu kali; pemakaian ulang ditolak", async () => {
    mocks.rows.push([{ id: deviceId, label: "Meja utama" }], []);
    const paired = await pairKioskDeviceService(eventId, pairingToken, "request-one");
    expect(paired.cookieValue).toMatch(new RegExp(`^${deviceId}\\.kdev_[a-f0-9]{64}$`));
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "KIOSK_PAIRED", eventId }));
    await expect(pairKioskDeviceService(eventId, pairingToken, "request-two")).rejects.toThrow(/telah dipakai/);
  });

  it("hanya menerima hash token perangkat yang sesuai", async () => {
    mocks.selected = [{ id: deviceId, eventId, label: "Meja utama", deviceTokenHash: hashToken(deviceToken), deviceExpiresAt: new Date(Date.now() + 60_000) }];
    const session = await requireKioskDeviceService(eventId, `${deviceId}.${deviceToken}`);
    expect(session.label).toBe("Meja utama");
    await expect(requireKioskDeviceService(eventId, `${deviceId}.kdev_${"c".repeat(64)}`)).rejects.toThrow(/kedaluwarsa|dicabut/);
  });

  it("menolak sesi yang tidak ditemukan atau sudah dicabut", async () => {
    await expect(requireKioskDeviceService(eventId, `${deviceId}.${deviceToken}`)).rejects.toThrow(/kedaluwarsa|dicabut/);
  });
});
