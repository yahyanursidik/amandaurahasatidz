import {
  findEventsRepository,
  findEventOptionsRepository,
  findEventCatalogRepository,
  findPublicEventsRepository,
  findEventByIdRepository,
  findEventBySlugRepository,
  findPublicProgramPageRepository,
  findRegistrationEventRepository,
  createEventRepository,
  updateEventRepository,
  updateEventStatusRepository,
  createEventDayRepository,
  createEventSessionRepository,
  assignCommitteeRepository,
} from "../repositories/eventRepository";
import { getNextEventStatus, TransitionAction, EventStatus } from "./eventStateService";
import { NotFoundError, ValidationError, ConflictError } from "../utils/errors";
import { createAuditLog } from "./auditService";
import { validateEventDeadlines } from "./deadlineService";
import { assertQuotaCoversApproved, assertValidQuotaAllocation } from "./eventQuota";
import { countApprovedParticipantsBySourceRepository, countApprovedParticipantsForEventRepository } from "../repositories/participantRepository";
import { getDbClient } from "../db/client";
import { eventDays, eventSessions, events } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";
import { normalizePhone } from "../utils/normalization";
import type { PublicProgramQuery } from "../validations/eventValidation";
import { withTransaction } from "../db/transaction";
import { eventHasAttendanceRecords } from "../repositories/attendanceRepository";
import { CHECKIN_EVENT_STATUSES, CLOSED_EVENT_STATUSES, buildRequiredAttendanceUnits, eventCalendarDate, type AttendanceMode } from "./attendanceModel";

export async function getEventsService(search?: string, status?: string, allowedEventIds: string[] | null = null) {
  return await findEventsRepository(search, status, allowedEventIds);
}

export async function getEventCatalogService(query: { page: number; pageSize: number; search: string; status: string }, allowedEventIds: string[] | null = null) {
  return findEventCatalogRepository(query, allowedEventIds);
}

export async function removeEventFromCatalogService(id: string, actorUserId: string, requestId: string) {
  const existing = await getEventByIdService(id);
  if (existing.archivedAt) throw new ConflictError("Event ini sudah diarsipkan.");
  // Preserve participants, invitations and attendance rather than cascading their deletion.
  const db = getDbClient();
  const [archived] = await db.update(events).set({ archivedAt: new Date(), status: "ARCHIVED", updatedAt: new Date() })
    .where(and(eq(events.id, id), isNull(events.archivedAt))).returning();
  if (!archived) throw new ConflictError("Status event berubah. Segarkan halaman lalu coba lagi.");
  await createAuditLog({ actorUserId, action: "EVENT_REMOVED_FROM_CATALOG", resourceType: "EVENT",
    resourceId: id, eventId: id, beforeData: { status: existing.status }, afterData: { status: "ARCHIVED" },
    reason: "Event dihapus dari katalog aktif; riwayat peserta dan presensi dipertahankan.", requestId });
  return { id, status: archived.status, message: "Event diarsipkan dari katalog aktif. Riwayat peserta tetap tersimpan." };
}

export async function getEventByIdService(id: string, db?: ReturnType<typeof getDbClient>) {
  const event = await findEventByIdRepository(id, db);
  if (!event) {
    throw new NotFoundError(`Event Daurah dengan ID ${id} tidak ditemukan.`);
  }
  return event;
}

export async function getEventAttendanceSetupService(eventId: string) {
  const db = getDbClient();
  const [event, hasAttendanceRecords] = await Promise.all([getEventByIdService(eventId, db), eventHasAttendanceRecords(db, eventId)]);
  const units = buildRequiredAttendanceUnits(event.attendanceMode as AttendanceMode, event.days, event.sessions, event.timezone);
  const validWindows = units.every((unit) => unit.openAt < unit.endsAt);
  const now = new Date();
  return { ...event, attendanceSetup: {
    hasAttendanceRecords,
    scheduleClosed: Boolean(event.archivedAt) || CLOSED_EVENT_STATUSES.includes(event.status),
    readyToStart: validWindows && units.length > 0 && (event.attendanceMode === "DAILY_ONLY" || units.some((unit) => unit.type === "SESSION")),
    openOrFutureUnitCount: units.filter((unit) => unit.endsAt >= now).length,
    qrUnitCount: units.filter((unit) => unit.qrEnabled && unit.openAt < unit.endsAt).length,
    remainingQrUnitCount: units.filter((unit) => unit.qrEnabled && unit.openAt < unit.endsAt && unit.endsAt > now).length,
    manualUnitCount: units.filter((unit) => !unit.qrEnabled).length,
  } };
}

export async function getEventBySlugPublicService(slug: string) {
  const event = await findEventBySlugRepository(slug);
  if (!event || event.archivedAt || !["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED"].includes(event.status)) {
    throw new NotFoundError(`Event Daurah dengan slug '${slug}' tidak ditemukan.`);
  }
  const [regularApproved, invitationApproved] = await Promise.all([
    countApprovedParticipantsBySourceRepository(event.id, true),
    countApprovedParticipantsBySourceRepository(event.id, false),
  ]);
  return {
    id: event.id,
    code: event.code,
    slug: event.slug,
    name: event.name,
    subtitle: event.subtitle,
    description: event.description,
    posterUrl: event.posterUrl,
    posterAlt: event.posterAlt,
    posterFocalPoint: event.posterFocalPoint,
    audienceMode: event.audienceMode,
    timezone: event.timezone,
    startDate: event.startDate,
    endDate: event.endDate,
    venueName: event.venueName,
    venueAddress: event.venueAddress,
    publicContactWhatsapp: event.publicContactWhatsapp,
    attendanceConfirmationRequired: event.attendanceConfirmationRequired,
    mapsUrl: event.mapsUrl,
    registrationOpenAt: event.registrationOpenAt,
    registrationCloseAt: event.registrationCloseAt,
    capacity: event.capacity,
    defaultInstitutionQuota: event.defaultInstitutionQuota,
    regularQuota: event.regularQuota,
    invitationQuota: event.invitationQuota,
    regularApproved,
    invitationApproved,
    status: event.status,
    days: event.days,
    sessions: event.sessions,
  };
}

/** Gate requests only need the event ID; avoid recalculating registration quotas on every scan. */
export async function getPublicGateEventService(slug: string) {
  const [event] = await getDbClient().select({ id: events.id, slug: events.slug, code: events.code,
    name: events.name, status: events.status })
    .from(events).where(and(eq(events.slug, slug), isNull(events.archivedAt))).limit(1);
  if (!event || !CHECKIN_EVENT_STATUSES.includes(event.status)) {
    throw new NotFoundError("Program gate tidak tersedia.");
  }
  return { id: event.id, slug: event.slug, code: event.code, name: event.name };
}

type EventDetail = Awaited<ReturnType<typeof getEventByIdService>>;
type EventDb = ReturnType<typeof getDbClient>;

/** Attendance transactions take a shared lock here before reading the plan. */
async function withLockedEvent<T>(eventId: string, change: (tx: EventDb, event: EventDetail) => Promise<T>) {
  return withTransaction(async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, eventId)).limit(1).for("update");
    if (!event) throw new NotFoundError("Event tidak ditemukan.");
    return change(tx, await getEventByIdService(eventId, tx));
  });
}

function assertScheduleEditable(event: EventDetail) {
  if (event.archivedAt || CLOSED_EVENT_STATUSES.includes(event.status)) {
    throw new ConflictError("Jadwal event yang selesai, dibatalkan, atau diarsipkan sudah dikunci.");
  }
}

const asNullableDate = (value: unknown) => value ? (value instanceof Date ? value : new Date(String(value))) : null;

function assertValidWindow(openAt: Date, closeAt: Date) {
  if (Number.isNaN(openAt.getTime()) || Number.isNaN(closeAt.getTime()) || openAt >= closeAt) {
    throw new ValidationError("Waktu pembukaan check-in harus lebih awal daripada penutupan, termasuk bila salah satu memakai jam bawaan.");
  }
}

export async function getPublicEventsService(query: PublicProgramQuery) {
  return findPublicProgramPageRepository(query);
}

export async function getEventOptionsService(allowedEventIds: string[] | null = null) {
  return findEventOptionsRepository(allowedEventIds);
}

export async function getRegistrationEventService(id: string) {
  const event = await findRegistrationEventRepository(id);
  if (!event) throw new NotFoundError("Event tidak ditemukan.");
  return event;
}

export async function createEventService(data: any, actorUserId: string, requestId: string) {
  if (new Date(data.startDate) > new Date(data.endDate)) {
    throw new ValidationError("Tanggal mulai tidak boleh lebih lambat dari tanggal selesai.");
  }
  validateEventDeadlines(data);
  assertValidQuotaAllocation(data);

  const created = await createEventRepository({
    ...data,
    publicContactWhatsapp: normalizePhone(data.publicContactWhatsapp),
    registrationOpenAt: data.registrationOpenAt ? new Date(data.registrationOpenAt) : null,
    registrationCloseAt: data.registrationCloseAt ? new Date(data.registrationCloseAt) : null,
    invitationResponseDeadline: data.invitationResponseDeadline ? new Date(data.invitationResponseDeadline) : null,
    attendanceConfirmationDeadline: data.attendanceConfirmationDeadline ? new Date(data.attendanceConfirmationDeadline) : null,
    status: "DRAFT",
    createdBy: actorUserId,
  });

  await createAuditLog({
    actorUserId,
    action: "EVENT_CREATED",
    resourceType: "EVENT",
    resourceId: created.id,
    afterData: created as any,
    requestId,
  });

  return created;
}

export async function updateEventService(id: string, data: any, actorUserId: string, requestId: string) {
  if (data.status) {
    throw new ValidationError(
      "Pengubahan status event tidak diizinkan via payload update biasa. Gunakan command transition resmi."
    );
  }
  const { existing, updated } = await withLockedEvent(id, async (tx, existing) => {
    if ((data.slug !== undefined && data.slug !== existing.slug) || (data.code !== undefined && data.code !== existing.code)) {
      throw new ConflictError("Kode dan alamat event tidak dapat diubah setelah dibuat agar tautan publik dan kiosk tetap berlaku.");
    }
    const changesAttendance = (["attendanceMode", "attendanceConfirmationRequired", "timezone", "startDate", "endDate"] as const)
      .some((key) => data[key] !== undefined && data[key] !== existing[key]);
    if (changesAttendance) {
      assertScheduleEditable(existing);
      if (await eventHasAttendanceRecords(tx, id)) {
        throw new ConflictError("Mode, zona waktu, tanggal, dan aturan konfirmasi dikunci setelah ada catatan presensi.");
      }
    }

    const nextStartDate = data.startDate ?? existing.startDate;
    const nextEndDate = data.endDate ?? existing.endDate;
    if (nextStartDate > nextEndDate) {
      throw new ValidationError("Tanggal mulai tidak boleh lebih lambat dari tanggal selesai.");
    }
    if ((nextStartDate !== existing.startDate || nextEndDate !== existing.endDate) &&
      existing.days.some((day) => day.date < nextStartDate || day.date > nextEndDate)) {
      throw new ValidationError("Rentang tanggal baru tidak mencakup semua hari kegiatan. Sesuaikan jadwal hari terlebih dahulu.");
    }
    if (data.timezone && data.timezone !== existing.timezone && (existing.sessions.length > 0 ||
      existing.days.some((day) => day.checkinOpenAt || day.checkinCloseAt))) {
      throw new ValidationError("Zona waktu tidak dapat diubah setelah sesi atau jam check-in harian diatur.");
    }
    validateEventDeadlines({ ...existing, ...data });
    assertValidQuotaAllocation({ ...existing, ...data });
    if ((["capacity", "regularQuota", "invitationQuota"] as const).some((key) => data[key] !== undefined && data[key] !== existing[key])) {
      const [regular, invitation, total] = await Promise.all([
        countApprovedParticipantsBySourceRepository(id, true),
        countApprovedParticipantsBySourceRepository(id, false),
        countApprovedParticipantsForEventRepository(id),
      ]);
      assertQuotaCoversApproved({ ...existing, ...data }, { regular, invitation, total });
    }

    const updated = await updateEventRepository(id, {
      ...data,
      ...(data.publicContactWhatsapp !== undefined && { publicContactWhatsapp: normalizePhone(data.publicContactWhatsapp) }),
      ...(data.registrationOpenAt !== undefined && { registrationOpenAt: asNullableDate(data.registrationOpenAt) }),
      ...(data.registrationCloseAt !== undefined && { registrationCloseAt: asNullableDate(data.registrationCloseAt) }),
      ...(data.invitationResponseDeadline !== undefined && { invitationResponseDeadline: asNullableDate(data.invitationResponseDeadline) }),
      ...(data.attendanceConfirmationDeadline !== undefined && { attendanceConfirmationDeadline: asNullableDate(data.attendanceConfirmationDeadline) }),
    }, tx, existing);
    if (!updated) throw new NotFoundError("Event tidak ditemukan.");
    return { existing, updated };
  });

  await createAuditLog({
    actorUserId,
    action: "EVENT_UPDATED",
    resourceType: "EVENT",
    resourceId: id,
    beforeData: existing as any,
    afterData: updated as any,
    requestId,
  });

  return updated;
}

export async function transitionEventStatusService(
  id: string,
  action: TransitionAction,
  actorUserId: string,
  requestId: string
) {
  const { currentStatus, nextStatus, updated } = await withLockedEvent(id, async (tx, existing) => {
    const currentStatus = existing.status as EventStatus;
    const nextStatus = getNextEventStatus(currentStatus, action);
    if (action === "OPEN_REGISTRATION" && existing.registrationCloseAt && existing.registrationCloseAt <= new Date()) {
      throw new ValidationError("Batas pendaftaran sudah lewat. Perbarui tanggal penutupan di pengaturan event sebelum membuka kembali.");
    }
    if (action === "START_EVENT") {
      const mode = existing.attendanceMode as AttendanceMode;
      const units = buildRequiredAttendanceUnits(mode, existing.days, existing.sessions, existing.timezone);
      if (!units.length || mode !== "DAILY_ONLY" && !units.some((unit) => unit.type === "SESSION")) {
        throw new ValidationError("Lengkapi hari dan sesi wajib di Jadwal sebelum memulai, atau pilih mode Harian saja bila tanpa sesi wajib.");
      }
      for (const unit of units) assertValidWindow(unit.openAt, unit.endsAt);
    }
    if (action === "COMPLETE_EVENT") {
      const units = buildRequiredAttendanceUnits(existing.attendanceMode as AttendanceMode, existing.days, existing.sessions, existing.timezone);
      if (units.some((unit) => unit.endsAt >= new Date())) {
        throw new ValidationError("Masih ada hari atau sesi wajib yang belum ditutup. Periksa jadwal presensi sebelum menyelesaikan event.");
      }
    }
    const updated = await updateEventStatusRepository(id, nextStatus, tx);
    if (!updated) throw new NotFoundError("Event tidak ditemukan.");
    return { currentStatus, nextStatus, updated };
  });

  await createAuditLog({
    actorUserId,
    action: `EVENT_TRANSITION_${action}`,
    resourceType: "EVENT",
    resourceId: id,
    eventId: id,
    beforeData: { status: currentStatus },
    afterData: { status: nextStatus },
    reason: `Status event diubah dari ${currentStatus} ke ${nextStatus} via command ${action}.`,
    requestId,
  });

  return updated;
}

export async function addEventDayService(eventId: string, data: any, actorUserId: string, requestId: string) {
  const created = await withLockedEvent(eventId, async (tx, event) => {
    assertScheduleEditable(event);
    if (await eventHasAttendanceRecords(tx, eventId)) {
      throw new ConflictError("Hari kegiatan tidak dapat ditambahkan setelah presensi tercatat.");
    }
    const next = { ...data, eventId, checkinOpenAt: asNullableDate(data.checkinOpenAt), checkinCloseAt: asNullableDate(data.checkinCloseAt) };
    assertDayWithinEvent(event, next.date);
    assertDayOrder([...event.days, next]);
    const [unit] = buildRequiredAttendanceUnits("DAILY_ONLY", [{ ...next, id: "new-day" }], [], event.timezone);
    assertValidWindow(unit.openAt, unit.endsAt);
    return createEventDayRepository(next, tx);
  });

  await createAuditLog({
    actorUserId,
    action: "EVENT_DAY_ADDED",
    resourceType: "EVENT_DAY",
    resourceId: created.id,
    eventId,
    afterData: created as any,
    requestId,
  });

  return created;
}

function assertDayWithinEvent(event: EventDetail, date: string) {
  if (date < event.startDate || date > event.endDate) throw new ValidationError("Tanggal hari kegiatan harus berada dalam rentang tanggal event.");
}

function assertDayOrder(days: Array<{ dayNumber: number; date: string }>) {
  const ordered = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  if (ordered.some((day, index) => index > 0 && (day.dayNumber === ordered[index - 1].dayNumber || day.date <= ordered[index - 1].date))) {
    throw new ValidationError("Nomor hari dan tanggal harus unik serta berurutan. Tanggal berjeda diperbolehkan.");
  }
}

function sessionTiming(input: { startAt: unknown; endAt: unknown; checkinOpenAt?: unknown; checkinCloseAt?: unknown }, date: string, timezone: string) {
  const startAt = asNullableDate(input.startAt);
  const endAt = asNullableDate(input.endAt);
  const checkinOpenAt = asNullableDate(input.checkinOpenAt);
  const checkinCloseAt = asNullableDate(input.checkinCloseAt);
  if (!startAt || !endAt || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) ||
    startAt >= endAt || eventCalendarDate(startAt, timezone) !== date || eventCalendarDate(endAt, timezone) !== date) {
    throw new ValidationError("Jam sesi harus valid, berurutan, dan berada pada tanggal hari kegiatan dalam zona waktu event.");
  }
  assertValidWindow(checkinOpenAt || new Date(startAt.getTime() - 3_600_000), checkinCloseAt || new Date(endAt.getTime() + 3_600_000));
  return { startAt, endAt, checkinOpenAt, checkinCloseAt };
}

const changedTime = (before: Date | null, after: Date | null) => before?.getTime() !== after?.getTime();

export async function updateEventDayService(eventId: string, dayId: string, input: Record<string, unknown>, actorUserId: string, requestId: string) {
  const { existing, updated } = await withLockedEvent(eventId, async (tx, event) => {
    const existing = event.days.find((day) => day.id === dayId);
    if (!existing) throw new NotFoundError("Hari kegiatan tidak ditemukan pada event ini.");
    assertScheduleEditable(event);
    const next = { ...existing, date: String(input.date ?? existing.date), dayNumber: Number(input.dayNumber ?? existing.dayNumber),
      checkinOpenAt: input.checkinOpenAt === undefined ? existing.checkinOpenAt : asNullableDate(input.checkinOpenAt),
      checkinCloseAt: input.checkinCloseAt === undefined ? existing.checkinCloseAt : asNullableDate(input.checkinCloseAt) };
    const structureChanged = next.date !== existing.date || next.dayNumber !== existing.dayNumber;
    if (event.status === "ONGOING" && structureChanged) {
      throw new ValidationError("Tanggal dan nomor hari tidak dapat digeser saat event berlangsung.");
    }
    assertDayWithinEvent(event, next.date);
    if (next.date !== existing.date && event.sessions.some((session) => session.eventDayId === dayId)) {
      throw new ValidationError("Tanggal hari yang sudah memiliki sesi tidak dapat diubah. Sesuaikan sesi terlebih dahulu.");
    }
    assertDayOrder(event.days.map((day) => day.id === dayId ? next : day));
    const [unit] = buildRequiredAttendanceUnits("DAILY_ONLY", [next], [], event.timezone);
    assertValidWindow(unit.openAt, unit.endsAt);
    const [oldUnit] = buildRequiredAttendanceUnits("DAILY_ONLY", [existing], [], event.timezone);
    const closedWindowChanged = event.attendanceMode !== "SESSION_ONLY" && oldUnit.endsAt < new Date() &&
      (changedTime(existing.checkinOpenAt, next.checkinOpenAt) || changedTime(existing.checkinCloseAt, next.checkinCloseAt));
    if ((structureChanged || closedWindowChanged) && await eventHasAttendanceRecords(tx, eventId)) {
      throw new ConflictError("Tanggal, urutan, atau jendela harian yang telah ditutup tidak dapat diubah setelah ada presensi.");
    }
    const [updated] = await tx.update(eventDays).set({ ...input, date: next.date, dayNumber: next.dayNumber,
      checkinOpenAt: next.checkinOpenAt, checkinCloseAt: next.checkinCloseAt, updatedAt: new Date(),
    }).where(and(eq(eventDays.id, dayId), eq(eventDays.eventId, eventId))).returning();
    if (!updated) throw new NotFoundError("Hari kegiatan tidak lagi tersedia. Segarkan halaman.");
    return { existing, updated };
  });
  await createAuditLog({ actorUserId, action: "EVENT_DAY_UPDATED", resourceType: "EVENT_DAY", resourceId: dayId,
    eventId, beforeData: existing as any, afterData: updated as any, requestId });
  return updated;
}

export async function addEventSessionService(eventId: string, data: any, actorUserId: string, requestId: string) {
  const created = await withLockedEvent(eventId, async (tx, event) => {
    assertScheduleEditable(event);
    const day = event.days.find((item) => item.id === data.eventDayId);
    if (!day) throw new ValidationError("Hari yang dipilih tidak termasuk dalam event ini.");
    const attendanceRequired = data.attendanceRequired !== false;
    if (event.attendanceMode !== "DAILY_ONLY" && attendanceRequired && await eventHasAttendanceRecords(tx, eventId)) {
      throw new ConflictError("Sesi wajib baru akan mengubah rapor yang sudah tercatat. Tambahkan sebagai sesi opsional.");
    }
    return createEventSessionRepository({ ...data, ...sessionTiming(data, day.date, event.timezone),
      attendanceRequired, checkinRequired: attendanceRequired && data.checkinRequired !== false }, tx);
  });

  await createAuditLog({
    actorUserId,
    action: "EVENT_SESSION_ADDED",
    resourceType: "EVENT_SESSION",
    resourceId: created.id,
    eventId,
    afterData: created as any,
    requestId,
  });

  return created;
}

export async function updateEventSessionService(eventId: string, sessionId: string, input: Record<string, unknown>, actorUserId: string, requestId: string) {
  const { existing, updated } = await withLockedEvent(eventId, async (tx, event) => {
    const existing = event.sessions.find((session) => session.id === sessionId);
    if (!existing) throw new NotFoundError("Sesi tidak ditemukan pada event ini.");
    assertScheduleEditable(event);
    const day = event.days.find((item) => item.id === existing.eventDayId);
    if (!day) throw new NotFoundError("Hari kegiatan sesi tidak ditemukan.");
    const timing = sessionTiming({ ...existing, ...input }, day.date, event.timezone);
    const attendanceRequired = Boolean(input.attendanceRequired ?? existing.attendanceRequired);
    const checkinRequired = attendanceRequired && Boolean(input.checkinRequired ?? existing.checkinRequired);
    const structureChanged = attendanceRequired !== existing.attendanceRequired || checkinRequired !== existing.checkinRequired ||
      changedTime(existing.startAt, timing.startAt) || changedTime(existing.endAt, timing.endAt);
    const oldClose = existing.checkinCloseAt || new Date(existing.endAt.getTime() + 3_600_000);
    const closedWindowChanged = oldClose < new Date() && (changedTime(existing.checkinOpenAt, timing.checkinOpenAt) ||
      changedTime(existing.checkinCloseAt, timing.checkinCloseAt));
    if (event.attendanceMode !== "DAILY_ONLY" && (existing.attendanceRequired || attendanceRequired) &&
      (structureChanged || closedWindowChanged) && await eventHasAttendanceRecords(tx, eventId)) {
      throw new ConflictError("Jadwal sesi wajib, pengaturan QR, atau jendela yang telah ditutup dikunci setelah presensi tercatat.");
    }
    const [updated] = await tx.update(eventSessions).set({ ...input, ...timing, attendanceRequired, checkinRequired,
      updatedAt: new Date(),
    }).where(and(eq(eventSessions.id, sessionId), eq(eventSessions.eventDayId, day.id))).returning();
    if (!updated) throw new NotFoundError("Sesi tidak ditemukan pada event ini.");
    return { existing, updated };
  });
  await createAuditLog({ actorUserId, action: "EVENT_SESSION_UPDATED", resourceType: "EVENT_SESSION",
    resourceId: sessionId, eventId, beforeData: existing as any, afterData: updated as any, requestId });
  return updated;
}

export async function assignEventCommitteeService(
  eventId: string,
  userId: string,
  committeeRole: string,
  actorUserId: string,
  requestId: string,
  options?: { startsAt?: string | null; endsAt?: string | null; permissions?: string[] | null }
) {
  await getEventByIdService(eventId);

  const created = await assignCommitteeRepository({
    eventId,
    userId,
    committeeRole,
    startsAt: options?.startsAt ? new Date(options.startsAt) : null,
    endsAt: options?.endsAt ? new Date(options.endsAt) : null,
    permissions: options?.permissions || null,
    createdBy: actorUserId,
  });

  await createAuditLog({
    actorUserId,
    action: "EVENT_COMMITTEE_ASSIGNED",
    resourceType: "EVENT_COMMITTEE_ASSIGNMENT",
    resourceId: created.id,
    eventId,
    afterData: created as any,
    requestId,
  });

  return created;
}
