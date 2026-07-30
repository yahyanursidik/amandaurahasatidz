export function maskSensitiveData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const masked = { ...data };
  const sensitiveKeys = ["password", "token", "auth_secret", "database_url", "secret", "authorization"];
  for (const key of Object.keys(masked)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      masked[key] = "[REDACTED]";
    }
  }
  return masked;
}

export function logInfo(requestId: string, message: string, data?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "INFO",
      timestamp: new Date().toISOString(),
      requestId,
      message,
      data: maskSensitiveData(data),
    })
  );
}

export function logError(requestId: string, message: string, error?: unknown) {
  console.error(
    JSON.stringify({
      level: "ERROR",
      timestamp: new Date().toISOString(),
      requestId,
      message,
      error: error instanceof Error ? { name: error.name, message: error.message } : error,
    })
  );
}
