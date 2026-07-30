export function getOrGenerateRequestId(headers: Record<string, string | undefined>): string {
  const existingId = headers["x-request-id"] || headers["X-Request-ID"];
  if (existingId && typeof existingId === "string" && existingId.trim() !== "") {
    return existingId.trim();
  }
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substring(2, 8);
  return `req_${timestamp}_${randomStr}`;
}
