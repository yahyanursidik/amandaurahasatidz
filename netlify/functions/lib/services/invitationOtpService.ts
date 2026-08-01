import { createHmac, timingSafeEqual } from "node:crypto";

const OTP_TTL_MS = 5 * 60 * 1000;
const VERIFICATION_TTL_MS = 30 * 60 * 1000;
function getOtpSecret() {
  const configuredSecret =
    process.env.INVITATION_OTP_SECRET ||
    process.env.JWT_SECRET ||
    process.env.SESSION_SECRET;

  if (configuredSecret) return configuredSecret;

  if (process.env.NODE_ENV === "production" || process.env.CONTEXT === "production") {
    throw new Error(
      "INVITATION_OTP_SECRET wajib dikonfigurasi sebelum OTP undangan digunakan di production.",
    );
  }

  return "fallback_aman_daurah_invitation_otp_dev_2026";
}

type SignedPayload = {
  kind: "challenge" | "verified";
  invitationId: string;
  email: string;
  issuedAt: number;
  expiresAt: number;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function sign(data: string) {
  return createHmac("sha256", getOtpSecret()).update(data).digest("base64url");
}

function encode(payload: SignedPayload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

function decode(token: string): SignedPayload | null {
  const [data, signature, ...rest] = token.split(".");
  if (!data || !signature || rest.length > 0) return null;

  const expected = Buffer.from(sign(data));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  try {
    return JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as SignedPayload;
  } catch {
    return null;
  }
}

function codeForChallenge(challengeToken: string) {
  const digest = createHmac("sha256", getOtpSecret())
    .update(`invitation-code:${challengeToken}`)
    .digest();
  return (digest.readUInt32BE(0) % 1_000_000).toString().padStart(6, "0");
}

export function maskInvitationEmail(email: string) {
  const normalized = normalizeEmail(email);
  const [localPart, domain = ""] = normalized.split("@");
  if (!localPart || !domain) return "email perwakilan terdaftar";
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${"•".repeat(Math.max(3, localPart.length - visible.length))}@${domain}`;
}

export function createInvitationOtpChallenge(
  invitationId: string,
  email: string,
  now = Date.now(),
) {
  const payload: SignedPayload = {
    kind: "challenge",
    invitationId,
    email: normalizeEmail(email),
    issuedAt: now,
    expiresAt: now + OTP_TTL_MS,
  };
  const challengeToken = encode(payload);
  return {
    challengeToken,
    code: codeForChallenge(challengeToken),
    expiresAt: new Date(payload.expiresAt),
  };
}

export function verifyInvitationOtpChallenge(
  challengeToken: string,
  code: string,
  invitationId: string,
  email: string,
  now = Date.now(),
) {
  const payload = decode(challengeToken);
  if (
    !payload ||
    payload.kind !== "challenge" ||
    payload.invitationId !== invitationId ||
    payload.email !== normalizeEmail(email) ||
    payload.expiresAt < now
  ) {
    return null;
  }

  const expected = Buffer.from(codeForChallenge(challengeToken));
  const received = Buffer.from(code.trim());
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  const verifiedPayload: SignedPayload = {
    kind: "verified",
    invitationId,
    email: payload.email,
    issuedAt: now,
    expiresAt: now + VERIFICATION_TTL_MS,
  };
  return {
    verificationToken: encode(verifiedPayload),
    expiresAt: new Date(verifiedPayload.expiresAt),
  };
}

export function verifyInvitationVerificationToken(
  verificationToken: string,
  invitationId: string,
  now = Date.now(),
) {
  const payload = decode(verificationToken);
  if (
    !payload ||
    payload.kind !== "verified" ||
    payload.invitationId !== invitationId ||
    payload.expiresAt < now
  ) {
    return null;
  }
  return payload;
}

export function shouldExposeInvitationPreviewCode() {
  return process.env.NODE_ENV !== "production" && process.env.CONTEXT !== "production";
}
