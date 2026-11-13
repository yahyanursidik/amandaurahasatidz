import type { CheckinUnit } from "./attendance";

export type AttendanceRehearsal = {
  mode: "REHEARSAL";
  eventId: string;
  attendanceUnit: CheckinUnit;
  liveReady: boolean;
  blockers: Array<{ code: string; message: string }>;
  notice?: string;
  qrToken?: string;
  expiresAt?: string;
  status?: "TEST_SUCCESS" | "TEST_BLOCKED";
  synthetic?: boolean;
  checkedAt?: string;
  recorded?: false;
  participant?: { ustadzName?: string; participantCode?: string };
};

export const isRehearsalQr = (value: string) => /^rqr_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value.trim());
