import { ENV } from "@/config/env";

export type UstadzProfileStatus = "ACTIVE" | "INACTIVE" | "MERGED";

export interface UstadzAffiliation {
  id: string;
  institutionId: string;
  institutionName: string;
  institutionCode: string;
  position?: string | null;
  isPrimary: boolean;
  startDate?: string | null;
  endDate?: string | null;
  status: string;
}

export interface UstadzEventHistory {
  participantId: string;
  participantCode: string;
  confirmationStatus: string;
  approvalStatus: string;
  eventId: string;
  eventCode: string;
  eventName: string;
  eventStatus: string;
  eventStartDate: string;
  eventEndDate: string;
  attendanceCount: number;
}

export interface UstadzProfile {
  id: string;
  fullName: string;
  normalizedName: string;
  titlePrefix?: string | null;
  titleSuffix?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  birthPlace?: string | null;
  birthDate?: string | null;
  address?: string | null;
  cityCode?: string | null;
  provinceCode?: string | null;
  educationSummary?: string | null;
  expertiseSummary?: string | null;
  profileStatus: UstadzProfileStatus;
  mergedIntoId?: string | null;
  createdAt?: string;
  updatedAt?: string;
  primaryInstitution?: {
    institutionId: string;
    institutionName: string;
    institutionCode: string;
    position?: string | null;
    isPrimary: boolean;
    status: string;
  } | null;
  affiliationCount?: number;
  hasDuplicateAlert?: boolean;
  completenessPercent?: number;
  affiliations?: UstadzAffiliation[];
  eventHistory?: UstadzEventHistory[];
}

export interface UstadzFormValues {
  fullName: string;
  titlePrefix: string;
  titleSuffix: string;
  email: string;
  phone: string;
  whatsapp: string;
  birthPlace: string;
  birthDate: string;
  address: string;
  cityCode: string;
  provinceCode: string;
  educationSummary: string;
  expertiseSummary: string;
  institutionId: string;
  positionAtInstitution: string;
  isPrimaryInstitution: boolean;
  profileStatus?: UstadzProfileStatus;
}

export interface UstadzSummary {
  total: number;
  active: number;
  inactive: number;
  merged: number;
  incomplete: number;
  duplicateCandidates: number;
}

interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    pageCount?: number;
    summary?: UstadzSummary;
  };
  error?: { message?: string };
}

const getDevelopmentIdentity = () => {
  if (!import.meta.env.DEV) return "";
  try {
    const session = JSON.parse(localStorage.getItem("yts_dev_session") || "{}");
    return typeof session.email === "string" ? session.email : "admin@yts.or.id";
  } catch {
    return "admin@yts.or.id";
  }
};

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const storedToken = localStorage.getItem("yts_auth_token") || "";
  const authorization = import.meta.env.DEV ? getDevelopmentIdentity() : storedToken;
  const response = await fetch(`${ENV.API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("API asatidz belum memberikan respons JSON. Muat ulang server lokal.");
  }
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok) throw new Error(result.error?.message || "Permintaan data asatidz tidak dapat diproses.");
  return result;
}

const cleanPayload = (values: Partial<UstadzFormValues>) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "string" && value.trim() === "" ? null : value,
    ]),
  );

export const ustadzApi = {
  list: (params: URLSearchParams) => request<UstadzProfile[]>(`/ustadz?${params.toString()}`),
  get: async (id: string) => (await request<UstadzProfile>(`/ustadz/${id}`)).data,
  create: async (values: UstadzFormValues) =>
    (
      await request<{ profile: UstadzProfile; duplicateCandidates: UstadzProfile[] }>("/ustadz", {
        method: "POST",
        body: JSON.stringify(cleanPayload(values)),
      })
    ).data,
  update: async (id: string, values: UstadzFormValues) =>
    (
      await request<UstadzProfile>(`/ustadz/${id}`, {
        method: "PATCH",
        body: JSON.stringify(cleanPayload(values)),
      })
    ).data,
  findDuplicates: async (values: {
    fullName: string;
    email?: string | null;
    phone?: string | null;
    excludeId?: string | null;
  }) =>
    (
      await request<UstadzProfile[]>("/ustadz/duplicates/search", {
        method: "POST",
        body: JSON.stringify(values),
      })
    ).data,
  addAffiliation: async (
    ustadzId: string,
    values: { institutionId: string; position?: string; isPrimary: boolean; startDate?: string },
  ) =>
    (
      await request<UstadzAffiliation>(`/ustadz/${ustadzId}/affiliations`, {
        method: "POST",
        body: JSON.stringify(values),
      })
    ).data,
  updateAffiliation: async (
    ustadzId: string,
    affiliationId: string,
    values: Partial<UstadzAffiliation>,
  ) =>
    (
      await request<UstadzAffiliation>(`/ustadz/${ustadzId}/affiliations/${affiliationId}`, {
        method: "PATCH",
        body: JSON.stringify(values),
      })
    ).data,
  endAffiliation: async (ustadzId: string, affiliationId: string) =>
    (
      await request<UstadzAffiliation>(`/ustadz/${ustadzId}/affiliations/${affiliationId}`, {
        method: "DELETE",
      })
    ).data,
  merge: async (values: { sourceUstadzIds: string[]; targetUstadzId: string; notes: string }) =>
    (
      await request<{ message: string; merged: unknown[] }>("/ustadz/merge", {
        method: "POST",
        body: JSON.stringify(values),
      })
    ).data,
};
