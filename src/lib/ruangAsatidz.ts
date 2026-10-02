import { eventApi } from "./eventApi";

export type RuangCategory = "SUGGESTION" | "EXPERIENCE" | "NEED" | "QUESTION";
export type RuangStatus = "NEW" | "READ" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
export type RuangPublicationStatus = "PRIVATE" | "PENDING" | "PUBLISHED" | "HIDDEN";

export const categoryLabels: Record<RuangCategory, string> = {
  SUGGESTION: "Saran", EXPERIENCE: "Pengalaman", NEED: "Kebutuhan", QUESTION: "Pertanyaan",
};
export const statusLabels: Record<RuangStatus, string> = {
  NEW: "Baru", READ: "Sudah dibaca", IN_PROGRESS: "Dalam tindak lanjut", RESOLVED: "Selesai", CLOSED: "Ditutup",
};
export const publicationLabels: Record<RuangPublicationStatus, string> = {
  PRIVATE: "Pribadi", PENDING: "Menunggu moderasi", PUBLISHED: "Dipublikasikan", HIDDEN: "Disembunyikan dari papan",
};

export interface PageResult<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
export interface ThreadSummary {
  id: string;
  userId?: string;
  category: RuangCategory;
  subject: string;
  status: RuangStatus;
  publicationStatus: RuangPublicationStatus;
  shareExperience: boolean;
  createdAt: string;
  updatedAt: string;
  authorName?: string | null;
  /** Only supplied by the admin API; never render in the public board. */
  authorEmail?: string | null;
}
export interface ThreadReply {
  id: string;
  threadId: string;
  authorRole: "ASATIDZ" | "YTS";
  authorName?: string | null;
  body: string;
  createdAt: string;
}
export interface ThreadDetail extends ThreadSummary {
  body: string;
  replies: ThreadReply[];
}
export interface BoardExperience {
  id: string;
  subject: string;
  body: string;
  authorName: string | null;
  createdAt: string;
  publishedAt: string;
}
export interface Greeting {
  id: string;
  title: string;
  body: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface CreateThreadInput {
  category: RuangCategory;
  subject: string;
  body: string;
  shareExperience?: boolean;
}

/** Pass the full /ruang-asatidz or /admin/ruang-asatidz path.
 * eventApi provides the JSON envelope, errors and credentialed cookies.
 * Token access is deferred until a request (effects/handlers), never at import/render.
 */
export function ruangApi<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (typeof window !== "undefined") {
    try {
      const token = window.localStorage.getItem("yts_auth_token");
      if (token && !headers.has("Authorization")) headers.set("Authorization", token);
    } catch {
      // Cookie authentication remains usable when browser storage is unavailable.
    }
  }
  return eventApi<T>(path, { ...options, headers: Object.fromEntries(headers.entries()) });
}