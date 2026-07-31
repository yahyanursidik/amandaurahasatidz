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
