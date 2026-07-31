import { ENV } from "@/config/env";

const getDevelopmentIdentity = () => {
  if (!import.meta.env.DEV) return "";
  try {
    const session = JSON.parse(localStorage.getItem("yts_dev_session") || "{}");
    return typeof session.email === "string" ? session.email : "admin@yts.or.id";
  } catch {
    return "admin@yts.or.id";
  }
};

export async function eventApi<T>(path: string, options?: RequestInit): Promise<T> {
  const storedToken = localStorage.getItem("yts_auth_token") || "";
  const developmentIdentity = getDevelopmentIdentity();
  const authorization = import.meta.env.DEV ? developmentIdentity : storedToken;
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
    throw new Error("API lokal belum memberikan respons JSON. Jalankan ulang server pengembangan.");
  }

  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error?.message || "Permintaan tidak dapat diproses.");
  }
  return result.data as T;
}
