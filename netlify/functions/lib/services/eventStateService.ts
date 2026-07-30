import { ValidationError } from "../utils/errors";

export type EventStatus =
  | "DRAFT"
  | "PUBLISHED"
  | "REGISTRATION_OPEN"
  | "REGISTRATION_CLOSED"
  | "ONGOING"
  | "COMPLETED"
  | "ARCHIVED"
  | "CANCELLED";

export type TransitionAction =
  | "PUBLISH"
  | "OPEN_REGISTRATION"
  | "CLOSE_REGISTRATION"
  | "START_EVENT"
  | "COMPLETE_EVENT"
  | "ARCHIVE"
  | "CANCEL";

const TRANSITION_MAP: Record<TransitionAction, { from: EventStatus[]; to: EventStatus }> = {
  PUBLISH: { from: ["DRAFT"], to: "PUBLISHED" },
  OPEN_REGISTRATION: { from: ["PUBLISHED"], to: "REGISTRATION_OPEN" },
  CLOSE_REGISTRATION: { from: ["REGISTRATION_OPEN"], to: "REGISTRATION_CLOSED" },
  START_EVENT: { from: ["REGISTRATION_CLOSED", "PUBLISHED"], to: "ONGOING" },
  COMPLETE_EVENT: { from: ["ONGOING"], to: "COMPLETED" },
  ARCHIVE: { from: ["COMPLETED", "CANCELLED"], to: "ARCHIVED" },
  CANCEL: { from: ["DRAFT", "PUBLISHED", "REGISTRATION_OPEN", "REGISTRATION_CLOSED"], to: "CANCELLED" },
};

export function getNextEventStatus(currentStatus: EventStatus, action: TransitionAction): EventStatus {
  const transition = TRANSITION_MAP[action];
  if (!transition) {
    throw new ValidationError(`Aksi transisi '${action}' tidak dikenal.`);
  }

  if (!transition.from.includes(currentStatus)) {
    throw new ValidationError(
      `Transisi ilegal: Event dalam status '${currentStatus}' tidak dapat diubah via aksi '${action}'. Status yang diizinkan untuk '${action}': [${transition.from.join(", ")}].`
    );
  }

  return transition.to;
}
