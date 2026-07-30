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

  const created = await createEventRepository({
    ...data,
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

  const updated = await updateEventRepository(id, data);

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
  await getEventByIdService(eventId);

  if (data.checkinOpenAt && data.checkinCloseAt) {
    if (new Date(data.checkinOpenAt) >= new Date(data.checkinCloseAt)) {
      throw new ValidationError("Waktu pembukaan check-in harus lebih awal daripada waktu penutupan.");
    }
  }

  const created = await createEventDayRepository({
    ...data,
    eventId,
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
  await getEventByIdService(eventId);

  if (new Date(data.startAt) >= new Date(data.endAt)) {
    throw new ValidationError("Jam mulai sesi harus lebih awal daripada jam selesai.");
  }

  if (data.checkinOpenAt && data.checkinCloseAt) {
    if (new Date(data.checkinOpenAt) >= new Date(data.checkinCloseAt)) {
      throw new ValidationError("Waktu pembukaan check-in sesi harus lebih awal daripada penutupan.");
    }
  }

  const created = await createEventSessionRepository(data);

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
  requestId: string
) {
  await getEventByIdService(eventId);

  const created = await assignCommitteeRepository({
    eventId,
    userId,
    committeeRole,
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
