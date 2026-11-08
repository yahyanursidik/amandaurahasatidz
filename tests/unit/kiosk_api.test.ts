import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HandlerContext, HandlerEvent } from "@netlify/functions";
import { UnauthorizedError } from "../../netlify/functions/lib/utils/errors";
import { signParticipantQrToken } from "../../netlify/functions/lib/utils/token";

const mocks = vi.hoisted(() => ({
  session: vi.fn(), gateEvent: vi.fn(), kiosk: vi.fn(), pair: vi.fn(), checkin: vi.fn(), db: vi.fn(),
}));
vi.mock("../../netlify/functions/lib/db/client", () => ({ getDbClient: mocks.db }));
vi.mock("../../netlify/functions/lib/services/authService", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../netlify/functions/lib/services/authService")>(),
  getUserSession: mocks.session,
}));
vi.mock("../../netlify/functions/lib/services/eventService", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../netlify/functions/lib/services/eventService")>(),
  getPublicGateEventService: mocks.gateEvent,
}));
vi.mock("../../netlify/functions/lib/services/kioskService", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../netlify/functions/lib/services/kioskService")>(),
  requireKioskDeviceService: mocks.kiosk,
  pairKioskDeviceService: mocks.pair,
}));
vi.mock("../../netlify/functions/lib/services/attendanceService", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../netlify/functions/lib/services/attendanceService")>(),
  processOnSiteCheckinService: mocks.checkin,
}));

import { handler } from "../../netlify/functions/api";

const eventId = "00000000-0000-4000-8000-000000000001";
const dayId = "00000000-0000-4000-8000-000000000002";
const qrToken = signParticipantQrToken({ participantId: dayId, eventId, version: 1 }, "unit-secret");
const base = "/gate/events/daurah-coba";
const kioskCookie = `ada_kiosk_daurah-coba=00000000-0000-4000-8000-000000000003.kdev_${"a".repeat(64)}`;
async function request(path: string, method = "GET", body?: unknown, cookie = "") {
  const event: HandlerEvent = {
    path: `/api/v1${path}`, rawUrl: `https://ada.example/api/v1${path}`, rawQuery: "", httpMethod: method,
    headers: { host: "ada.example", origin: "https://ada.example", "sec-fetch-site": "same-origin", cookie },
    multiValueHeaders: {}, queryStringParameters: null, multiValueQueryStringParameters: null,
    body: body === undefined ? null : JSON.stringify(body), isBase64Encoded: false,
  };
  const response = await handler(event, {} as HandlerContext, vi.fn());
  if (!response?.body) throw new Error("No JSON response");
  return { status: response.statusCode, headers: response.headers, json: JSON.parse(response.body) };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.gateEvent.mockResolvedValue({ id: eventId, slug: "daurah-coba", code: "DAURAH", name: "Daurah Coba" });
  mocks.kiosk.mockImplementation(async (_eventId: string, cookie?: string) => {
    if (!cookie) throw new UnauthorizedError("Perangkat kiosk belum diaktifkan.");
    return { id: "00000000-0000-4000-8000-000000000003", label: "Meja utama" };
  });
  mocks.checkin.mockResolvedValue({ status: "SUCCESS" });
  mocks.pair.mockResolvedValue({ device: { id: "00000000-0000-4000-8000-000000000003", label: "Meja utama" },
    cookieValue: `00000000-0000-4000-8000-000000000003.kdev_${"a".repeat(64)}` });
});

describe("gate kiosk API", () => {
  it("menutup daftar event dan pencarian nama publik lama", async () => {
    expect((await request("/gate/events")).status).toBe(404);
    expect((await request(`${base}/search?q=ahmad`)).status).toBe(404);
  });
  it("mewajibkan perangkat teraktivasi sebelum membaca jadwal atau mencatat", async () => {
    expect((await request(`${base}/units`)).status).toBe(401);
    expect((await request(`${base}/checkin`, "POST", { qrToken, dayId })).status).toBe(401);
    expect(mocks.checkin).not.toHaveBeenCalled();
  });
  it("menukar tautan sekali pakai dengan cookie HttpOnly dan tanpa cache", async () => {
    const response = await request(`${base}/pair`, "POST", { pairingToken: `kpair_${"b".repeat(64)}` });
    expect(response.status).toBe(200);
    expect(response.headers?.["Set-Cookie"]).toContain("HttpOnly");
    expect(response.headers?.["Set-Cookie"]).toContain("SameSite=Strict");
    expect(response.headers?.["Set-Cookie"]).toContain("ada_kiosk_daurah-coba=");
    expect(response.headers?.["Cache-Control"]).toBe("no-store");
  });
  it("menolak kode peserta dan metode manual meskipun perangkat aktif", async () => {
    const cookie = kioskCookie;
    expect((await request(`${base}/checkin`, "POST", { qrToken: "PAR-2026-ABC", dayId }, cookie)).status).toBe(422);
    expect((await request(`${base}/checkin`, "POST", { qrToken, dayId, method: "MANUAL_CODE" }, cookie)).status).toBe(422);
    expect(mocks.checkin).not.toHaveBeenCalled();
  });
  it("mengirim QR sah dan identitas perangkat ke pencatatan", async () => {
    const response = await request(`${base}/checkin`, "POST", { qrToken, dayId }, kioskCookie);
    expect(response.status).toBe(200);
    expect(mocks.checkin).toHaveBeenCalledWith(eventId, qrToken, "QR_SCAN", undefined, expect.any(String),
      { dayId, sessionId: undefined }, "00000000-0000-4000-8000-000000000003");
  });
});
