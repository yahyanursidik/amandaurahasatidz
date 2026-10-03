import { ruangApi } from "./ruangAsatidz";

/** Operational coverage, not an official administrative/metropolitan boundary. */
export const UKHUWAH_REGIONS = [
  { code: "3273", name: "Kota Bandung" }, { code: "3277", name: "Kota Cimahi" },
  { code: "3204", name: "Kabupaten Bandung" }, { code: "3217", name: "Kabupaten Bandung Barat" },
  { code: "3211", name: "Kabupaten Sumedang (kecamatan terpilih)" },
] as const;
export const UKHUWAH_SUMEDANG_DISTRICTS = ["Jatinangor", "Cimanggung", "Tanjungsari", "Sukasari", "Pamulihan"] as const;
export const categoryLabels = {
  MAPPING: "Pemetaan wilayah", TEACHER: "Pengajar & kaderisasi", QURAN: "Pembelajaran Al-Qur’an",
  YOUTH_FAMILY: "Remaja & keluarga", FACILITIES: "Sarana & perlengkapan", ACCESS: "Akses & transportasi",
  COLLABORATION: "Kolaborasi", PROGRESS: "Evaluasi & perkembangan", SENSITIVE: "Khusus pengelola", OTHER: "Lainnya",
} as const;
export type UkhuwahCategory = keyof typeof categoryLabels;
export type UkhuwahAudience = "SHARED" | "ADMIN_ONLY";
export type UkhuwahPublication = "DRAFT" | "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";
export type UkhuwahWorkStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "ARCHIVED";
export const publicationLabels: Record<UkhuwahPublication, string> = {
  DRAFT: "Draf", PENDING: "Menunggu moderasi", APPROVED: "Disetujui", REJECTED: "Perlu koreksi", HIDDEN: "Disembunyikan",
};
export const workStatusLabels: Record<UkhuwahWorkStatus, string> = {
  OPEN: "Terbuka", IN_PROGRESS: "Dalam proses", RESOLVED: "Selesai", ARCHIVED: "Diarsipkan",
};
export const locationTypeLabels = {
  MOSQUE: "Masjid", PESANTREN: "Pesantren", FOUNDATION: "Yayasan", STUDY_GROUP: "Majelis taklim",
  EDUCATION: "Pusat pendidikan", OTHER: "Lainnya",
} as const;
export type UkhuwahLocationType = keyof typeof locationTypeLabels;
export interface UkhuwahPageResult<T> {
  data: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number };
}
export interface UkhuwahLocation {
  id: string; institutionId: string | null; name: string; type: UkhuwahLocationType;
  address: string; cityCode: string; district: string; latitude: number | null; longitude: number | null;
  programs: string; needs: string; isPublished: boolean; isVerified: boolean; version: number;
  officialPhone?: string | null; picName?: string | null; picPhone?: string | null;
  /** Consent metadata is supplied only to authorized managers. Hidden contacts must be omitted server-side. */
  officialContactShared?: boolean; picContactShared?: boolean; contactConsentConfirmed?: boolean;
  contactConsentSource?: string | null; contactConfirmedAt?: string | null;
  createdAt: string; updatedAt: string;
}
export interface UkhuwahLocationInput {
  institutionId: string | null; name: string; type: UkhuwahLocationType; address: string; cityCode: string;
  district: string; latitude: number | null; longitude: number | null; programs: string; needs: string;
  isPublished: boolean; isVerified: boolean; officialPhone: string; picName: string; picPhone: string;
  officialContactShared: boolean; picContactShared: boolean; contactConsentConfirmed: boolean; contactConsentSource: string;
}
export interface UkhuwahReportInput {
  title: string; body: string; category: UkhuwahCategory; cityCode: string; district: string;
  locationId: string | null; observedAt: string; source: string; urgency: "NORMAL" | "HIGH";
  audience: UkhuwahAudience; hideAuthor: boolean;
}
export interface UkhuwahReport extends UkhuwahReportInput {
  id: string; publicationStatus: UkhuwahPublication; workStatus: UkhuwahWorkStatus; version: number;
  authorName: string | null; isOwner: boolean; moderationReason?: string | null;
  followupSummary: string | null; coordinatorName: string | null; dueDate: string | null;
  createdAt: string; updatedAt: string;
}
export interface UkhuwahSummary {
  locations: number; mappedLocations: number; verifiedLocations: number; reports: number;
  openReports: number; inProgressReports: number; resolvedReports: number;
}
export interface UkhuwahTemplate {
  id: string; name: string; category: UkhuwahCategory; title: string; body: string; audience: UkhuwahAudience;
}
export const UKHUWAH_REPORT_TEMPLATES: readonly UkhuwahTemplate[] = [
  { id: "mapping", name: "Pemetaan awal wilayah", category: "MAPPING", title: "Pemetaan awal kegiatan dakwah",
    body: "Kondisi teramati:\n[ISI: kegiatan yang tersedia dan sumber informasi]\n\nPotensi setempat:\n[ISI: pengajar, fasilitas, mitra]\n\nKebutuhan:\n[ISI: kebutuhan spesifik]\n\nUsulan tindak lanjut:\n[ISI: langkah dan pihak koordinasi]", audience: "SHARED" },
  { id: "teacher", name: "Permintaan pengajar", category: "TEACHER", title: "Kebutuhan pengajar dan pembinaan",
    body: "Tema dan sasaran:\n[ISI: materi dan kelompok sasaran tanpa data pribadi]\n\nWaktu dan frekuensi:\n[ISI: jadwal yang diusulkan]\n\nFasilitas tersedia:\n[ISI: fasilitas dan dukungan]\n\nBantuan yang dibutuhkan:\n[ISI: kebutuhan dan rencana koordinasi]", audience: "SHARED" },
  { id: "visit", name: "Hasil kunjungan/silaturahmi", category: "MAPPING", title: "Hasil silaturahmi dan peluang kerja sama",
    body: "Konteks kunjungan:\n[ISI: tanggal, tujuan dan persetujuan kunjungan]\n\nTemuan faktual:\n[ISI: pengamatan langsung, bukan tuduhan]\n\nPeluang:\n[ISI: kegiatan atau bantuan yang mungkin]\n\nTindak lanjut:\n[ISI: kesepakatan dan langkah berikutnya]", audience: "SHARED" },
  { id: "facilities", name: "Sarana/perlengkapan", category: "FACILITIES", title: "Kebutuhan sarana pembinaan",
    body: "Kondisi sarana:\n[ISI: kondisi yang telah diamati]\n\nKebutuhan spesifik:\n[ISI: jenis, jumlah agregat dan prioritas]\n\nDukungan tersedia:\n[ISI: potensi setempat]\n\nUsulan bantuan:\n[ISI: bentuk bantuan dan koordinasi]", audience: "SHARED" },
  { id: "family", name: "Pembinaan remaja/keluarga", category: "YOUTH_FAMILY", title: "Usulan pembinaan remaja dan keluarga",
    body: "Sasaran agregat:\n[ISI: sasaran dan perkiraan jumlah tanpa identitas pribadi]\n\nKebutuhan teramati:\n[ISI: hambatan dan sumber]\n\nUsulan program:\n[ISI: tema, waktu dan pelaksana]\n\nUkuran keberhasilan:\n[ISI: hasil yang diharapkan]", audience: "SHARED" },
  { id: "collaboration", name: "Kolaborasi kegiatan", category: "COLLABORATION", title: "Peluang kolaborasi kegiatan dakwah",
    body: "Tujuan kegiatan:\n[ISI: manfaat dan sasaran]\n\nMitra dan peran:\n[ISI: mitra yang telah dikonfirmasi]\n\nLokasi dan jadwal:\n[ISI: rencana pelaksanaan]\n\nKontribusi dibutuhkan:\n[ISI: keahlian, tempat atau sarana]", audience: "SHARED" },
  { id: "progress", name: "Evaluasi/perkembangan", category: "PROGRESS", title: "Perkembangan kegiatan dan tindak lanjut",
    body: "Kondisi awal:\n[ISI: kebutuhan sebelumnya]\n\nTindakan:\n[ISI: langkah yang benar-benar dilaksanakan]\n\nHasil:\n[ISI: hasil terukur dan keterbatasan]\n\nLangkah berikutnya:\n[ISI: hambatan tersisa dan kebutuhan lanjutan]", audience: "SHARED" },
  { id: "sensitive", name: "Informasi khusus kepada admin", category: "SENSITIVE", title: "Permintaan bantuan pengelola secara terbatas",
    body: "Konteks faktual:\n[ISI: informasi minimum yang diperlukan, hindari tuduhan]\n\nSumber dan keterbatasan:\n[ISI: apa yang diketahui dan belum diverifikasi]\n\nBantuan diperlukan:\n[ISI: tindakan yang dimohonkan kepada pengelola]", audience: "ADMIN_ONLY" },
];
export const emptyUkhuwahReport = (): UkhuwahReportInput => ({ title: "", body: "", category: "OTHER", cityCode: "3273",
  district: "", locationId: null, observedAt: new Date().toISOString().slice(0, 10), source: "", urgency: "NORMAL", audience: "SHARED", hideAuthor: false });
export const emptyUkhuwahLocation = (): UkhuwahLocationInput => ({ institutionId: null, name: "", type: "OTHER", address: "",
  cityCode: "3273", district: "", latitude: null, longitude: null, programs: "", needs: "", isPublished: false, isVerified: false,
  officialPhone: "", picName: "", picPhone: "", officialContactShared: false, picContactShared: false,
  contactConsentConfirmed: false, contactConsentSource: "" });
export function regionLabel(code: string) { return UKHUWAH_REGIONS.find((region) => region.code === code)?.name ?? "Wilayah belum dikenali"; }
export function isUkhuwahRegion(cityCode: string, district: string) {
  return UKHUWAH_REGIONS.some((r) => r.code === cityCode) && (cityCode !== "3211" || UKHUWAH_SUMEDANG_DISTRICTS.some(
    (d) => d.toLowerCase() === district.trim().replace(/^kec(?:amatan)?\.?\s*/i, "").toLowerCase()));
}
export function unresolvedUkhuwahFields(text: string) { return /\[\s*ISI\s*:|\{\{[^}]+\}\}/i.test(text); }
export function ukhuwahPhoneUrl(value: string, whatsapp = false) {
  const compact = value.replace(/[\s().-]/g, "");
  if (!/^\+?\d{8,15}$/.test(compact)) return null;
  const digits = compact.replace(/^\+/, "").replace(/^0/, "62");
  return whatsapp ? `https://wa.me/${digits}` : `tel:+${digits}`;
}
export function canManageUkhuwah(assignments: Array<{ roleCode: string; eventId?: string | null; institutionId?: string | null; startsAt?: string | Date | null; endsAt?: string | Date | null; isActive?: boolean; status?: string }>, now = new Date()) {
  return assignments.some((a) => ["SUPER_ADMIN", "SYSTEM_ADMIN"].includes(a.roleCode) && !a.eventId && !a.institutionId &&
    a.isActive !== false && (!a.status || a.status === "ACTIVE") &&
    (!a.startsAt || new Date(a.startsAt) <= now) && (!a.endsAt || new Date(a.endsAt) >= now));
}
export const ukhuwahApi = ruangApi;