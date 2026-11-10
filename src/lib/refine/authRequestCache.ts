import { ENV } from "@/config/env";

type CachedRequest = { expiresAt: number; value?: unknown; pending?: Promise<unknown> };
const requests = new Map<string, CachedRequest>();
const CACHE_MS = 5_000;
let generation = 0;

/** Browser-memory only. Never persists identity/permissions or caches failures. */
export function invalidateAuthRequests() {
  generation += 1;
  requests.clear();
}

export async function readAuthResource<T>(path: "/auth/session" | "/me/permissions"): Promise<T> {
  const cached = requests.get(path);
  if (cached?.pending) return cached.pending as Promise<T>;
  if (cached?.value && cached.expiresAt > Date.now()) return cached.value as T;
  const version = generation;
  const entry: CachedRequest = { expiresAt: 0 };
  const pending = (async () => {
    const response = await fetch(`${ENV.API_BASE_URL}${path}`, { method: "GET", credentials: "include", cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload?.data) {
      if (version === generation) invalidateAuthRequests();
      throw new Error(payload?.error?.message || "Sesi atau izin tidak dapat diverifikasi.");
    }
    // Logout/login must also invalidate in-flight responses, not only stored entries.
    if (version !== generation) throw new Error("Sesi telah berubah. Verifikasi ulang diperlukan.");
    entry.value = payload.data;
    entry.expiresAt = Date.now() + CACHE_MS;
    return payload.data as T;
  })();
  entry.pending = pending;
  requests.set(path, entry);
  try { return await pending; }
  finally {
    if (requests.get(path) === entry) {
      entry.pending = undefined;
      if (!entry.value) requests.delete(path);
    }
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", invalidateAuthRequests);
  window.addEventListener("focus", invalidateAuthRequests);
}
