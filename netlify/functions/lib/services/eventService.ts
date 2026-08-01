import {
  findEventsRepository,
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

export async function getEventsService(search?: string, status?: string) {
  return await findEventsRepository(search, status);
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
  if (!event) {
    throw new NotFoundError(`Event Daurah dengan slug '${slug}' tidak ditemukan.`);
  }
  return event;
}

export async function createEventService(data: any, actorUserId: string, requestId: string) {
  if (new Date(data.startDate) > new Date(data.endDate)) {
    throw new ValidationError("Tanggal mulai tidak boleh lebih lambat dari tanggal selesai.");
  }
  validateEventDeadlines(data);

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

  const startDateKey = String(data.startAt).slice(0, 10);
  const endDateKey = String(data.endAt).slice(0, 10);
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
