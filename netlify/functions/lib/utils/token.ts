import crypto from "crypto";

export interface GeneratedTokenInfo {
  rawToken: string;
  tokenHash: string;
}

export function generateSecureToken(prefix = "inv_tok"): GeneratedTokenInfo {
  // 32 bytes = 256 bits entropy (exceeding 128-bit minimum requirement)
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const rawToken = `${prefix}_${randomBytes}`;
  const tokenHash = hashToken(rawToken);

  return {
    rawToken,
    tokenHash,
  };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken.trim()).digest("hex");
}

export function generateUnpredictableParticipantCode(year = "2026"): string {
  // Uses 4 random bytes = 8 hex chars with cryptographic randomness (e.g. PAR-2026-X8K9M2P4)
  const randomSuffix = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `PAR-${year}-${randomSuffix}`;
}

export function generateOpaqueQrToken(): GeneratedTokenInfo {
  // Opaque 256-bit entropy token string containing NO PII
  const randomBytes = crypto.randomBytes(32).toString("hex");
  const rawToken = `qr_tok_${randomBytes}`;
  const tokenHash = hashToken(rawToken);

  return {
    rawToken,
    tokenHash,
  };
}

export interface ParticipantQrPayload {
  participantId: string;
  eventId: string;
  version: number;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function participantQrSecret() {
  const secret =
    process.env.PARTICIPANT_QR_SECRET ||
    process.env.INVITATION_OTP_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET;
  if (secret) return secret;
  if (process.env.APP_ENV === "production" || process.env.CONTEXT === "production") {
    throw new Error("PARTICIPANT_QR_SECRET atau SESSION_SECRET belum dikonfigurasi.");
  }
  return "fallback_participant_qr_secret_for_local_development_2026";
}

export function signParticipantQrToken(
  payload: ParticipantQrPayload,
  secret = participantQrSecret(),
) {
  if (!UUID_PATTERN.test(payload.participantId) || !UUID_PATTERN.test(payload.eventId)) {
    throw new Error("Payload QR peserta tidak valid.");
  }
  if (!Number.isInteger(payload.version) || payload.version < 1) {
    throw new Error("Versi QR peserta tidak valid.");
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `pqr_${encodedPayload}.${signature}`;
}

export function verifyParticipantQrToken(
  rawToken: string,
  secret = participantQrSecret(),
): ParticipantQrPayload | null {
  const normalized = rawToken.trim();
  if (!normalized.startsWith("pqr_")) return null;
  const [encodedPayload, receivedSignature] = normalized.slice(4).split(".");
  if (!encodedPayload || !receivedSignature) return null;
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  const expected = Buffer.from(expectedSignature);
  const received = Buffer.from(receivedSignature);
  if (expected.length !== received.length || !crypto.timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    if (
      !UUID_PATTERN.test(payload.participantId) ||
      !UUID_PATTERN.test(payload.eventId) ||
      !Number.isInteger(payload.version) ||
      payload.version < 1
    ) return null;
    return payload;
  } catch {
    return null;
  }
}
