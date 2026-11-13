import { ENV } from "@/config/env";

export class EventApiError extends Error {
  constructor(message: string, public readonly status: number, public readonly code?: string) {
    super(message);
    this.name = "EventApiError";
  }
}

export async function eventApiEnvelope<T, TMeta = unknown>(path: string, options?: RequestInit): Promise<{ data: T; meta?: TMeta }> {
  const response = await fetch(`${ENV.API_BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("API lokal belum memberikan respons JSON. Jalankan ulang server pengembangan.");
  }

  const result = await response.json();
  if (!response.ok) {
    throw new EventApiError(result.error?.message || "Permintaan tidak dapat diproses.", response.status, result.error?.code);
  }
  return result;
}

export async function eventApi<T>(path: string, options?: RequestInit): Promise<T> {
  return (await eventApiEnvelope<T>(path, options)).data;
}
