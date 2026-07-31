import { ENV } from "@/config/env";

export type InstitutionStatus = "ACTIVE" | "INACTIVE";
export type InstitutionVerificationStatus = "VERIFIED" | "UNVERIFIED";

export interface Institution {
  id: string;
  code: string;
  name: string;
  legalName?: string | null;
  institutionType?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  provinceCode?: string | null;
  cityCode?: string | null;
  district?: string | null;
  postalCode?: string | null;
  website?: string | null;
  notes?: string | null;
  status: InstitutionStatus;
  verificationStatus: InstitutionVerificationStatus;
  createdAt: string;
  updatedAt: string;
  representatives?: InstitutionRepresentative[];
  invitationHistory?: InstitutionInvitationHistory[];
  participants?: InstitutionParticipant[];
  affiliations?: InstitutionAffiliation[];
  relationSummary?: {
    representativeCount: number;
    invitationCount: number;
    participantCount: number;
    affiliationCount: number;
  };
}

export interface InstitutionRepresentative {
  id: string;
  institutionId: string;
  name: string;
  email: string;
  phone?: string | null;
  position?: string | null;
  isPrimary: boolean;
  verifiedAt?: string | null;
}

export interface InstitutionInvitationHistory {
  id: string;
  invitationNumber: string;
  status: string;
  quota?: number | null;
  responseDeadline?: string | null;
  sentAt?: string | null;
  respondedAt?: string | null;
  eventId: string;
  eventName: string;
  eventCode: string;
  eventStartDate: string;
  eventStatus: string;
  responseStatus?: string | null;
  responseSubmittedAt?: string | null;
}

export interface InstitutionParticipant {
  id: string;
  participantCode: string;
  confirmationStatus: string;
  approvalStatus: string;
  isDelegationLead: boolean;
  eventId: string;
  eventName: string;
  eventStartDate: string;
  ustadzId: string;
  ustadzName: string;
  ustadzEmail?: string | null;
}

export interface InstitutionAffiliation {
  id: string;
  position?: string | null;
  isPrimary: boolean;
  status: string;
  verifiedAt?: string | null;
  ustadzId: string;
  ustadzName: string;
  ustadzEmail?: string | null;
  ustadzPhone?: string | null;
}

export interface InstitutionFormValues {
  code: string;
  name: string;
  legalName: string;
  institutionType: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  provinceCode: string;
  cityCode: string;
  district: string;
  postalCode: string;
  website: string;
  notes: string;
  status?: InstitutionStatus;
  verificationStatus?: InstitutionVerificationStatus;
}

interface ApiResponse<T> {
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
    summary?: Array<{
      status: InstitutionStatus;
      verificationStatus: InstitutionVerificationStatus;
      total: number;
    }>;
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
    throw new Error("API lembaga belum memberikan respons JSON.");
  }
  const result = (await response.json()) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(result.error?.message || "Permintaan data lembaga tidak dapat diproses.");
  }
  return result;
}

const cleanPayload = (values: InstitutionFormValues) =>
  Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, typeof value === "string" && value.trim() === "" ? null : value])
  );

export const institutionApi = {
  list: async (params: URLSearchParams) => request<Institution[]>(`/institutions?${params.toString()}`),
  get: async (id: string) => (await request<Institution>(`/institutions/${id}`)).data,
  create: async (values: InstitutionFormValues) =>
    (
      await request<Institution>("/institutions", {
        method: "POST",
        body: JSON.stringify(cleanPayload(values)),
      })
    ).data,
  update: async (id: string, values: InstitutionFormValues) =>
    (
      await request<Institution>(`/institutions/${id}`, {
        method: "PATCH",
        body: JSON.stringify(cleanPayload(values)),
      })
    ).data,
  deactivate: async (id: string) =>
    (
      await request<{ message: string }>(`/institutions/${id}`, {
        method: "DELETE",
      })
    ).data,
  addRepresentative: async (
    institutionId: string,
    values: Omit<InstitutionRepresentative, "id" | "institutionId" | "verifiedAt">
  ) =>
    (
      await request<InstitutionRepresentative>(`/institutions/${institutionId}/representatives`, {
        method: "POST",
        body: JSON.stringify(values),
      })
    ).data,
  updateRepresentative: async (
    institutionId: string,
    representativeId: string,
    values: Partial<InstitutionRepresentative>
  ) =>
    (
      await request<InstitutionRepresentative>(
        `/institutions/${institutionId}/representatives/${representativeId}`,
        { method: "PATCH", body: JSON.stringify(values) }
      )
    ).data,
  deleteRepresentative: async (institutionId: string, representativeId: string) =>
    (
      await request<InstitutionRepresentative>(
        `/institutions/${institutionId}/representatives/${representativeId}`,
        { method: "DELETE" }
      )
    ).data,
};
