import { eventApi } from "./eventApi";

export type CommitteeRole =
  | "EVENT_ADMIN"
  | "COMMITTEE_LEAD"
  | "REGISTRATION_OFFICER"
  | "CHECKIN_OFFICER"
  | "INFORMATION_OFFICER";

export type CommitteeAssignment = {
  id: string;
  eventId: string;
  eventName: string;
  eventCode: string;
  eventStatus: string;
  committeeRole: CommitteeRole;
  permissions?: string[] | null;
  startsAt?: string | null;
  endsAt?: string | null;
  startDate?: string;
  endDate?: string;
  venueName?: string | null;
  invitationResponseDeadline?: string | null;
  attendanceConfirmationDeadline?: string | null;
  attendanceConfirmationRequired?: boolean;
  lateConfirmationPolicy?: string;
  effectivePermissions?: string[];
};

export type CommitteeMember = {
  id: string;
  name: string | null;
  email: string;
  status: string;
  lastLoginAt?: string | null;
  assignments: CommitteeAssignment[];
};

export const committeeApi = eventApi;

export const COMMITTEE_ROLES: Array<{ value: CommitteeRole; label: string; purpose: string }> = [
  { value: "EVENT_ADMIN", label: "Admin Event", purpose: "Konfigurasi dan kendali operasional event." },
  { value: "COMMITTEE_LEAD", label: "Koordinator Panitia", purpose: "Jadwal, pengumuman, presensi, dan laporan." },
  { value: "REGISTRATION_OFFICER", label: "Petugas Registrasi", purpose: "Data peserta dan registrasi kedatangan." },
  { value: "CHECKIN_OFFICER", label: "Petugas Check-in", purpose: "Pemindaian dan pencatatan presensi." },
  { value: "INFORMATION_OFFICER", label: "Petugas Informasi", purpose: "Jadwal dan pengumuman peserta." },
];

export const roleLabel = (role: string) =>
  COMMITTEE_ROLES.find((item) => item.value === role)?.label || role.replaceAll("_", " ");

export const formatCommitteeDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Tidak dibatasi";
