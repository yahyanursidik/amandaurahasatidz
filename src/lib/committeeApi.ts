import { eventApi } from "./eventApi";

export type CommitteeRole =
  | "EVENT_ADMIN"
  | "COMMITTEE_ADMIN"
  | "COMMITTEE_LEAD"
  | "REGISTRATION_OFFICER"
  | "CHECKIN_OFFICER"
  | "INFORMATION_OFFICER";

export type CommitteeAssignment = {
  id: string;
  eventId: string;
  eventName: string;
  eventCode: string;
  eventSlug?: string;
  eventStatus: string;
  committeeRole: CommitteeRole | "COMMITTEE_ORGANIZER";
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
  globalAccess?: boolean;
  lastLoginAt?: string | null;
  assignments: CommitteeAssignment[];
};

export const committeeApi = eventApi;

export const COMMITTEE_ROLES: Array<{ value: CommitteeRole; label: string; purpose: string }> = [
  { value: "EVENT_ADMIN", label: "Admin Event", purpose: "Konfigurasi dan kendali operasional event." },
  { value: "COMMITTEE_ADMIN", label: "Admin Panitia Event", purpose: "Putuskan dan selesaikan kasus peserta pada event yang ditugaskan." },
  { value: "COMMITTEE_LEAD", label: "Koordinator Panitia", purpose: "Jadwal, pengumuman, presensi, dan laporan." },
  { value: "REGISTRATION_OFFICER", label: "Petugas Registrasi", purpose: "Data peserta dan registrasi kedatangan." },
  { value: "CHECKIN_OFFICER", label: "Petugas Check-in", purpose: "Pemindaian dan pencatatan presensi." },
  { value: "INFORMATION_OFFICER", label: "Petugas Informasi", purpose: "Jadwal dan pengumuman peserta." },
];

export const COMMITTEE_ORGANIZER_ROLE = {
  value: "COMMITTEE_ORGANIZER", label: "Admin Panitia Semua Event",
  purpose: "Buat event baru dan kelola seluruh event tanpa penugasan satu per satu, termasuk peserta, jadwal, undangan, dan laporan.",
} as const;
export const COMMITTEE_ACCOUNT_ROLES = [COMMITTEE_ORGANIZER_ROLE, ...COMMITTEE_ROLES];

export const roleLabel = (role: string) =>
  COMMITTEE_ACCOUNT_ROLES.find((item) => item.value === role)?.label || role.replaceAll("_", " ");

export const formatCommitteeDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Tidak dibatasi";
