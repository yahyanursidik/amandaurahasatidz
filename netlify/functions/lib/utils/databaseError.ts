// Distinguish schema drift and connectivity failures from unexpected application errors.
// Do not expose raw SQL or connection details to API clients.
export function classifyDatabaseError(error: unknown): { code: string; message: string; status: number } | null {
  if (!error || typeof error !== "object") return null;
  const details = error as { code?: unknown; message?: unknown; cause?: unknown };
  const message = typeof details.message === "string" ? details.message : "";
  if (details.code === "42703" || details.code === "42P01" ||
    /^column .* does not exist$/i.test(message) || /^column .* of relation .* does not exist$/i.test(message) ||
    /^relation .* does not exist$/i.test(message)) {
    return { code: "DATABASE_SCHEMA_OUTDATED", status: 503,
      message: "Struktur database belum sesuai versi aplikasi. Jalankan migrasi database terbaru, lalu coba kembali." };
  }
  if (/^Error connecting to database: fetch failed$/i.test(message)) {
    return { code: "DATABASE_UNAVAILABLE", status: 503,
      message: "Koneksi database sedang tidak tersedia. Coba lagi beberapa saat." };
  }
  return details.cause && details.cause !== error ? classifyDatabaseError(details.cause) : null;
}
