import {
  findEventsRepository,
  findEventCatalogRepository,
  findPublicEventsRepository,
  findEventByIdRepository,
  findEventBySlugRepository,
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
import { assertValidQuotaAllocation } from "./eventQuota";
import { countApprovedParticipantsBySourceRepository } from "../repositories/participantRepository";
import { getDbClient } from "../db/client";
import { eventSessions, events } from "../db/schema";
import { and, eq, isNull } from "drizzle-orm";

export async function getEventsService(search?: string, status?: string) {
  return await findEventsRepository(search, status);
}

export async function getEventCatalogService(query: { page: number; pageSize: number; search: string; status: string }) {
  return findEventCatalogRepository(query);
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

export async function getEventByIdService(id: string) {
  const event = await findEventByIdRepository(id);
  if (!event) {
    throw new NotFoundError(`Event Daurah dengan ID ${id} tidak ditemukan.`);
  }
  return event;
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
  const event = await findEventBySlugRepository(slug);
  if (!event || event.archivedAt || !["PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED", "ONGOING", "COMPLETED"].includes(event.status)) {
    throw new NotFoundError("Program gate tidak tersedia.");
  }
  return { id: event.id };
}

export async function getPublicEventsService() {
  return findPublicEventsRepository();
}

export async function createEventService(data: any, actorUserId: string, requestId: string) {
  if (new Date(data.startDate) > new Date(data.endDate)) {
    throw new ValidationError("Tanggal mulai tidak boleh lebih lambat dari tanggal selesai.");
  }
  validateEventDeadlines(data);
  assertValidQuotaAllocation(data);

  const created = await createEventRepository({
    ...data,
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
  const existing = await getEventByIdService(id);

  if (data.status) {
    throw new ValidationError(
      "Pengubahan status event tidak diizinkan via payload update biasa. Gunakan command transition resmi."
    );
  }

  if (data.startDate && data.endDate) {
    if (new Date(data.startDate) > new Date(data.endDate)) {
      throw new ValidationError("Tanggal mulai tidak boleh lebih lambat dari tanggal selesai.");
    }
  }
  validateEventDeadlines({ ...existing, ...data });
  assertValidQuotaAllocation({ ...existing, ...data });

  const updated = await updateEventRepository(id, {
    ...data,
    ...(data.registrationOpenAt !== undefined && { registrationOpenAt: data.registrationOpenAt ? new Date(data.registrationOpenAt) : null }),
    ...(data.registrationCloseAt !== undefined && { registrationCloseAt: data.registrationCloseAt ? new Date(data.registrationCloseAt) : null }),
    ...(data.invitationResponseDeadline !== undefined && { invitationResponseDeadline: data.invitationResponseDeadline ? new Date(data.invitationResponseDeadline) : null }),
    ...(data.attendanceConfirmationDeadline !== undefined && { attendanceConfirmationDeadline: data.attendanceConfirmationDeadline ? new Date(data.attendanceConfirmationDeadline) : null }),
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
  const existing = await getEventByIdService(id);
  const currentStatus = existing.status as EventStatus;

  const nextStatus = getNextEventStatus(currentStatus, action);
  if (action === "OPEN_REGISTRATION" && existing.registrationCloseAt && existing.registrationCloseAt <= new Date()) {
    throw new ValidationError("Batas pendaftaran sudah lewat. Perbarui tanggal penutupan di pengaturan event sebelum membuka kembali.");
  }
  const updated = await updateEventStatusRepository(id, nextStatus);

  await createAuditLog({
    actorUserId,
    action: `EVENT_TRANSITION_${action}`,
    resourceType: "EVENT",
    resourceId: id,
    beforeData: { status: currentStatus },
    afterData: { status: nextStatus },
    reason: `Status event diubah dari ${currentStatus} ke ${nextStatus} via command ${action}.`,
    requestId,
  });

  return updated;
}

export async function addEventDayService(eventId: string, data: any, actorUserId: string, requestId: string) {
  const event = await getEventByIdService(eventId);

  if (data.date < event.startDate || data.date > event.endDate) {
    throw new ValidationError("Tanggal hari kegiatan harus berada dalam rentang tanggal event.");
  }
  const orderedDays = [...event.days, { dayNumber: data.dayNumber, date: data.date }]
    .sort((a, b) => a.dayNumber - b.dayNumber);
  if (orderedDays.some((day, index) => index > 0 && day.date <= orderedDays[index - 1].date)) {
    throw new ValidationError(
      "Nomor hari harus mengikuti urutan tanggal kegiatan. Tanggal berjeda tetap diperbolehkan.",
    );
  }

  if (data.checkinOpenAt && data.checkinCloseAt) {
    if (new Date(data.checkinOpenAt) >= new Date(data.checkinCloseAt)) {
      throw new ValidationError("Waktu pembukaan check-in harus lebih awal daripada waktu penutupan.");
    }
  }

  const created = await createEventDayRepository({
    ...data,
    eventId,
    checkinOpenAt: data.checkinOpenAt ? new Date(data.checkinOpenAt) : null,
    checkinCloseAt: data.checkinCloseAt ? new Date(data.checkinCloseAt) : null,
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

export async function addEventSessionService(eventId: string, data: any, actorUserId: string, requestId: string) {
  const event = await getEventByIdService(eventId);
  const selectedDay = event.days.find((day) => day.id === data.eventDayId);
  if (!selectedDay) {
    throw new ValidationError("Hari yang dipilih tidak termasuk dalam event ini.");
  }

  const localDateKey = (value: string) => new Intl.DateTimeFormat("en-CA", { timeZone: event.timezone,
    year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value));
  const startDateKey = localDateKey(data.startAt);
  const endDateKey = localDateKey(data.endAt);
  if (startDateKey !== selectedDay.date || endDateKey !== selectedDay.date) {
    throw new ValidationError("Tanggal mulai dan selesai sesi harus sama dengan tanggal hari kegiatan.");
  }

  if (new Date(data.startAt) >= new Date(data.endAt)) {
    throw new ValidationError("Jam mulai sesi harus lebih awal daripada jam selesai.");
  }

  if (data.checkinOpenAt && data.checkinCloseAt) {
    if (new Date(data.checkinOpenAt) >= new Date(data.checkinCloseAt)) {
      throw new ValidationError("Waktu pembukaan check-in sesi harus lebih awal daripada penutupan.");
    }
  }

  const created = await createEventSessionRepository({
    ...data,
    startAt: new Date(data.startAt),
    endAt: new Date(data.endAt),
    checkinOpenAt: data.checkinOpenAt ? new Date(data.checkinOpenAt) : null,
    checkinCloseAt: data.checkinCloseAt ? new Date(data.checkinCloseAt) : null,
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
  const event = await getEventByIdService(eventId);
  const existing = event.sessions.find((session) => session.id === sessionId);
  if (!existing) throw new NotFoundError("Sesi tidak ditemukan pada event ini.");
  const day = event.days.find((item) => item.id === existing.eventDayId);
  if (!day) throw new NotFoundError("Hari kegiatan sesi tidak ditemukan.");
  const updated = { ...existing, ...input };
  const start = new Date(String(updated.startAt));
  const end = new Date(String(updated.endAt));
  const dayKey = (value: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: event.timezone,
    year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || dayKey(start) !== day.date || dayKey(end) !== day.date || start >= end) {
    throw new ValidationError("Jam sesi harus valid, berurutan, dan berada pada hari kegiatan yang sama.");
  }
  const checkinOpen = updated.checkinOpenAt ? new Date(String(updated.checkinOpenAt)) : null;
  const checkinClose = updated.checkinCloseAt ? new Date(String(updated.checkinCloseAt)) : null;
  if ((checkinOpen && Number.isNaN(checkinOpen.getTime())) || (checkinClose && Number.isNaN(checkinClose.getTime())) ||
    (checkinOpen && checkinClose && checkinOpen >= checkinClose)) {
    throw new ValidationError("Pembukaan check-in sesi harus lebih awal daripada penutupannya.");
  }
  const db = getDbClient();
  const rows = await db.update(eventSessions).set({
    ...input,
    ...(input.startAt !== undefined && { startAt: start }),
    ...(input.endAt !== undefined && { endAt: end }),
    ...(input.checkinOpenAt !== undefined && { checkinOpenAt: input.checkinOpenAt ? new Date(String(input.checkinOpenAt)) : null }),
    ...(input.checkinCloseAt !== undefined && { checkinCloseAt: input.checkinCloseAt ? new Date(String(input.checkinCloseAt)) : null }),
    updatedAt: new Date(),
  }).where(eq(eventSessions.id, sessionId)).returning();
  await createAuditLog({ actorUserId, action: "EVENT_SESSION_UPDATED", resourceType: "EVENT_SESSION",
    resourceId: sessionId, eventId, beforeData: existing as any, afterData: rows[0] as any, requestId });
  return rows[0];
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
