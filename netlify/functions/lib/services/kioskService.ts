import crypto from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDbClient } from "../db/client";
import { eventKioskDevices, events } from "../db/schema";
import { createAuditLog } from "./auditService";
import { ConflictError, ForbiddenError, NotFoundError, UnauthorizedError, ValidationError } from "../utils/errors";
import { generateSecureToken, hashToken } from "../utils/token";
import { getAttendanceCheckinUnitsService } from "./attendanceService";
import { CHECKIN_EVENT_STATUSES } from "./attendanceModel";

export const kioskCookieName = (slug: string) => `ada_kiosk_${slug}`;
const PAIRING_MINUTES = 10;
const DEVICE_DAYS = 7;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function safeEqualHash(rawToken: string, expectedHash: string) {
  const actual = Buffer.from(hashToken(rawToken), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function assertKioskWriteOrigin(headers: Record<string, string | undefined>) {
  const origin = headers.origin || headers.Origin;
  const host = headers.host || headers.Host;
  const fetchSite = headers["sec-fetch-site"] || headers["Sec-Fetch-Site"];
  let originUrl: URL;
  try { originUrl = new URL(origin || ""); }
  catch { throw new ForbiddenError("Asal permintaan kiosk tidak dikenal."); }
  if (!host || originUrl.host !== host || (fetchSite && fetchSite !== "same-origin")) {
    throw new ForbiddenError("Permintaan kiosk harus berasal dari halaman ini.");
  }
  if ((process.env.APP_ENV === "production" || process.env.CONTEXT === "production") && originUrl.protocol !== "https:") {
    throw new ForbiddenError("Kiosk produksi hanya boleh memakai HTTPS.");
  }
}

export function isSignedParticipantQr(value: string) {
  return /^pqr_[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}$/.test(value.trim());
}

export function isKioskPairingToken(value: unknown): value is string {
  return typeof value === "string" && /^kpair_[a-f0-9]{64}$/.test(value);
}

export function isKioskCookieShape(value?: string) {
  if (!value) return false;
  const [deviceId, rawToken, extra] = value.split(".");
  return uuidPattern.test(deviceId || "") && /^kdev_[a-f0-9]{64}$/.test(rawToken || "") && !extra;
}

export async function listEventKiosksService(eventId: string) {
  const db = getDbClient();
  return db.select({
    id: eventKioskDevices.id, label: eventKioskDevices.label,
    pairingExpiresAt: eventKioskDevices.pairingExpiresAt,
    deviceExpiresAt: eventKioskDevices.deviceExpiresAt,
    pairedAt: eventKioskDevices.pairedAt, revokedAt: eventKioskDevices.revokedAt,
    createdAt: eventKioskDevices.createdAt,
  }).from(eventKioskDevices).where(eq(eventKioskDevices.eventId, eventId))
    .orderBy(desc(eventKioskDevices.createdAt));
}

export async function createKioskPairingService(eventId: string, label: string, actorUserId: string, requestId: string) {
  const db = getDbClient();
  const [event] = await db.select({ id: events.id, slug: events.slug, status: events.status, archivedAt: events.archivedAt })
    .from(events).where(eq(events.id, eventId)).limit(1);
  if (!event || event.archivedAt) throw new NotFoundError("Event tidak ditemukan.");
  if (!CHECKIN_EVENT_STATUSES.includes(event.status)) throw new ValidationError("Terbitkan event sebelum mengaktifkan kiosk.");
  const schedule = await getAttendanceCheckinUnitsService(eventId);
  if (!schedule.units.some((unit) => unit.openAt < unit.closeAt && unit.closeAt > new Date())) {
    throw new ValidationError("Atur minimal satu hari atau sesi yang menerima QR di Jadwal sebelum mengaktifkan kiosk.");
  }
  const token = generateSecureToken("kpair");
  const expiresAt = new Date(Date.now() + PAIRING_MINUTES * 60_000);
  const [device] = await db.insert(eventKioskDevices).values({
    eventId, label, pairingTokenHash: token.tokenHash,
    pairingExpiresAt: expiresAt, createdBy: actorUserId,
  }).returning({ id: eventKioskDevices.id });
  await createAuditLog({ actorUserId, action: "KIOSK_PAIRING_CREATED", resourceType: "EVENT_KIOSK",
    resourceId: device.id, eventId, afterData: { label, pairingExpiresAt: expiresAt.toISOString() }, requestId });
  return { id: device.id, slug: event.slug, pairingToken: token.rawToken, pairingExpiresAt: expiresAt };
}

export async function pairKioskDeviceService(eventId: string, pairingToken: string, requestId: string) {
  if (!isKioskPairingToken(pairingToken)) throw new UnauthorizedError("Tautan aktivasi kiosk tidak valid.");
  const db = getDbClient();
  const deviceToken = generateSecureToken("kdev");
  const now = new Date();
  const deviceExpiresAt = new Date(now.getTime() + DEVICE_DAYS * 86_400_000);
  const [device] = await db.update(eventKioskDevices).set({
    deviceTokenHash: deviceToken.tokenHash, deviceExpiresAt, pairedAt: now,
  }).where(and(eq(eventKioskDevices.eventId, eventId), eq(eventKioskDevices.pairingTokenHash, hashToken(pairingToken)),
    gt(eventKioskDevices.pairingExpiresAt, now), isNull(eventKioskDevices.pairedAt), isNull(eventKioskDevices.revokedAt)))
    .returning({ id: eventKioskDevices.id, label: eventKioskDevices.label });
  if (!device) throw new ConflictError("Tautan aktivasi telah dipakai, kedaluwarsa, atau dicabut. Minta tautan baru kepada admin.");
  await createAuditLog({ action: "KIOSK_PAIRED", resourceType: "EVENT_KIOSK", resourceId: device.id,
    eventId, afterData: { label: device.label, deviceExpiresAt: deviceExpiresAt.toISOString() }, requestId });
  return { device: { id: device.id, label: device.label, deviceExpiresAt }, cookieValue: `${device.id}.${deviceToken.rawToken}` };
}

export async function requireKioskDeviceService(eventId: string, cookieValue?: string) {
  if (!isKioskCookieShape(cookieValue)) {
    throw new UnauthorizedError("Perangkat kiosk belum diaktifkan. Minta tautan dari admin event.");
  }
  const [deviceId, rawToken] = cookieValue!.split(".");
  const [device] = await getDbClient().select({
    id: eventKioskDevices.id, eventId: eventKioskDevices.eventId, label: eventKioskDevices.label,
    deviceTokenHash: eventKioskDevices.deviceTokenHash, deviceExpiresAt: eventKioskDevices.deviceExpiresAt,
  }).from(eventKioskDevices).where(and(eq(eventKioskDevices.id, deviceId), eq(eventKioskDevices.eventId, eventId),
    isNull(eventKioskDevices.revokedAt), gt(eventKioskDevices.deviceExpiresAt, new Date()))).limit(1);
  if (!device?.deviceTokenHash || !safeEqualHash(rawToken, device.deviceTokenHash)) {
    throw new UnauthorizedError("Akses kiosk kedaluwarsa atau telah dicabut. Minta tautan baru dari admin event.");
  }
  return { id: device.id, label: device.label, deviceExpiresAt: device.deviceExpiresAt };
}

export async function revokeKioskDeviceService(eventId: string, deviceId: string, actorUserId: string, requestId: string) {
  const [device] = await getDbClient().update(eventKioskDevices).set({ revokedAt: new Date() })
    .where(and(eq(eventKioskDevices.id, deviceId), eq(eventKioskDevices.eventId, eventId), isNull(eventKioskDevices.revokedAt)))
    .returning({ id: eventKioskDevices.id, label: eventKioskDevices.label });
  if (!device) throw new NotFoundError("Kiosk tidak ditemukan atau sudah dicabut.");
  await createAuditLog({ actorUserId, action: "KIOSK_REVOKED", resourceType: "EVENT_KIOSK",
    resourceId: deviceId, eventId, afterData: { label: device.label }, requestId });
  return { id: device.id, revoked: true };
}
