/** Shared policy; never infer note access from the broader ustadz.read/update permission. */
export function canAccessYtsNotes(assignments: Array<{ roleCode: string; eventId?: string | null; institutionId?: string | null; startsAt?: string | Date | null; endsAt?: string | Date | null }>, now = new Date()) {
  return assignments.some(a => ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(a.roleCode) && !a.eventId && !a.institutionId &&
    (!a.startsAt || new Date(a.startsAt) <= now) && (!a.endsAt || new Date(a.endsAt) >= now));
}
export const YTS_NOTE_FLAGS = {
  BLUE: { label: "Informatif", color: "Biru", className: "border-blue-300 bg-blue-50 text-blue-950" },
  YELLOW: { label: "Perlu tindak lanjut", color: "Kuning", className: "border-amber-300 bg-amber-50 text-amber-950" },
  RED: { label: "Perlu perhatian segera", color: "Merah", className: "border-rose-300 bg-rose-50 text-rose-950" },
  GREEN: { label: "Tindak lanjut selesai", color: "Hijau", className: "border-emerald-300 bg-emerald-50 text-emerald-950" },
} as const;
export type YtsNoteFlag = keyof typeof YTS_NOTE_FLAGS;
export interface YtsNote {
  id: string; ustadzId: string; title: string; body: string; flag: YtsNoteFlag; version: number;
  archivedAt: string | null; createdAt: string; updatedAt: string;
  createdByName: string | null; updatedByName: string | null; sourceProfileName: string;
}
export interface YtsNoteSummary { ustadzId: string; activeCount: number; flag: YtsNoteFlag | null }
export interface YtsNotesPage { data: YtsNote[]; meta: { page: number; pageSize: number; total: number; totalPages: number } }