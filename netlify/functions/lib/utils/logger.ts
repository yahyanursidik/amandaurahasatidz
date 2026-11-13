export function redactSensitiveText(value: string) {
  return value.replace(/\b(?:inv_(?:inst|self|ind|tok)_[A-Za-z0-9_]+|(?:pcf|prc|pqr|rqr)_[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|kpair_[A-Za-z0-9_-]+|loc_qr_[A-Za-z0-9_-]+)\b/g, "[REDACTED]");
}

export function maskSensitiveData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const masked = { ...data };
  const sensitiveKeys = ["password", "token", "auth_secret", "database_url", "secret", "authorization"];
  for (const key of Object.keys(masked)) {
    if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
      masked[key] = "[REDACTED]";
    } else if (typeof masked[key] === "string") masked[key] = redactSensitiveText(masked[key] as string);
    else if (masked[key] && typeof masked[key] === "object") masked[key] = maskSensitiveData(masked[key] as Record<string, unknown>);
  }
  return masked;
}

export function logInfo(requestId: string, message: string, data?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      level: "INFO",
      timestamp: new Date().toISOString(),
      requestId,
      message: redactSensitiveText(message),
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
      message: redactSensitiveText(message),
      error: error instanceof Error ? { name: error.name, message: redactSensitiveText(error.message) } : error && typeof error === "object" ? maskSensitiveData(error as Record<string, unknown>) : typeof error === "string" ? redactSensitiveText(error) : error,
    })
  );
}
