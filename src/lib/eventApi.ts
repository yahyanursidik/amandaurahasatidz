import { ENV } from "@/config/env";

export async function eventApi<T>(path: string, options?: RequestInit): Promise<T> {
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
    throw new Error(result.error?.message || "Permintaan tidak dapat diproses.");
  }
  return result.data as T;
}
