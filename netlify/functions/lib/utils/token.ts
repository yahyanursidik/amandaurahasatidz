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
