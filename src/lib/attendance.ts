export type CheckinUnit = {
  id: string;
  type: "DAY" | "SESSION";
  dayId: string;
  sessionId: string | null;
  title: string;
  date: string;
  openAt: string;
  closeAt: string;
  isOpen: boolean;
};

export type CheckinSchedule = {
  attendanceMode: "DAILY_ONLY" | "SESSION_ONLY" | "DAILY_AND_SESSION";
  timezone: string;
  units: CheckinUnit[];
  manualUnitCount: number;
  eventAllowsCheckin: boolean;
};

export const attendanceUnitSelection = (unit: CheckinUnit) => unit.type === "DAY" ? { dayId: unit.dayId } : { sessionId: unit.sessionId };

/** Overlapping daily/session windows need an explicit operator choice. */
export function pickCheckinUnit(units: CheckinUnit[], previous = "") {
  if (previous && units.some((unit) => unit.id === previous)) return previous;
  const open = units.filter((unit) => unit.isOpen);
  return open.length === 1 ? open[0].id : "";
}

export const attendanceLabels: Record<string, string> = {
  HADIR_PENUH: "Hadir penuh", HADIR_SEBAGIAN: "Hadir sebagian", IZIN_LENGKAP: "Izin lengkap",
  TIDAK_HADIR: "Tidak hadir", BELUM_DIMULAI: "Belum tercatat", BELUM_DIATUR: "Belum diatur", TIDAK_WAJIB: "Di luar daftar presensi",
  PRESENT: "Hadir", LATE: "Terlambat", EXCUSED: "Izin", PERMITTED: "Diizinkan", ABSENT: "Tidak hadir",
  NOT_RECORDED: "Belum tercatat", NOT_REQUIRED: "Tidak wajib",
};

export const checkinMethodLabels: Record<string, string> = {
  QR_SCAN: "Scan QR pribadi", MANUAL_CODE: "Kode peserta", SEARCH_SELECT: "Pencarian peserta",
  SELF_SCAN: "Check-in mandiri", MANUAL_MARK: "Catat manual",
  QR: "Scan QR pribadi", MANUAL: "Kode peserta", CODE: "Kode peserta",
};
