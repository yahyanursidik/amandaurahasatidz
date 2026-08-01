import { createHmac, timingSafeEqual } from "node:crypto";
import { AppError } from "../utils/errors";

type InstitutionAccessPayload = {
  kind: "institution_access";
  invitationId: string;
  issuedAt: number;
  expiresAt: number;
};

const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 8;
const VERIFICATION_TTL_MS = 30 * 60 * 1000;

function isProductionRuntime() {
  return process.env.APP_ENV === "production" || process.env.CONTEXT === "production";
}

function getAccessSecret() {
  const secret =
    process.env.INVITATION_ACCESS_SECRET ||
    process.env.INVITATION_OTP_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.AUTH_SECRET;
  if (secret) return secret;
  if (isProductionRuntime()) {
    throw new AppError(
      "Konfigurasi kode akses undangan belum lengkap.",
      503,
      "INVITATION_ACCESS_CONFIGURATION_ERROR",
    );
  }
  return "fallback_aman_daurah_institution_access_dev_2026";
}

function sign(value: string) {
  return createHmac("sha256", getAccessSecret()).update(value).digest("base64url");
}

function encode(payload: InstitutionAccessPayload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function decode(token: string): InstitutionAccessPayload | null {
  const [body, signature, ...rest] = token.split(".");
  if (!body || !signature || rest.length > 0) return null;
  const expected = Buffer.from(sign(body));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as InstitutionAccessPayload;
  } catch {
    return null;
  }
}

export function normalizeInstitutionAccessCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function getInstitutionAccessCode(invitationId: string) {
  const digest = createHmac("sha256", getAccessSecret())
    .update(`institution-access:${invitationId}`)
    .digest();
  let compact = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    compact += CODE_ALPHABET[digest[index] % CODE_ALPHABET.length];
  }
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

export function verifyInstitutionAccessCode(invitationId: string, suppliedCode: string) {
  const expected = Buffer.from(normalizeInstitutionAccessCode(getInstitutionAccessCode(invitationId)));
  const received = Buffer.from(normalizeInstitutionAccessCode(suppliedCode));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export function createInstitutionAccessVerification(invitationId: string) {
  const now = Date.now();
  const payload: InstitutionAccessPayload = {
    kind: "institution_access",
    invitationId,
    issuedAt: now,
    expiresAt: now + VERIFICATION_TTL_MS,
  };
  return {
    verificationToken: encode(payload),
    expiresAt: new Date(payload.expiresAt),
  };
}

export function verifyInstitutionAccessVerification(token: string, invitationId: string) {
  const payload = decode(token);
  return Boolean(
    payload &&
      payload.kind === "institution_access" &&
      payload.invitationId === invitationId &&
      payload.expiresAt >= Date.now(),
  );
}
